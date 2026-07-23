import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import {
  ActorType,
  AiProvider,
  BidStatus,
  ContractorStatus,
  IssueType,
  LocationConfirmedBy,
  LocationSource,
  MapProvider,
  MessageType,
  PrismaClient,
  ReportChannel,
  ReportStatus,
  SenderType,
  TemplateChannel,
  Urgency,
  WorkStatus
} from "../src/generated/prisma/client";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/baro_ddulrim";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL ?? fallbackDatabaseUrl;
  const rejectUnauthorized = process.env.PRISMA_SSL_REJECT_UNAUTHORIZED !== "false";
  // pg 드라이버는 URL의 ?schema= 파라미터를 무시하므로 어댑터 옵션으로 전달한다.
  const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;

  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString,
        ssl: {
          rejectUnauthorized
        }
      },
      schema ? { schema } : undefined
    )
  });
}

const prisma = createPrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME || "관리자";
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !supabaseUrl || !serviceRoleKey) {
    console.warn("관리자 seed 환경변수가 부족해 관리자 계정 생성을 건너뜁니다.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: "admin"
    }
  });

  let authUserId = data.user?.id;

  if (error) {
    const message = error.message.toLowerCase();

    if (!message.includes("already") && !message.includes("registered")) {
      throw error;
    }

    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      throw listError;
    }

    authUserId = usersData.users.find((user) => user.email === email)?.id;
  }

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      authUserId,
      name,
      isActive: true
    },
    create: {
      authUserId,
      email,
      name,
      isActive: true
    }
  });
}

async function seedSettings() {
  await prisma.appSetting.upsert({
    where: { key: "ai_provider" },
    update: {},
    create: {
      key: "ai_provider",
      value: process.env.AI_PROVIDER || "openai"
    }
  });

  await prisma.appSetting.upsert({
    where: { key: "map_provider" },
    update: {},
    create: {
      key: "map_provider",
      value: process.env.MAP_PROVIDER || "kakao"
    }
  });

  await prisma.appSetting.upsert({
    where: { key: "storage_buckets" },
    update: {
      value: {
        reportAttachments: process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || null,
        contractorDocuments: process.env.SUPABASE_CONTRACTOR_DOCUMENTS_BUCKET || null
      }
    },
    create: {
      key: "storage_buckets",
      value: {
        reportAttachments: process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || null,
        contractorDocuments: process.env.SUPABASE_CONTRACTOR_DOCUMENTS_BUCKET || null
      }
    }
  });
}

const sampleIds = {
  customers: ["seed-customer-001", "seed-customer-002"],
  reports: ["seed-report-001", "seed-report-002", "seed-report-003"],
  contractorAccounts: ["seed-contractor-account-001", "seed-contractor-account-002"],
  contractorCompanies: ["seed-contractor-company-001", "seed-contractor-company-002"],
  templates: ["seed-template-assignment", "seed-template-info-request"]
};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function clearSampleData() {
  await prisma.messageTemplateUsage.deleteMany({
    where: {
      OR: [
        { reportId: { in: sampleIds.reports } },
        { templateId: { in: sampleIds.templates } }
      ]
    }
  });
  await prisma.workUpdate.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.assignment.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.bid.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.reportLocationCandidate.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.reportStatusHistory.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.reportRevision.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.aiAnalysis.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.reportAttachment.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.reportMessage.deleteMany({ where: { reportId: { in: sampleIds.reports } } });
  await prisma.report.deleteMany({ where: { id: { in: sampleIds.reports } } });
  await prisma.contractorCompany.deleteMany({ where: { id: { in: sampleIds.contractorCompanies } } });
  await prisma.contractorAccount.deleteMany({ where: { id: { in: sampleIds.contractorAccounts } } });
  await prisma.customer.deleteMany({ where: { id: { in: sampleIds.customers } } });
  await prisma.messageTemplateVersion.deleteMany({ where: { templateId: { in: sampleIds.templates } } });
  await prisma.messageTemplate.deleteMany({ where: { id: { in: sampleIds.templates } } });
}

async function seedMessageTemplates() {
  await prisma.messageTemplate.create({
    data: {
      id: "seed-template-assignment",
      name: "업체 배정 안내",
      channel: TemplateChannel.WEB,
      content:
        "{{customer_phone}} 고객님, {{issue_summary}} 신고에 {{company_name}} 업체가 배정되었습니다. 예상 견적은 {{estimated_price}}원이며 출동 가능 시간은 {{available_time}}입니다.",
      versions: {
        create: {
          versionNo: 1,
          content:
            "{{customer_phone}} 고객님, {{issue_summary}} 신고에 {{company_name}} 업체가 배정되었습니다. 예상 견적은 {{estimated_price}}원이며 출동 가능 시간은 {{available_time}}입니다."
        }
      }
    }
  });

  await prisma.messageTemplate.create({
    data: {
      id: "seed-template-info-request",
      name: "추가 정보 요청",
      channel: TemplateChannel.WEB,
      content:
        "정확한 업체 배정을 위해 {{missing_fields}} 정보를 추가로 알려주세요. 사진이나 영상을 첨부하면 더 정확하게 확인할 수 있습니다.",
      versions: {
        create: {
          versionNo: 1,
          content:
            "정확한 업체 배정을 위해 {{missing_fields}} 정보를 추가로 알려주세요. 사진이나 영상을 첨부하면 더 정확하게 확인할 수 있습니다."
        }
      }
    }
  });
}

async function seedCustomersAndReports() {
  await prisma.customer.createMany({
    data: [
      {
        id: "seed-customer-001",
        phone: "010-1000-2000",
        createdAt: minutesAgo(180),
        updatedAt: minutesAgo(30)
      },
      {
        id: "seed-customer-002",
        phone: "010-3000-4000",
        createdAt: minutesAgo(150),
        updatedAt: minutesAgo(20)
      }
    ]
  });

  await prisma.report.create({
    data: {
      id: "seed-report-001",
      reportNo: "BD-SEED-001",
      verificationCode: "123456",
      customerId: "seed-customer-001",
      channel: ReportChannel.WEB,
      status: ReportStatus.ADMIN_REVIEW,
      issueType: IssueType.SEWER_BACKFLOW,
      urgency: Urgency.URGENT,
      summary: "상가 앞 배수구 역류",
      description: "비가 온 뒤 상가 앞 배수구에서 물이 역류하고 있습니다.",
      customerPhone: "010-1000-2000",
      addressText: "서울특별시 강남구 역삼동",
      roadAddressText: "서울특별시 강남구 테헤란로",
      placeName: "역삼동 상가",
      latitude: "37.5006130",
      longitude: "127.0364310",
      locationProvider: MapProvider.KAKAO,
      locationProviderPlaceId: "seed-kakao-place-001",
      locationConfirmedAt: minutesAgo(170),
      locationConfirmedBy: LocationConfirmedBy.SYSTEM,
      createdAt: minutesAgo(180),
      updatedAt: minutesAgo(35)
    }
  });

  await prisma.report.create({
    data: {
      id: "seed-report-002",
      reportNo: "BD-SEED-002",
      verificationCode: "234567",
      customerId: "seed-customer-001",
      channel: ReportChannel.WEB,
      status: ReportStatus.BIDDING,
      issueType: IssueType.FLOOD,
      urgency: Urgency.EMERGENCY,
      summary: "지하 주차장 침수",
      description: "지하 1층 주차장 배수로가 막혀 물이 차오르고 있습니다.",
      customerPhone: "010-1000-2000",
      addressText: "경기도 성남시 분당구 정자동",
      roadAddressText: "경기도 성남시 분당구 정자일로",
      placeName: "정자동 오피스텔",
      latitude: "37.3703560",
      longitude: "127.1062820",
      locationProvider: MapProvider.KAKAO,
      locationProviderPlaceId: "seed-kakao-place-002",
      locationConfirmedAt: minutesAgo(130),
      locationConfirmedBy: LocationConfirmedBy.ADMIN,
      adminApprovedAt: minutesAgo(110),
      createdAt: minutesAgo(150),
      updatedAt: minutesAgo(40)
    }
  });

  await prisma.report.create({
    data: {
      id: "seed-report-003",
      reportNo: "BD-SEED-003",
      verificationCode: "345678",
      customerId: "seed-customer-002",
      channel: ReportChannel.WEB,
      status: ReportStatus.RESOLVED,
      issueType: IssueType.ODOR,
      urgency: Urgency.NORMAL,
      summary: "하수구 악취",
      description: "가게 내부 하수구에서 악취가 올라옵니다.",
      customerPhone: "010-3000-4000",
      addressText: "경기도 수원시 팔달구 인계동",
      roadAddressText: "경기도 수원시 팔달구 권광로",
      placeName: "인계동 음식점",
      latitude: "37.2635730",
      longitude: "127.0286010",
      locationProvider: MapProvider.KAKAO,
      locationProviderPlaceId: "seed-kakao-place-003",
      locationConfirmedAt: minutesAgo(300),
      locationConfirmedBy: LocationConfirmedBy.ADMIN,
      adminApprovedAt: minutesAgo(280),
      assignedAt: minutesAgo(250),
      resolvedAt: minutesAgo(70),
      createdAt: minutesAgo(320),
      updatedAt: minutesAgo(70)
    }
  });
}

async function seedReportDetails() {
  await prisma.reportMessage.createMany({
    data: [
      {
        reportId: "seed-report-001",
        senderType: SenderType.AI,
        messageType: MessageType.TEXT,
        content: "안녕하세요. 바로 뚫림입니다. 어떤 내용을 접수하시겠습니까?",
        createdAt: minutesAgo(179)
      },
      {
        reportId: "seed-report-001",
        senderType: SenderType.CUSTOMER,
        messageType: MessageType.TEXT,
        content: "상가 앞 배수구에서 물이 역류하고 있어요.",
        createdAt: minutesAgo(178)
      },
      {
        reportId: "seed-report-001",
        senderType: SenderType.AI,
        messageType: MessageType.TEXT,
        content: "위치와 긴급도를 확인했습니다. 관리자 검수로 전달하겠습니다.",
        createdAt: minutesAgo(176)
      },
      {
        reportId: "seed-report-002",
        senderType: SenderType.CUSTOMER,
        messageType: MessageType.TEXT,
        content: "지하 주차장에 물이 차오르고 있습니다. 긴급 출동이 필요합니다.",
        createdAt: minutesAgo(148)
      },
      {
        reportId: "seed-report-003",
        senderType: SenderType.CONTRACTOR,
        messageType: MessageType.TEXT,
        content: "트랩 청소와 배관 점검 완료했습니다.",
        createdAt: minutesAgo(75)
      }
    ]
  });

  await prisma.aiAnalysis.createMany({
    data: [
      {
        reportId: "seed-report-001",
        provider: AiProvider.OPENAI,
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        rawInput: { text: "상가 앞 배수구에서 물이 역류하고 있어요." },
        rawOutput: {
          summary: "상가 앞 배수구 역류",
          issueType: "SEWER_BACKFLOW",
          urgency: "URGENT"
        },
        summary: "상가 앞 배수구 역류",
        issueType: IssueType.SEWER_BACKFLOW,
        urgency: Urgency.URGENT,
        missingFields: [],
        vendorDescription: "상가 앞 외부 배수구에서 역류가 발생한 신고입니다.",
        confidence: "0.8700",
        needsReview: true,
        createdAt: minutesAgo(175)
      },
      {
        reportId: "seed-report-002",
        provider: AiProvider.OPENAI,
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        rawInput: { text: "지하 주차장에 물이 차오르고 있습니다." },
        rawOutput: {
          summary: "지하 주차장 침수",
          issueType: "FLOOD",
          urgency: "EMERGENCY"
        },
        summary: "지하 주차장 침수",
        issueType: IssueType.FLOOD,
        urgency: Urgency.EMERGENCY,
        missingFields: [],
        vendorDescription: "지하 주차장 침수로 긴급 배수 작업이 필요한 신고입니다.",
        confidence: "0.9300",
        needsReview: false,
        createdAt: minutesAgo(145)
      }
    ]
  });

  await prisma.reportLocationCandidate.createMany({
    data: [
      {
        reportId: "seed-report-001",
        provider: MapProvider.KAKAO,
        providerPlaceId: "seed-kakao-place-001",
        source: LocationSource.AI_CANDIDATE,
        title: "역삼동 상가",
        addressText: "서울특별시 강남구 역삼동",
        roadAddressText: "서울특별시 강남구 테헤란로",
        placeName: "역삼동 상가",
        category: "상가",
        latitude: "37.5006130",
        longitude: "127.0364310",
        confidence: "0.8100",
        raw: { seed: true },
        createdAt: minutesAgo(176)
      },
      {
        reportId: "seed-report-002",
        provider: MapProvider.KAKAO,
        providerPlaceId: "seed-kakao-place-002",
        source: LocationSource.ADMIN_CONFIRMED,
        title: "정자동 오피스텔",
        addressText: "경기도 성남시 분당구 정자동",
        roadAddressText: "경기도 성남시 분당구 정자일로",
        placeName: "정자동 오피스텔",
        category: "주거시설",
        latitude: "37.3703560",
        longitude: "127.1062820",
        confidence: "0.9500",
        raw: { seed: true },
        createdAt: minutesAgo(130)
      }
    ]
  });

  await prisma.reportStatusHistory.createMany({
    data: [
      {
        reportId: "seed-report-001",
        toStatus: ReportStatus.COLLECTING_INFO,
        actorType: ActorType.SYSTEM,
        reason: "신고 생성",
        createdAt: minutesAgo(180)
      },
      {
        reportId: "seed-report-001",
        fromStatus: ReportStatus.COLLECTING_INFO,
        toStatus: ReportStatus.AI_ANALYZED,
        actorType: ActorType.AI,
        reason: "AI 분석 완료",
        createdAt: minutesAgo(175)
      },
      {
        reportId: "seed-report-001",
        fromStatus: ReportStatus.AI_ANALYZED,
        toStatus: ReportStatus.ADMIN_REVIEW,
        actorType: ActorType.SYSTEM,
        reason: "관리자 검수 대기",
        createdAt: minutesAgo(174)
      },
      {
        reportId: "seed-report-002",
        toStatus: ReportStatus.BIDDING,
        actorType: ActorType.ADMIN,
        reason: "입찰 승인",
        createdAt: minutesAgo(110)
      },
      {
        reportId: "seed-report-003",
        toStatus: ReportStatus.RESOLVED,
        actorType: ActorType.CONTRACTOR,
        reason: "작업 완료",
        createdAt: minutesAgo(70)
      }
    ]
  });
}

async function seedContractorsAndBids() {
  await prisma.contractorAccount.create({
    data: {
      id: "seed-contractor-account-001",
      email: "partner-a@example.com",
      name: "김배수",
      phone: "010-5555-1000",
      company: {
        create: {
          id: "seed-contractor-company-001",
          companyName: "강남배수119",
          representativeName: "김배수",
          businessNumber: "123-45-67890",
          address: "서울특별시 강남구 역삼동",
          latitude: "37.5006130",
          longitude: "127.0364310",
          serviceRegions: ["서울", "경기"],
          serviceRadiusKm: 35,
          description: "하수구 역류와 상가 배수 긴급 출동 전문 업체입니다.",
          status: ContractorStatus.ACTIVE,
          approvedAt: minutesAgo(900),
          createdAt: minutesAgo(1200),
          updatedAt: minutesAgo(30)
        }
      }
    }
  });

  await prisma.contractorAccount.create({
    data: {
      id: "seed-contractor-account-002",
      email: "partner-b@example.com",
      name: "박뚫림",
      phone: "010-5555-2000",
      company: {
        create: {
          id: "seed-contractor-company-002",
          companyName: "수도권배관케어",
          representativeName: "박뚫림",
          businessNumber: "234-56-78901",
          address: "경기도 성남시 분당구",
          latitude: "37.3703560",
          longitude: "127.1062820",
          serviceRegions: ["경기"],
          serviceRadiusKm: 45,
          description: "침수, 악취, 배관 점검을 함께 처리합니다.",
          status: ContractorStatus.ACTIVE,
          approvedAt: minutesAgo(860),
          createdAt: minutesAgo(1180),
          updatedAt: minutesAgo(25)
        }
      }
    }
  });

  const bid1 = await prisma.bid.create({
    data: {
      reportId: "seed-report-002",
      contractorCompanyId: "seed-contractor-company-001",
      estimatedPrice: 180000,
      availableTime: minutesAgo(-60),
      canWork: true,
      workNote: "1시간 내 출동 가능, 배수펌프와 고압세척 장비 보유",
      extraCostPolicy: "심한 토사 유입 또는 장비 추가 시 현장 안내 후 추가 비용 협의",
      status: BidStatus.SUBMITTED,
      submittedAt: minutesAgo(95)
    }
  });

  await prisma.bid.create({
    data: {
      reportId: "seed-report-002",
      contractorCompanyId: "seed-contractor-company-002",
      estimatedPrice: 160000,
      availableTime: minutesAgo(-90),
      canWork: true,
      workNote: "90분 내 출동 가능, 주차장 배수로 점검 가능",
      extraCostPolicy: "야간 추가 출동비 발생 가능",
      status: BidStatus.SUBMITTED,
      submittedAt: minutesAgo(90)
    }
  });

  const resolvedBid = await prisma.bid.create({
    data: {
      reportId: "seed-report-003",
      contractorCompanyId: "seed-contractor-company-002",
      estimatedPrice: 90000,
      availableTime: minutesAgo(230),
      canWork: true,
      workNote: "악취 원인 확인 및 트랩 청소 가능",
      extraCostPolicy: "배관 내시경 필요 시 현장 안내",
      status: BidStatus.SELECTED,
      submittedAt: minutesAgo(260)
    }
  });

  const assignment = await prisma.assignment.create({
    data: {
      reportId: "seed-report-003",
      bidId: resolvedBid.id,
      contractorCompanyId: "seed-contractor-company-002",
      selectionReason: "견적과 출동 시간이 적합해 배정",
      customerMessageTemplateId: "seed-template-assignment",
      customerMessageRendered:
        "010-3000-4000 고객님, 하수구 악취 신고에 수도권배관케어 업체가 배정되었습니다. 예상 견적은 90000원이며 출동 가능 시간은 접수 후 90분입니다.",
      assignedAt: minutesAgo(250)
    }
  });

  await prisma.messageTemplateUsage.create({
    data: {
      templateId: "seed-template-assignment",
      reportId: "seed-report-003",
      assignmentId: assignment.id,
      renderedContent:
        "010-3000-4000 고객님, 하수구 악취 신고에 수도권배관케어 업체가 배정되었습니다. 예상 견적은 90000원이며 출동 가능 시간은 접수 후 90분입니다."
    }
  });

  await prisma.workUpdate.createMany({
    data: [
      {
        reportId: "seed-report-003",
        assignmentId: assignment.id,
        contractorCompanyId: "seed-contractor-company-002",
        status: WorkStatus.DISPATCH_SCHEDULED,
        note: "방문 일정 확정",
        createdAt: minutesAgo(240)
      },
      {
        reportId: "seed-report-003",
        assignmentId: assignment.id,
        contractorCompanyId: "seed-contractor-company-002",
        status: WorkStatus.DISPATCHED,
        note: "현장 도착",
        createdAt: minutesAgo(210)
      },
      {
        reportId: "seed-report-003",
        assignmentId: assignment.id,
        contractorCompanyId: "seed-contractor-company-002",
        status: WorkStatus.RESOLVED,
        note: "트랩 청소와 배관 점검 완료",
        finalPrice: 90000,
        createdAt: minutesAgo(70)
      }
    ]
  });

  await prisma.bid.update({
    where: { id: bid1.id },
    data: { status: BidStatus.SUBMITTED }
  });
}

async function seedSampleData() {
  if (process.env.NODE_ENV === "production" || process.env.SEED_SAMPLE_DATA === "false") {
    console.log("개발용 샘플 데이터 생성을 건너뜁니다.");
    return;
  }

  await clearSampleData();
  await seedMessageTemplates();
  await seedCustomersAndReports();
  await seedReportDetails();
  await seedContractorsAndBids();
}

async function main() {
  await seedSettings();
  await seedAdmin();
  await seedSampleData();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
