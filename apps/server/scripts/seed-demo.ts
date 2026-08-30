/**
 * 데모/테스트 데이터셋 시드 — 업체·신고·AI분석·수정이력·입찰·배정·작업까지
 * 정상 운영처럼 보이는 데이터를 생성한다. (id 접두사 "demo-")
 *
 * 실행:
 *   pnpm --filter @baro-ddulrim/server exec tsx scripts/seed-demo.ts
 *
 * 다시 실행하면 기존 demo-* 데이터를 지우고 새로 만든다(멱등).
 * 운영 DB에는 실행하지 말 것 — 개발/스테이징 전용.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ActorType,
  AiProvider,
  BidStatus,
  ContractorStatus,
  IssueType,
  LocationConfirmedBy,
  MapProvider,
  MessageType,
  PrismaClient,
  ReportChannel,
  ReportStatus,
  SenderType,
  Urgency,
  WorkStatus
} from "../src/generated/prisma/client";

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

// 데모 업체 로그인 공통 비밀번호
const DEMO_PASSWORD = "demo1234!";

/** Supabase Auth 유저를 생성/갱신하고 authUserId를 돌려준다 (이메일 인증 완료 상태) */
async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  name: string,
  phone: string
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name, phone, role: "contractor" }
  });
  if (!error) return data.user?.id ?? null;

  const msg = error.message.toLowerCase();
  if (!msg.includes("already") && !msg.includes("registered")) throw error;

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (listErr) throw listErr;
  const id = list.users.find((u) => u.email === email)?.id;
  if (id) {
    await supabase.auth.admin.updateUserById(id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name, phone, role: "contractor" }
    });
  }
  return id ?? null;
}

/** 데모 업체 계정 전체에 로그인 비밀번호(Supabase Auth) 부여 */
async function seedAuthCredentials() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      "· ⚠️ SUPABASE_URL/SERVICE_ROLE_KEY 없음 → 로그인 비번은 건너뜀 (DB 계정만 생성됨)"
    );
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (let i = 0; i < COMPANIES.length; i++) {
    const c = COMPANIES[i];
    const email = `demo-partner-${i + 1}@example.com`;
    const phone = `010-7${pad(i + 1, 3)}-${pad(1000 + i, 4)}`;
    const authUserId = await ensureAuthUser(supabase, email, c.rep, phone);
    if (authUserId) {
      await prisma.contractorAccount.update({
        where: { id: `demo-ca-${pad(i + 1)}` },
        data: { authUserId }
      });
    }
  }
  return true;
}

// 결정적 의사난수 (재현 가능)
let _seed = 20260831;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
const NOW = Date.now();
function daysAgo(d: number, extraMin = 0) {
  return new Date(NOW - d * 86400000 - extraMin * 60000);
}
const pad = (n: number, w = 3) => ("000" + n).slice(-w);

const COMPANIES = [
  { name: "강남배수119", rep: "김강남", regions: ["서울", "경기"], spec: ["하수관 청소", "배관 막힘 해결"], lat: "37.4979", lng: "127.0276" },
  { name: "수도권배관케어", rep: "박분당", regions: ["경기"], spec: ["정화조 청소", "배관 누수 수리"], lat: "37.3703", lng: "127.1062" },
  { name: "성남클린드레인", rep: "이성남", regions: ["경기"], spec: ["우수관 청소", "펌프 설치/수리"], lat: "37.4200", lng: "127.1265" },
  { name: "한강워터솔루션", rep: "최마포", regions: ["서울"], spec: ["빗물받이 청소", "역류 차단기 설치"], lat: "37.5563", lng: "126.9236" },
  { name: "수원배관마스터", rep: "정수원", regions: ["경기"], spec: ["하수관 청소", "정화조 청소"], lat: "37.2636", lng: "127.0286" }
] as const;

const LOCATIONS = [
  { addr: "서울특별시 강남구 역삼동", road: "서울 강남구 테헤란로", place: "역삼동 상가", lat: "37.5006", lng: "127.0364", sido: "서울", sigungu: "강남구" },
  { addr: "경기도 성남시 분당구 정자동", road: "경기 성남시 분당구 정자일로", place: "정자동 오피스텔", lat: "37.3703", lng: "127.1062", sido: "경기", sigungu: "성남시" },
  { addr: "경기도 수원시 팔달구 인계동", road: "경기 수원시 팔달구 권광로", place: "인계동 음식점", lat: "37.2635", lng: "127.0286", sido: "경기", sigungu: "수원시" },
  { addr: "서울특별시 마포구 서교동", road: "서울 마포구 양화로", place: "홍대 카페", lat: "37.5563", lng: "126.9236", sido: "서울", sigungu: "마포구" },
  { addr: "경기도 고양시 일산동구 장항동", road: "경기 고양시 일산동구 중앙로", place: "장항동 빌라", lat: "37.6584", lng: "126.7702", sido: "경기", sigungu: "고양시" },
  { addr: "인천광역시 남동구 구월동", road: "인천 남동구 예술로", place: "구월동 상가", lat: "37.4487", lng: "126.7315", sido: "인천", sigungu: "남동구" }
] as const;

const ISSUE_TYPES = [
  IssueType.FLOOD,
  IssueType.DRAIN,
  IssueType.SEWER_BACKFLOW,
  IssueType.ODOR,
  IssueType.OTHER
] as const;
const URGENCIES = [Urgency.NORMAL, Urgency.URGENT, Urgency.EMERGENCY] as const;
const CHANNELS = [
  ReportChannel.WEB,
  ReportChannel.WEB,
  ReportChannel.SMS,
  ReportChannel.KAKAO,
  ReportChannel.AI_CALL,
  ReportChannel.PHONE
] as const;

const ISSUE_TEXT: Record<string, { summary: string; desc: string }> = {
  FLOOD: { summary: "지하 침수", desc: "지하 공간에 물이 차오르고 있습니다." },
  DRAIN: { summary: "배수구 막힘", desc: "배수구가 막혀 물이 내려가지 않습니다." },
  SEWER_BACKFLOW: { summary: "하수 역류", desc: "하수구에서 물이 역류하고 있습니다." },
  ODOR: { summary: "하수구 악취", desc: "하수구에서 악취가 올라옵니다." },
  OTHER: { summary: "배관 점검 요청", desc: "배관 상태 점검을 요청합니다." }
};

// 업무 스테이지 분포 (누적 흐름)
const STAGES = [
  "review", "review", "review",
  "bidding", "bidding", "bidding",
  "assigned", "assigned",
  "resolved", "resolved", "resolved", "resolved"
] as const;

async function clearDemo() {
  const where = { reportId: { startsWith: "demo-" } };
  await prisma.workUpdate.deleteMany({ where });
  await prisma.assignment.deleteMany({ where });
  await prisma.bid.deleteMany({ where });
  await prisma.reportStatusHistory.deleteMany({ where });
  await prisma.reportRevision.deleteMany({ where });
  await prisma.aiAnalysis.deleteMany({ where });
  await prisma.reportMessage.deleteMany({ where });
  await prisma.report.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await prisma.contractorCompany.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await prisma.contractorAccount.deleteMany({ where: { id: { startsWith: "demo-" } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: "demo-" } } });
}

type Area = { sigunguCode: string; sigunguName: string; dongCode: string };

/** Region 마스터에서 시군구+대표 동 몇 개를 뽑아 데모 매칭에 사용 */
async function loadAreas(): Promise<Area[]> {
  const sigungu = await prisma.region.findMany({
    where: { level: 2 },
    take: 6,
    orderBy: { code: "asc" }
  });
  const areas: Area[] = [];
  for (const s of sigungu) {
    const dong = await prisma.region.findFirst({
      where: { level: 3, code: { startsWith: s.code.slice(0, 5) } },
      orderBy: { code: "asc" }
    });
    if (dong) areas.push({ sigunguCode: s.code, sigunguName: s.name, dongCode: dong.code });
  }
  return areas;
}

async function seedContractors(areas: Area[]) {
  for (let i = 0; i < COMPANIES.length; i++) {
    const c = COMPANIES[i];
    // 각 업체는 2개 시군구 담당 (겹치도록 → 한 지역에 복수 업체)
    const myAreas = areas.length
      ? [areas[i % areas.length], areas[(i + 1) % areas.length]]
      : [];
    await prisma.contractorAccount.create({
      data: {
        id: `demo-ca-${pad(i + 1)}`,
        email: `demo-partner-${i + 1}@example.com`,
        name: c.rep,
        phone: `010-7${pad(i + 1, 3)}-${pad(1000 + i, 4)}`,
        company: {
          create: {
            id: `demo-cc-${pad(i + 1)}`,
            companyName: c.name,
            representativeName: c.rep,
            businessNumber: `90${i}-01-${pad(10000 + i, 5)}`,
            address: `${c.regions[0]} 일대`,
            latitude: c.lat,
            longitude: c.lng,
            serviceRegions: [...c.regions],
            serviceRadiusKm: 30 + i * 5,
            yearsOfExperience: 3 + i * 2,
            specialties: [...c.spec],
            description: `${c.name} — ${c.spec.join(", ")} 전문.`,
            status: i === COMPANIES.length - 1 ? ContractorStatus.REVIEWING : ContractorStatus.ACTIVE,
            approvedAt: i === COMPANIES.length - 1 ? null : daysAgo(40 - i),
            createdAt: daysAgo(45 - i),
            serviceAreas: {
              create: myAreas.map((a) => ({
                regionCode: a.sigunguCode,
                regionName: a.sigunguName
              }))
            }
          }
        }
      }
    });
  }
}

const REPORT_COUNT = 36;

async function seedReports(areas: Area[]) {
  const activeCompanies = COMPANIES.map((_, i) => `demo-cc-${pad(i + 1)}`).slice(0, COMPANIES.length - 1);
  let misIssue = 0;
  let misUrg = 0;

  for (let n = 1; n <= REPORT_COUNT; n++) {
    const custId = `demo-cust-${pad(n)}`;
    const phone = `010-2${pad(n, 3)}-${pad(3000 + n, 4)}`;
    await prisma.customer.create({
      data: { id: custId, phone, createdAt: daysAgo(30 - (n % 30)) }
    });

    const loc = pick(LOCATIONS);
    const channel = pick(CHANNELS);
    const stage = STAGES[n % STAGES.length];
    const createdD = 30 - Math.floor((n / REPORT_COUNT) * 30);
    const createdAt = daysAgo(createdD, n * 7);

    // AI 예측
    const aiIssue = pick(ISSUE_TYPES);
    const aiUrg = pick(URGENCIES);

    // 약 22% 확률로 관리자가 유형을 수정(오분류), 15% 긴급도 수정
    const correctIssue = rand() < 0.22;
    const correctUrg = rand() < 0.15;
    const finalIssue = correctIssue
      ? ISSUE_TYPES.filter((t) => t !== aiIssue)[Math.floor(rand() * (ISSUE_TYPES.length - 1))]
      : aiIssue;
    const finalUrg = correctUrg
      ? URGENCIES.filter((u) => u !== aiUrg)[Math.floor(rand() * (URGENCIES.length - 1))]
      : aiUrg;
    if (correctIssue) misIssue++;
    if (correctUrg) misUrg++;

    const text = ISSUE_TEXT[finalIssue];
    const reportId = `demo-report-${pad(n)}`;
    const status =
      stage === "review" ? ReportStatus.ADMIN_REVIEW
      : stage === "bidding" ? ReportStatus.BIDDING
      : stage === "assigned" ? ReportStatus.ASSIGNED
      : ReportStatus.RESOLVED;

    const adminApprovedAt = stage === "review" ? null : daysAgo(createdD, n * 7 - 30);
    const assignedAt = stage === "assigned" || stage === "resolved" ? daysAgo(createdD, n * 7 - 60) : null;
    const resolvedAt = stage === "resolved" ? daysAgo(createdD, n * 7 - 180) : null;

    await prisma.report.create({
      data: {
        id: reportId,
        reportNo: `BD-DEMO-${pad(n)}`,
        verificationCode: pad(100000 + n * 7, 6),
        customerId: custId,
        channel,
        status,
        issueType: finalIssue,
        urgency: finalUrg,
        summary: `${loc.place} ${text.summary}`,
        description: text.desc,
        customerPhone: phone,
        addressText: loc.addr,
        roadAddressText: loc.road,
        placeName: loc.place,
        latitude: loc.lat,
        longitude: loc.lng,
        regionCode: areas.length ? areas[n % areas.length].dongCode : null,
        locationProvider: MapProvider.KAKAO,
        locationConfirmedAt: createdAt,
        locationConfirmedBy: LocationConfirmedBy.SYSTEM,
        adminApprovedAt,
        assignedAt,
        resolvedAt,
        createdAt
      }
    });

    // AI 분석 (예측값 저장 — 관리자 수정과 무관하게 원본 유지)
    await prisma.aiAnalysis.create({
      data: {
        reportId,
        provider: AiProvider.OPENAI,
        model: "gpt-5.4-mini",
        rawInput: { text: text.desc },
        rawOutput: { summary: text.summary, issueType: aiIssue, urgency: aiUrg },
        summary: `${loc.place} ${ISSUE_TEXT[aiIssue].summary}`,
        issueType: aiIssue,
        urgency: aiUrg,
        missingFields: [],
        confidence: (0.7 + rand() * 0.29).toFixed(4),
        needsReview: false,
        createdAt: new Date(createdAt.getTime() + 60000)
      }
    });

    // 관리자 수정 이력 (오분류 근거)
    if (correctIssue) {
      await prisma.reportRevision.create({
        data: {
          reportId,
          editorType: ActorType.ADMIN,
          fieldName: "issueType",
          oldValue: aiIssue,
          newValue: finalIssue,
          reason: "관리자 검수 — 문의 유형 재분류",
          createdAt: new Date(createdAt.getTime() + 30 * 60000)
        }
      });
    }
    if (correctUrg) {
      await prisma.reportRevision.create({
        data: {
          reportId,
          editorType: ActorType.ADMIN,
          fieldName: "urgency",
          oldValue: aiUrg,
          newValue: finalUrg,
          reason: "관리자 검수 — 긴급도 조정",
          createdAt: new Date(createdAt.getTime() + 31 * 60000)
        }
      });
    }

    // 대화 로그
    await prisma.reportMessage.createMany({
      data: [
        { reportId, senderType: SenderType.AI, messageType: MessageType.TEXT, content: "안녕하세요. 바로 뚫림입니다. 어떤 문제가 있으신가요?", createdAt },
        { reportId, senderType: SenderType.CUSTOMER, messageType: MessageType.TEXT, content: text.desc, createdAt: new Date(createdAt.getTime() + 60000) },
        { reportId, senderType: SenderType.AI, messageType: MessageType.TEXT, content: "접수되었습니다. 관리자 검수 후 업체를 연결해 드리겠습니다.", createdAt: new Date(createdAt.getTime() + 120000) }
      ]
    });

    // 상태 이력
    await prisma.reportStatusHistory.create({
      data: { reportId, toStatus: ReportStatus.ADMIN_REVIEW, actorType: ActorType.SYSTEM, reason: "관리자 검수 대기", createdAt: new Date(createdAt.getTime() + 90000) }
    });

    // 입찰/배정/작업
    if (stage !== "review") {
      const bidderIds = [...activeCompanies].sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 2));
      const bids = [];
      for (let b = 0; b < bidderIds.length; b++) {
        const bid = await prisma.bid.create({
          data: {
            reportId,
            contractorCompanyId: bidderIds[b],
            estimatedPrice: 80000 + Math.floor(rand() * 15) * 10000,
            availableTime: new Date(createdAt.getTime() + (2 + b) * 3600000),
            canWork: true,
            workNote: "출동 가능, 장비 보유",
            status: BidStatus.SUBMITTED,
            submittedAt: adminApprovedAt ?? createdAt
          }
        });
        bids.push(bid);
      }

      if (stage === "assigned" || stage === "resolved") {
        const winner = bids[0];
        await prisma.bid.update({ where: { id: winner.id }, data: { status: BidStatus.SELECTED } });
        const assignment = await prisma.assignment.create({
          data: {
            reportId,
            bidId: winner.id,
            contractorCompanyId: winner.contractorCompanyId,
            selectionReason: "견적·출동시간 적합",
            assignedAt: assignedAt ?? createdAt
          }
        });

        const updates = [
          { status: WorkStatus.DISPATCH_SCHEDULED, note: "방문 일정 확정", off: 0 },
          { status: WorkStatus.DISPATCHED, note: "현장 출동", off: 30 },
          { status: WorkStatus.IN_PROGRESS, note: "작업 진행", off: 60 }
        ];
        if (stage === "resolved") updates.push({ status: WorkStatus.RESOLVED, note: "작업 완료", off: 120 });
        for (const u of updates) {
          await prisma.workUpdate.create({
            data: {
              reportId,
              assignmentId: assignment.id,
              contractorCompanyId: winner.contractorCompanyId,
              status: u.status,
              note: u.note,
              finalPrice: u.status === WorkStatus.RESOLVED ? winner.estimatedPrice : null,
              createdAt: new Date((assignedAt ?? createdAt).getTime() + u.off * 60000)
            }
          });
        }
      }
    }
  }

  return { misIssue, misUrg };
}

async function main() {
  const dbHost = new URL(process.env.DATABASE_URL ?? "").host;
  console.log("· 대상 DB:", dbHost);
  console.log("· 기존 demo-* 정리 중…");
  await clearDemo();
  console.log("· 지역(시군구) 로드…");
  const areas = await loadAreas();
  console.log(`  담당지역 후보: ${areas.map((a) => a.sigunguName).join(", ") || "(Region 없음)"}`);
  console.log("· 업체 생성…");
  await seedContractors(areas);
  console.log("· 업체 로그인 비번 부여(Supabase Auth)…");
  const authDone = await seedAuthCredentials();
  console.log("· 신고/AI분석/입찰/배정/작업 생성…");
  const { misIssue, misUrg } = await seedReports(areas);

  console.log("\n✅ 데모 데이터 생성 완료");
  console.log(`   업체: ${COMPANIES.length}곳 (활성 ${COMPANIES.length - 1})`);
  console.log(`   신고: ${REPORT_COUNT}건`);
  console.log(`   유형 오분류(관리자 수정): ${misIssue}건 / 긴급도 오분류: ${misUrg}건`);
  if (authDone) {
    console.log(`\n   로그인: https://partner.hasugulab.com/login (로컬은 localhost:3001)`);
    console.log(`   공통 비밀번호: ${DEMO_PASSWORD}`);
    for (let i = 0; i < COMPANIES.length; i++) {
      console.log(
        `   - demo-partner-${i + 1}@example.com  (${COMPANIES[i].name})`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("❌ 실패:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
