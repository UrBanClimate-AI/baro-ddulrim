/**
 * 카카오 지오코딩 ↔ Region 마스터 매칭 검증.
 * 실행: pnpm --filter @baro-ddulrim/server exec tsx scripts/test-kakao-region.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const KEY = process.env.KAKAO_REST_API_KEY;

function createPrisma() {
  const cs = process.env.DATABASE_URL!;
  const schema = new URL(cs).searchParams.get("schema") ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: cs, ssl: { rejectUnauthorized: false } },
      schema ? { schema } : undefined
    )
  });
}
const prisma = createPrisma();

const ADDRESSES = [
  "서울특별시 강남구 역삼동",
  "경기도 수원시 장안구 파장동",
  "광주광역시 서구 치평동", // 통합 대상 지역
  "전라남도 목포시 용당동", // 통합 대상 지역
  "부산광역시 해운대구 우동"
];

async function kakaoAddress(q: string) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`,
    { headers: { Authorization: `KakaoAK ${KEY}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  return json.documents?.[0] ?? null;
}

async function main() {
  if (!KEY) throw new Error("KAKAO_REST_API_KEY 없음");
  console.log("대상 DB:", new URL(process.env.DATABASE_URL ?? "").host, "\n");

  for (const q of ADDRESSES) {
    const doc = await kakaoAddress(q);
    if (!doc) {
      console.log(`❌ ${q} → 카카오 결과 없음\n`);
      continue;
    }
    const a = doc.address ?? {};
    const bCode: string | undefined = a.b_code;
    const r1 = a.region_1depth_name;
    const r2 = a.region_2depth_name;
    const r3 = a.region_3depth_name;

    // Region 매칭: (1) b_code 로 (2) 이름(sido/sigungu/dong)으로
    const byCode = bCode ? await prisma.region.findUnique({ where: { code: bCode } }) : null;
    const byName = await prisma.region.findFirst({
      where: { sido: r1, sigungu: r2 || null, eupmyeondong: r3 || null }
    });

    console.log(`■ 입력: ${q}`);
    console.log(`  카카오: ${r1} / ${r2} / ${r3}   b_code=${bCode ?? "-"}`);
    console.log(
      `  코드매칭: ${byCode ? `✅ ${byCode.name}` : "❌ 없음"}`
    );
    console.log(
      `  이름매칭: ${byName ? `✅ ${byName.name} (code=${byName.code})` : "❌ 없음"}\n`
    );
  }
}

main()
  .catch((e) => {
    console.error("실패:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
