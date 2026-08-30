/**
 * 파트너(업체) 로그인 계정을 이메일 인증 없이 생성/갱신하는 시드 스크립트.
 *
 * 이메일 발송이 안 되는 환경에서도 Supabase Admin API의 email_confirm 옵션으로
 * 인증 완료된 계정을 바로 만든다.
 *
 * 실행:
 *   pnpm --filter @baro-ddulrim/server exec tsx scripts/seed-partner.ts \
 *     <email> <password> [companyName]
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 * (운영으로 실행하려면 apps/server/.env 를 운영 값으로 두고 실행)
 *
 * 선택 환경변수: PARTNER_NAME, PARTNER_PHONE, PARTNER_BUSINESS_NUMBER
 *   companyName 을 넘기면 활성(ACTIVE) 업체까지 연결해 입찰이 바로 가능하게 만든다.
 *   생략하면 로그인 계정만 만들고, 업체 등록은 앱에서 진행하면 된다.
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { ContractorStatus, PrismaClient } from "../src/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 이 설정되어 있지 않습니다.");
  }
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

async function main() {
  const [emailArg, passwordArg, companyNameArg] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  const password = passwordArg ?? "";
  const companyName = (companyNameArg ?? "").trim();

  const name = process.env.PARTNER_NAME || "파트너 담당자";
  const phone = process.env.PARTNER_PHONE || "010-0000-0000";

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password) {
    throw new Error("사용법: tsx scripts/seed-partner.ts <email> <password> [companyName]");
  }
  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  }

  // 어떤 환경을 바라보는지 확인용 (시크릿은 노출하지 않음)
  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host || "(없음)";
    } catch {
      return "(파싱 실패)";
    }
  })();
  console.log("· 대상 DB 호스트:  ", dbHost);
  console.log("· 대상 Supabase:   ", new URL(supabaseUrl).host);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1) Supabase Auth 유저 생성 (이메일 인증 완료 상태로)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone, role: "contractor" }
  });

  let authUserId = data.user?.id;

  if (error) {
    const message = error.message.toLowerCase();
    if (!message.includes("already") && !message.includes("registered")) {
      throw error;
    }
    // 이미 있으면 비밀번호/인증 갱신
    const { data: usersData, error: listError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    authUserId = usersData.users.find((u) => u.email === email)?.id;
    if (!authUserId) throw new Error("기존 계정을 찾지 못했습니다.");
    await supabase.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: { name, phone, role: "contractor" }
    });
    console.log("· 기존 Auth 계정의 비밀번호를 갱신했습니다.");
  } else {
    console.log("· Supabase Auth 계정을 새로 생성했습니다 (email_confirm=true).");
  }

  const prisma = createPrismaClient();
  try {
    // 2) ContractorAccount 연결
    const account = await prisma.contractorAccount.upsert({
      where: { email },
      update: { authUserId, name, phone },
      create: { authUserId, email, name, phone }
    });
    console.log("· ContractorAccount 준비 완료:", account.id);

    // 3) (선택) 활성 업체 연결
    if (companyName) {
      const existing = await prisma.contractorCompany.findUnique({
        where: { accountId: account.id }
      });
      const businessNumber =
        process.env.PARTNER_BUSINESS_NUMBER ||
        existing?.businessNumber ||
        `000-00-${randomInt(10000, 99999)}`;

      const company = await prisma.contractorCompany.upsert({
        where: { accountId: account.id },
        update: {
          companyName,
          status: ContractorStatus.ACTIVE,
          approvedAt: existing?.approvedAt ?? new Date()
        },
        create: {
          accountId: account.id,
          companyName,
          representativeName: name,
          businessNumber,
          serviceRegions: ["서울", "경기"],
          specialties: ["하수관 청소", "배관 막힘 해결"],
          status: ContractorStatus.ACTIVE,
          statusReason: "시드 스크립트로 생성",
          approvedAt: new Date()
        }
      });
      console.log("· 활성 업체 연결 완료:", company.id, `(${company.status})`);
    }

    console.log("\n✅ 파트너 계정 준비 완료");
    console.log("   로그인:  https://partner.hasugulab.com/login");
    console.log("   이메일:  " + email);
    console.log("   비밀번호: " + password);
    console.log(
      companyName
        ? "   상태:    활성 업체 연결됨 → 입찰까지 바로 가능"
        : "   상태:    로그인만 가능 → 앱에서 업체 등록 후 관리자 승인 필요"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ 실패:", err instanceof Error ? err.message : err);
  process.exit(1);
});
