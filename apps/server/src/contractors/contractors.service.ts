import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { toIso, toNumber } from "../common/format";
import {
  ActorType,
  BidStatus,
  ContractorStatus,
  Prisma,
  ReportStatus,
  WorkStatus
} from "../generated/prisma/client";
import type { AuthAccount } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeSpecialties } from "./contractor-specialties";
import { RegisterContractorDto } from "./dto/register-contractor.dto";
import { SubmitBidDto } from "./dto/submit-bid.dto";
import { SubmitWorkUpdateDto } from "./dto/submit-work-update.dto";
import { UpdateContractorStatusDto } from "./dto/update-contractor-status.dto";

type ContractorUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type ContractorUploadFiles = {
  businessLicense?: ContractorUploadFile[];
  companyPhoto?: ContractorUploadFile[];
};

const usableContractorStatuses: ContractorStatus[] = [
  ContractorStatus.APPROVED,
  ContractorStatus.ACTIVE
];

const biddableReportStatuses: ReportStatus[] = [
  ReportStatus.APPROVED_FOR_BIDDING,
  ReportStatus.BIDDING
];

const reportStatusByWorkStatus: Record<WorkStatus, ReportStatus> = {
  [WorkStatus.DISPATCH_SCHEDULED]: ReportStatus.DISPATCH_SCHEDULED,
  [WorkStatus.DISPATCHED]: ReportStatus.DISPATCHED,
  [WorkStatus.IN_PROGRESS]: ReportStatus.IN_PROGRESS,
  [WorkStatus.RESOLVED]: ReportStatus.RESOLVED
};

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService
  ) {}

  /** 로그인한 업체 계정과 연결된 업체 프로필을 반환한다. */
  async getMyContext(account: AuthAccount) {
    const company = account.companyId
      ? await this.findCompanyProfile(account.companyId)
      : null;

    return {
      id: account.id,
      email: account.email,
      name: account.name,
      phone: account.phone,
      company
    };
  }

  /** 담당자 연락처만 수정한다. 그 외 계정/업체 정보는 이 경로로 바꿀 수 없다. */
  async updateAccountPhone(account: AuthAccount, phone: string) {
    const cleanPhone = this.requireCleanString(phone, "연락처를 입력해 주세요.");

    await this.prisma.contractorAccount.update({
      where: { id: account.id },
      data: { phone: cleanPhone }
    });

    return this.getMyContext({ ...account, phone: cleanPhone });
  }

  async registerCompany(
    account: AuthAccount,
    dto: RegisterContractorDto,
    files: ContractorUploadFiles
  ) {
    if (account.companyId) {
      throw new ConflictException("이미 업체 등록이 진행 중인 계정입니다.");
    }

    const phone = this.requireCleanString(dto.phone, "연락처를 입력해 주세요.");
    const companyName = this.requireCleanString(dto.companyName, "업체명을 입력해 주세요.");
    const representativeName = this.requireCleanString(
      dto.representativeName,
      "대표자 이름을 입력해 주세요."
    );
    // 담당자 이름은 별도 입력 없이 대표자명을 사용한다.
    const name = this.cleanString(dto.name) ?? representativeName;
    const businessNumber = this.requireCleanString(
      dto.businessNumber,
      "사업자 번호를 입력해 주세요."
    );

    const existingCompany = await this.prisma.contractorCompany.findUnique({
      where: { businessNumber }
    });

    if (existingCompany) {
      throw new ConflictException("이미 등록된 사업자 번호입니다.");
    }

    const businessLicenseFileUrl = await this.uploadContractorFile(
      businessNumber,
      "business-license",
      files.businessLicense?.[0] ?? null
    );
    const companyPhotoUrl = await this.uploadContractorFile(
      businessNumber,
      "company-photo",
      files.companyPhoto?.[0] ?? null
    );

    const company = await this.prisma.$transaction(async (tx) => {
      await tx.contractorAccount.update({
        where: { id: account.id },
        data: {
          name,
          phone
        }
      });

      const accountCompany = await tx.contractorCompany.findUnique({
        where: { accountId: account.id }
      });

      if (accountCompany) {
        throw new ConflictException("이미 업체 등록이 진행 중인 계정입니다.");
      }

      return tx.contractorCompany.create({
        data: {
          accountId: account.id,
          companyName,
          representativeName,
          businessNumber,
          businessLicenseFileUrl,
          companyPhotoUrl,
          address: this.cleanString(dto.address),
          addressDetail: this.cleanString(dto.addressDetail),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          serviceRegions: this.parseServiceRegions(dto.serviceRegions),
          serviceRadiusKm: dto.serviceRadiusKm ?? null,
          yearsOfExperience: dto.yearsOfExperience ?? null,
          specialties: sanitizeSpecialties(dto.specialties),
          description: this.cleanString(dto.description),
          status: ContractorStatus.REVIEWING,
          statusReason: "업체 등록 신청"
        },
        include: this.companyInclude()
      });
    });

    return this.serializeCompany(company);
  }

  async findCompaniesForAdmin() {
    const companies = await this.prisma.contractorCompany.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: this.companyInclude()
    });

    return companies.map((company) => this.serializeCompany(company));
  }

  async updateCompanyStatus(companyId: string, dto: UpdateContractorStatusDto) {
    const current = await this.prisma.contractorCompany.findUnique({
      where: { id: companyId }
    });

    if (!current) {
      throw new NotFoundException("업체를 찾을 수 없습니다.");
    }

    const company = await this.prisma.contractorCompany.update({
      where: { id: companyId },
      data: {
        status: dto.status,
        statusReason: this.cleanString(dto.statusReason),
        approvedAt:
          dto.status === ContractorStatus.APPROVED || dto.status === ContractorStatus.ACTIVE
            ? new Date()
            : undefined
      },
      include: this.companyInclude()
    });

    const becameApproved =
      (dto.status === ContractorStatus.APPROVED ||
        dto.status === ContractorStatus.ACTIVE) &&
      current.status !== ContractorStatus.APPROVED &&
      current.status !== ContractorStatus.ACTIVE;

    if (becameApproved) {
      await this.notifications.notifyContractorApproved({
        email: company.account.email,
        phone: company.account.phone,
        companyName: company.companyName
      });
    }

    return this.serializeCompany(company);
  }

  async findCompanies() {
    const companies = await this.prisma.contractorCompany.findMany({
      where: {
        status: {
          in: [ContractorStatus.APPROVED, ContractorStatus.ACTIVE]
        }
      },
      orderBy: [{ status: "asc" }, { companyName: "asc" }],
      include: {
        account: true,
        _count: {
          select: {
            bids: true,
            assignments: true,
            workUpdates: true
          }
        }
      }
    });

    return companies.map((company) => ({
      id: company.id,
      companyName: company.companyName,
      representativeName: company.representativeName,
      phone: company.account.phone,
      email: company.account.email,
      status: company.status,
      serviceRegions: company.serviceRegions,
      serviceRadiusKm: company.serviceRadiusKm,
      address: company.address,
      latitude: toNumber(company.latitude),
      longitude: toNumber(company.longitude),
      bidCount: company._count.bids,
      assignmentCount: company._count.assignments,
      workUpdateCount: company._count.workUpdates
    }));
  }

  async findCompanyProfile(companyId: string) {
    const company = await this.prisma.contractorCompany.findUnique({
      where: { id: companyId },
      include: this.companyInclude()
    });

    if (!company) {
      throw new NotFoundException("업체를 찾을 수 없습니다.");
    }

    return this.serializeCompany(company);
  }

  async findOpportunities(companyId: string) {
    const company = await this.findUsableCompany(companyId);
    const reports = await this.prisma.report.findMany({
      where: {
        status: {
          in: [ReportStatus.APPROVED_FOR_BIDDING, ReportStatus.BIDDING]
        },
        assignment: null
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      include: {
        bids: {
          where: {
            contractorCompanyId: company.id
          },
          orderBy: { submittedAt: "desc" },
          take: 1
        },
        _count: {
          select: {
            bids: true,
            attachments: true,
            messages: true
          }
        }
      }
    });

    return reports.map((report) => ({
      id: report.id,
      reportNo: report.reportNo,
      status: report.status,
      issueType: report.issueType,
      urgency: report.urgency,
      summary: report.summary,
      description: report.description,
      addressText: report.addressText,
      roadAddressText: report.roadAddressText,
      placeName: report.placeName,
      latitude: toNumber(report.latitude),
      longitude: toNumber(report.longitude),
      bidCount: report._count.bids,
      attachmentCount: report._count.attachments,
      messageCount: report._count.messages,
      createdAt: toIso(report.createdAt),
      adminApprovedAt: toIso(report.adminApprovedAt),
      myBid: report.bids[0] ? this.serializeBid(report.bids[0]) : null
    }));
  }

  async findBids(companyId: string) {
    const company = await this.findUsableCompany(companyId);
    const bids = await this.prisma.bid.findMany({
      where: {
        contractorCompanyId: company.id
      },
      orderBy: { submittedAt: "desc" },
      include: {
        report: {
          include: {
            assignment: {
              include: {
                contractorCompany: true
              }
            }
          }
        }
      }
    });

    return bids.map((bid) => ({
      ...this.serializeBid(bid),
      report: {
        id: bid.report.id,
        reportNo: bid.report.reportNo,
        status: bid.report.status,
        issueType: bid.report.issueType,
        urgency: bid.report.urgency,
        summary: bid.report.summary,
        placeName: bid.report.placeName,
        addressText: bid.report.addressText,
        assignedCompanyName: bid.report.assignment?.contractorCompany.companyName ?? null,
        createdAt: toIso(bid.report.createdAt),
        assignedAt: toIso(bid.report.assignedAt),
        resolvedAt: toIso(bid.report.resolvedAt)
      }
    }));
  }

  async findAssignments(companyId: string) {
    const company = await this.findUsableCompany(companyId);
    const assignments = await this.prisma.assignment.findMany({
      where: {
        contractorCompanyId: company.id
      },
      orderBy: { assignedAt: "desc" },
      include: {
        bid: true,
        report: true,
        workUpdates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return assignments.map((assignment) => this.serializeAssignment(assignment));
  }

  async submitBid(companyId: string, dto: SubmitBidDto) {
    const availableTime = this.parseAvailableTime(dto.availableTime);

    const bid = await this.prisma.$transaction(async (tx) => {
      const company = await tx.contractorCompany.findUnique({
        where: { id: companyId }
      });

      if (!company || !usableContractorStatuses.includes(company.status)) {
        throw new NotFoundException("입찰 가능한 업체를 찾을 수 없습니다.");
      }

      const report = await tx.report.findFirst({
        where: {
          OR: [{ id: dto.reportId }, { reportNo: dto.reportId }]
        },
        include: {
          assignment: true
        }
      });

      if (!report) {
        throw new NotFoundException("신고를 찾을 수 없습니다.");
      }

      if (report.assignment || !biddableReportStatuses.includes(report.status)) {
        throw new BadRequestException("현재 입찰할 수 없는 신고입니다.");
      }

      const existingBid = await tx.bid.findUnique({
        where: {
          reportId_contractorCompanyId: {
            reportId: report.id,
            contractorCompanyId: company.id
          }
        }
      });

      if (existingBid && existingBid.status !== BidStatus.SUBMITTED) {
        throw new ConflictException("이미 확정 처리된 입찰은 수정할 수 없습니다.");
      }

      const submittedBid = await tx.bid.upsert({
        where: {
          reportId_contractorCompanyId: {
            reportId: report.id,
            contractorCompanyId: company.id
          }
        },
        update: {
          estimatedPrice: dto.estimatedPrice ?? null,
          availableTime,
          canWork: dto.canWork ?? true,
          workNote: this.cleanString(dto.workNote),
          extraCostPolicy: this.cleanString(dto.extraCostPolicy),
          status: BidStatus.SUBMITTED,
          submittedAt: new Date()
        },
        create: {
          reportId: report.id,
          contractorCompanyId: company.id,
          estimatedPrice: dto.estimatedPrice ?? null,
          availableTime,
          canWork: dto.canWork ?? true,
          workNote: this.cleanString(dto.workNote),
          extraCostPolicy: this.cleanString(dto.extraCostPolicy),
          status: BidStatus.SUBMITTED
        }
      });

      if (report.status === ReportStatus.APPROVED_FOR_BIDDING) {
        await tx.report.update({
          where: { id: report.id },
          data: { status: ReportStatus.BIDDING }
        });

        await tx.reportStatusHistory.create({
          data: {
            reportId: report.id,
            fromStatus: report.status,
            toStatus: ReportStatus.BIDDING,
            actorType: ActorType.CONTRACTOR,
            reason: "업체 입찰 제출"
          }
        });
      }

      return submittedBid;
    });

    return this.serializeBid(bid);
  }

  async submitWorkUpdate(
    companyId: string,
    assignmentId: string,
    dto: SubmitWorkUpdateDto,
    photos: ContractorUploadFile[] = []
  ) {
    if (dto.status === WorkStatus.RESOLVED && dto.finalPrice == null) {
      throw new BadRequestException("해결 완료 처리에는 최종 금액이 필요합니다.");
    }

    const preloadedAssignment = await this.prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        contractorCompanyId: companyId
      },
      include: {
        report: true
      }
    });

    if (!preloadedAssignment) {
      throw new NotFoundException("배정 작업을 찾을 수 없습니다.");
    }

    // 업로드는 트랜잭션 밖에서 수행한다(외부 I/O로 트랜잭션을 붙잡지 않도록).
    const photoUrls = await this.uploadWorkPhotos(
      preloadedAssignment.report.reportNo,
      photos
    );

    const assignment = await this.prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.assignment.findFirst({
        where: {
          id: assignmentId,
          contractorCompanyId: companyId
        },
        include: {
          report: true
        }
      });

      if (!existingAssignment) {
        throw new NotFoundException("배정 작업을 찾을 수 없습니다.");
      }

      const nextReportStatus = reportStatusByWorkStatus[dto.status];
      const now = new Date();
      const note = this.cleanString(dto.note);

      await tx.workUpdate.create({
        data: {
          reportId: existingAssignment.reportId,
          assignmentId: existingAssignment.id,
          contractorCompanyId: existingAssignment.contractorCompanyId,
          status: dto.status,
          note,
          finalPrice: dto.status === WorkStatus.RESOLVED ? dto.finalPrice ?? null : null,
          photoUrls
        }
      });

      await tx.report.update({
        where: { id: existingAssignment.reportId },
        data: {
          status: nextReportStatus,
          resolvedAt: dto.status === WorkStatus.RESOLVED ? existingAssignment.report.resolvedAt ?? now : undefined
        }
      });

      if (existingAssignment.report.status !== nextReportStatus) {
        await tx.reportStatusHistory.create({
          data: {
            reportId: existingAssignment.reportId,
            fromStatus: existingAssignment.report.status,
            toStatus: nextReportStatus,
            actorType: ActorType.CONTRACTOR,
            reason: note ?? this.defaultWorkUpdateReason(dto.status)
          }
        });
      }

      return tx.assignment.findUniqueOrThrow({
        where: { id: existingAssignment.id },
        include: {
          bid: true,
          report: true,
          workUpdates: {
            orderBy: { createdAt: "asc" }
          }
        }
      });
    });

    return this.serializeAssignment(assignment);
  }

  private async findUsableCompany(companyId: string) {
    const company = await this.prisma.contractorCompany.findUnique({
      where: { id: companyId }
    });

    if (!company || !usableContractorStatuses.includes(company.status)) {
      throw new NotFoundException("입찰 가능한 업체를 찾을 수 없습니다.");
    }

    return company;
  }

  private companyInclude(): Prisma.ContractorCompanyInclude {
    return {
      account: true,
      _count: {
        select: {
          bids: true,
          assignments: true,
          workUpdates: true
        }
      }
    };
  }

  private serializeCompany(company: {
    id: string;
    companyName: string;
    representativeName: string;
    businessNumber: string;
    businessLicenseFileUrl: string | null;
    companyPhotoUrl: string | null;
    address: string | null;
    addressDetail: string | null;
    latitude: Parameters<typeof toNumber>[0];
    longitude: Parameters<typeof toNumber>[0];
    serviceRegions: string[];
    serviceRadiusKm: number | null;
    yearsOfExperience: number | null;
    specialties: string[];
    description: string | null;
    status: ContractorStatus;
    statusReason: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    account: {
      email: string;
      name: string;
      phone: string;
    };
    _count: {
      bids: number;
      assignments: number;
      workUpdates: number;
    };
  }) {
    return {
      id: company.id,
      companyName: company.companyName,
      representativeName: company.representativeName,
      businessNumber: company.businessNumber,
      businessLicenseFileUrl: company.businessLicenseFileUrl,
      companyPhotoUrl: company.companyPhotoUrl,
      addressDetail: company.addressDetail,
      managerName: company.account.name,
      phone: company.account.phone,
      email: company.account.email,
      status: company.status,
      statusReason: company.statusReason,
      serviceRegions: company.serviceRegions,
      serviceRadiusKm: company.serviceRadiusKm,
      yearsOfExperience: company.yearsOfExperience,
      specialties: company.specialties,
      description: company.description,
      address: company.address,
      latitude: toNumber(company.latitude),
      longitude: toNumber(company.longitude),
      bidCount: company._count.bids,
      assignmentCount: company._count.assignments,
      workUpdateCount: company._count.workUpdates,
      approvedAt: toIso(company.approvedAt),
      createdAt: toIso(company.createdAt),
      updatedAt: toIso(company.updatedAt)
    };
  }

  private async uploadContractorFile(
    businessNumber: string,
    kind: "business-license" | "company-photo",
    file: ContractorUploadFile | null
  ) {
    if (!file || file.size <= 0) {
      return null;
    }

    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    const bucketName = this.config.get<string>("SUPABASE_CONTRACTOR_DOCUMENTS_BUCKET");

    if (!supabaseUrl || !serviceRoleKey || !bucketName) {
      throw new BadRequestException("업체 문서 저장 환경변수가 설정되지 않았습니다.");
    }

    if (
      kind === "company-photo" &&
      !file.mimetype.startsWith("image/")
    ) {
      throw new BadRequestException("업체 사진은 이미지 파일만 등록할 수 있습니다.");
    }

    if (
      kind === "business-license" &&
      !file.mimetype.startsWith("image/") &&
      file.mimetype !== "application/pdf"
    ) {
      throw new BadRequestException("사업자등록증은 이미지 또는 PDF 파일만 등록할 수 있습니다.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const safeBusinessNumber = businessNumber.replace(/[^a-zA-Z0-9-]/g, "");
    const storagePath = `${safeBusinessNumber}/${kind}-${randomUUID()}${this.safeExtension(file)}`;
    const { error } = await supabase.storage.from(bucketName).upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

    if (error) {
      throw new BadRequestException(`업체 문서 업로드에 실패했습니다: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /** 완료/진행 사진을 신고 첨부 버킷의 work-updates 경로에 올린다. */
  private async uploadWorkPhotos(reportNo: string, photos: ContractorUploadFile[]) {
    const validPhotos = photos.filter((photo) => photo.size > 0);

    if (validPhotos.length === 0) {
      return [];
    }

    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    const bucketName = this.config.get<string>("SUPABASE_REPORT_ATTACHMENTS_BUCKET");

    if (!supabaseUrl || !serviceRoleKey || !bucketName) {
      throw new BadRequestException("사진 저장 환경변수가 설정되지 않았습니다.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    return Promise.all(
      validPhotos.map(async (photo, index) => {
        if (!photo.mimetype.startsWith("image/")) {
          throw new BadRequestException("작업 사진은 이미지 파일만 올릴 수 있습니다.");
        }

        const storagePath = `${reportNo}/work-updates/${Date.now()}-${index}-${randomUUID()}${this.safeExtension(photo)}`;
        const { error } = await supabase.storage.from(bucketName).upload(storagePath, photo.buffer, {
          contentType: photo.mimetype,
          upsert: false
        });

        if (error) {
          throw new BadRequestException(`작업 사진 업로드에 실패했습니다: ${error.message}`);
        }

        const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        return data.publicUrl;
      })
    );
  }

  private safeExtension(file: ContractorUploadFile) {
    const extension = extname(file.originalname).toLowerCase();

    if (extension && /^[a-z0-9.]+$/.test(extension)) {
      return extension;
    }

    if (file.mimetype === "application/pdf") {
      return ".pdf";
    }

    if (file.mimetype === "image/png") {
      return ".png";
    }

    if (file.mimetype === "image/webp") {
      return ".webp";
    }

    return ".jpg";
  }

  private parseServiceRegions(value: string | null | undefined) {
    return (
      this.cleanString(value)
        ?.split(/[,\n]/)
        .map((region) => region.trim())
        .filter(Boolean) ?? []
    );
  }

  private requireCleanString(value: string | null | undefined, message: string) {
    const cleaned = this.cleanString(value);

    if (!cleaned) {
      throw new BadRequestException(message);
    }

    return cleaned;
  }

  private serializeBid(bid: {
    id: string;
    reportId: string;
    contractorCompanyId: string;
    estimatedPrice: number | null;
    availableTime: Date | null;
    canWork: boolean;
    workNote: string | null;
    extraCostPolicy: string | null;
    status: BidStatus;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: bid.id,
      reportId: bid.reportId,
      contractorCompanyId: bid.contractorCompanyId,
      estimatedPrice: bid.estimatedPrice,
      availableTime: toIso(bid.availableTime),
      canWork: bid.canWork,
      workNote: bid.workNote,
      extraCostPolicy: bid.extraCostPolicy,
      status: bid.status,
      submittedAt: toIso(bid.submittedAt),
      createdAt: toIso(bid.createdAt),
      updatedAt: toIso(bid.updatedAt)
    };
  }

  private serializeAssignment(assignment: {
    id: string;
    reportId: string;
    bidId: string;
    contractorCompanyId: string;
    selectionReason: string | null;
    customerMessageRendered: string | null;
    assignedAt: Date;
    createdAt: Date;
    bid: {
      estimatedPrice: number | null;
      availableTime: Date | null;
      workNote: string | null;
      extraCostPolicy: string | null;
    };
    report: {
      id: string;
      reportNo: string;
      status: ReportStatus;
      issueType: string | null;
      urgency: string;
      summary: string | null;
      description: string | null;
      addressText: string | null;
      roadAddressText: string | null;
      placeName: string | null;
      latitude: Parameters<typeof toNumber>[0];
      longitude: Parameters<typeof toNumber>[0];
      assignedAt: Date | null;
      resolvedAt: Date | null;
      createdAt: Date;
    };
    workUpdates: Array<{
      id: string;
      status: WorkStatus;
      note: string | null;
      finalPrice: number | null;
      photoUrls: string[];
      createdAt: Date;
    }>;
  }) {
    const latestWorkUpdate = assignment.workUpdates.at(-1) ?? null;

    return {
      id: assignment.id,
      reportId: assignment.reportId,
      bidId: assignment.bidId,
      contractorCompanyId: assignment.contractorCompanyId,
      selectionReason: assignment.selectionReason,
      customerMessageRendered: assignment.customerMessageRendered,
      assignedAt: toIso(assignment.assignedAt),
      createdAt: toIso(assignment.createdAt),
      bid: {
        estimatedPrice: assignment.bid.estimatedPrice,
        availableTime: toIso(assignment.bid.availableTime),
        workNote: assignment.bid.workNote,
        extraCostPolicy: assignment.bid.extraCostPolicy
      },
      report: {
        id: assignment.report.id,
        reportNo: assignment.report.reportNo,
        status: assignment.report.status,
        issueType: assignment.report.issueType,
        urgency: assignment.report.urgency,
        summary: assignment.report.summary,
        description: assignment.report.description,
        addressText: assignment.report.addressText,
        roadAddressText: assignment.report.roadAddressText,
        placeName: assignment.report.placeName,
        latitude: toNumber(assignment.report.latitude),
        longitude: toNumber(assignment.report.longitude),
        assignedAt: toIso(assignment.report.assignedAt),
        resolvedAt: toIso(assignment.report.resolvedAt),
        createdAt: toIso(assignment.report.createdAt)
      },
      latestWorkStatus: latestWorkUpdate?.status ?? null,
      workUpdates: assignment.workUpdates.map((update) => ({
        id: update.id,
        status: update.status,
        note: update.note,
        finalPrice: update.finalPrice,
        photoUrls: update.photoUrls,
        createdAt: toIso(update.createdAt)
      }))
    };
  }

  private defaultWorkUpdateReason(status: WorkStatus) {
    const labels: Record<WorkStatus, string> = {
      [WorkStatus.DISPATCH_SCHEDULED]: "출동 예정",
      [WorkStatus.DISPATCHED]: "출동 완료",
      [WorkStatus.IN_PROGRESS]: "처리중",
      [WorkStatus.RESOLVED]: "해결 완료"
    };

    return labels[status];
  }

  private cleanString(value: string | null | undefined) {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseAvailableTime(value: string | null | undefined) {
    const cleaned = this.cleanString(value);

    if (!cleaned) {
      return null;
    }

    const parsed = new Date(cleaned);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("출동 가능 시간이 올바르지 않습니다.");
    }

    return parsed;
  }
}
