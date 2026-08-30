/**
 * 법정동 지역 마스터 시드 — 행정표준코드 "법정동코드 전체자료" 파일을 파싱해
 * 시도/시군구/읍면동(리 제외, 폐지 제외)을 Region 테이블에 적재한다.
 *
 * 준비: apps/server/prisma/data/legal-dong.txt (UTF-8, 탭 구분)
 * 실행: pnpm --filter @baro-ddulrim/server exec tsx scripts/seed-regions.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 이 필요합니다.");
  const rejectUnauthorized =
    process.env.PRISMA_SSL_REJECT_UNAUTHORIZED !== "false";
  const schema =
    new URL(connectionString).searchParams.get("schema") ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, ssl: { rejectUnauthorized } },
      schema ? { schema } : undefined
    )
  });
}

const prisma = createPrismaClient();

function levelOf(code: string): number {
  if (code.slice(2) === "00000000") return 1; // 시도
  if (code.slice(5) === "00000") return 2; // 시군구
  if (code.slice(8) === "00") return 3; // 읍면동
  return 4; // 리
}

type Raw = { code: string; name: string; active: boolean };

async function main() {
  const filePath = join(__dirname, "..", "prisma", "data", "legal-dong.txt");
  const lines = readFileSync(filePath, "utf-8").split("\n");

  // 1) 전체 파싱 → 코드 맵 (이름/레벨 참조용)
  const all = new Map<string, Raw>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [code, name, status] = line.split("\t");
    if (!code || !name) continue;
    all.set(code, { code, name: name.trim(), active: status?.trim() === "존재" });
  }

  // 2) 시도/시군구/읍면동만, 폐지 제외 → Region 행 구성 (이름 토큰 기반)
  const rows: {
    code: string;
    name: string;
    sido: string;
    sigungu: string | null;
    eupmyeondong: string | null;
    level: number;
    parentCode: string | null;
  }[] = [];

  for (const { code, name, active } of all.values()) {
    if (!active) continue;
    let level = levelOf(code);
    if (level === 4) continue; // 리 제외

    const tokens = name.split(/\s+/).filter(Boolean);
    // 세종처럼 시군구 코드 자리에 있지만 실제로는 시도인 경우(단일 토큰) 보정
    if (level === 2 && tokens.length === 1) level = 1;

    const sido = tokens[0];
    const sidoCode = code.slice(0, 2) + "00000000";
    const sigunguCode = code.slice(0, 5) + "00000";

    if (level === 1) {
      rows.push({ code, name, sido, sigungu: null, eupmyeondong: null, level, parentCode: null });
    } else if (level === 2) {
      rows.push({
        code, name, sido,
        sigungu: tokens.slice(1).join(" ") || null,
        eupmyeondong: null,
        level, parentCode: sidoCode
      });
    } else {
      const sigungu = tokens.slice(1, -1).join(" ") || null;
      rows.push({
        code, name, sido, sigungu,
        eupmyeondong: tokens[tokens.length - 1],
        level,
        parentCode: sigungu ? sigunguCode : sidoCode
      });
    }
  }

  console.log(`· 파싱 완료: ${rows.length}행 (시도/시군구/읍면동, 폐지 제외)`);
  console.log("· 대상 DB:", new URL(process.env.DATABASE_URL ?? "").host);

  // 테이블 보장 (db push 없이도 동작 — 기존 스키마 드리프트를 건드리지 않음)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Region" (
      "code" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "sido" TEXT NOT NULL,
      "sigungu" TEXT,
      "eupmyeondong" TEXT,
      "level" INTEGER NOT NULL,
      "parentCode" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Region_level_idx" ON "Region"("level");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Region_parentCode_idx" ON "Region"("parentCode");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Region_sido_sigungu_idx" ON "Region"("sido","sigungu");`
  );
  console.log("· Region 테이블 확인/생성 완료");

  await prisma.region.deleteMany({});
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.region.createMany({ data: rows.slice(i, i + CHUNK) });
    console.log(`  적재 ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  const counts = await prisma.region.groupBy({ by: ["level"], _count: true });
  console.log("\n✅ Region 적재 완료");
  for (const c of counts.sort((a, b) => a.level - b.level)) {
    const label = c.level === 1 ? "시도" : c.level === 2 ? "시군구" : "읍면동";
    console.log(`   ${label}: ${c._count}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ 실패:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
