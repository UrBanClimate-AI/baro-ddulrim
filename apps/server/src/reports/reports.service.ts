import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { toIso, toNumber } from "../common/format";
import {
  ActorType,
  BidStatus,
  IssueType,
  LocationConfirmedBy,
  MapProvider,
  MessageType,
  Prisma,
  ReportChannel,
  ReportStatus,
  SenderType,
  TemplateChannel,
  Urgency,
} from "../generated/prisma/client";
import { AiAnalysisService } from "../ai/ai-analysis.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MapsService } from "../maps/maps.service";
import { DistributionService } from "../distribution/distribution.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerReportDto } from "./dto/create-customer-report.dto";
import {
  ApproveReportDto,
  AssignReportDto,
  UpdateReportDto,
} from "./dto/report-actions.dto";

type ReportUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly aiAnalysis: AiAnalysisService,
    private readonly maps: MapsService,
    private readonly distribution: DistributionService,
  ) {}

  async createFromCustomer(
    dto: CreateCustomerReportDto,
    files: ReportUploadFile[],
  ) {
    const phone = this.requireCleanString(dto.phone, "연락처를 입력해 주세요.");
    const location = this.requireCleanString(
      dto.location,
      "위치를 입력해 주세요.",
    );
    const description = this.requireCleanString(
      dto.description,
      "증상을 입력해 주세요.",
    );
    const reportNo = await this.generateReportNo();
    const verificationCode = await this.generateVerificationCode();

    // AI 분석을 우선 시도하고, 실패하면 규칙 기반으로 폴백한다.
    const ai = await this.aiAnalysis.analyzeReport({ location, description });
    const inferredIssueType =
      ai?.issueType ?? this.inferIssueType(`${location} ${description}`);
    // 고객이 직접 고른 긴급도가 항상 우선한다.
    const inferredUrgency =
      dto.urgency ?? ai?.urgency ?? this.inferUrgency(`${location} ${description}`);
    const summary =
      this.cleanString(dto.summary) ??
      ai?.summary ??
      this.summarizeDescription(description);
    const missingFields =
      ai?.missingFields ?? this.findMissingFields({ location, description });
    // 부족한 정보는 관리자가 전화/문자로 확인한다. 접수는 항상 검수로 넘긴다.
    const nextStatus = ReportStatus.ADMIN_REVIEW;
    const aiProvider =
      ai?.provider ?? (await this.aiAnalysis.getConfiguredProvider());

    // 좌표가 있으면 법정동코드(b_code)를 미리 조회 (지역 배분 매칭용)
    const regionCode =
      dto.latitude != null && dto.longitude != null
        ? await this.maps.regionCodeFromCoord(dto.latitude, dto.longitude)
        : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone },
        update: {},
        create: { phone },
      });

      const report = await tx.report.create({
        data: {
          reportNo,
          verificationCode,
          customerId: customer.id,
          customerPhone: phone,
          channel: ReportChannel.WEB,
          status: nextStatus,
          issueType: inferredIssueType,
          urgency: inferredUrgency,
          summary,
          description,
          addressText: location,
          roadAddressText: this.cleanString(dto.roadAddressText),
          placeName: this.cleanString(dto.placeName),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          regionCode,
          locationProvider:
            dto.latitude != null && dto.longitude != null
              ? MapProvider.KAKAO
              : null,
          locationConfirmedAt:
            dto.latitude != null && dto.longitude != null ? new Date() : null,
          locationConfirmedBy:
            dto.latitude != null && dto.longitude != null
              ? LocationConfirmedBy.CUSTOMER
              : null,
          marketingConsentAt:
            dto.marketingConsent === "true" ? new Date() : null,
        },
      });

      const message = await tx.reportMessage.create({
        data: {
          reportId: report.id,
          senderType: SenderType.CUSTOMER,
          messageType: MessageType.TEXT,
          content: description,
        },
      });

      await tx.aiAnalysis.create({
        data: {
          reportId: report.id,
          provider: aiProvider,
          model: ai?.model ?? "rule-based-intake",
          rawInput: {
            phone,
            location,
            description,
          },
          rawOutput: (ai?.rawOutput as Prisma.InputJsonValue) ?? {
            source: "local-rule",
            note: "AI 호출 실패 또는 미설정으로 규칙 기반 분류를 사용했습니다.",
          },
          summary,
          issueType: inferredIssueType,
          urgency: inferredUrgency,
          missingFields,
          vendorDescription:
            ai?.vendorDescription ??
            this.buildVendorDescription({
              summary,
              description,
              location,
              urgency: inferredUrgency,
            }),
          confidence: ai?.confidence ?? 0.62,
          needsReview: true,
        },
      });

      await tx.reportStatusHistory.createMany({
        data: [
          {
            reportId: report.id,
            fromStatus: null,
            toStatus: ReportStatus.COLLECTING_INFO,
            actorType: ActorType.CUSTOMER,
            reason: "웹 신고 접수",
          },
          {
            reportId: report.id,
            fromStatus: ReportStatus.COLLECTING_INFO,
            toStatus: ReportStatus.AI_ANALYZED,
            actorType: ActorType.AI,
            reason: ai ? "AI 분석 완료" : "규칙 기반 자동 분류",
          },
          {
            reportId: report.id,
            fromStatus: ReportStatus.AI_ANALYZED,
            toStatus: nextStatus,
            actorType: ActorType.SYSTEM,
            reason: "관리자 검수 대기",
          },
        ],
      });

      return { report, messageId: message.id };
    });

    await this.uploadReportAttachments(
      created.report.id,
      created.report.reportNo,
      created.messageId,
      files,
    );

    // 관리자 텔레그램 — 신규 신고 접수
    await this.notifications.notifyAdminNewReport(
      created.report.reportNo,
      summary,
    );

    return this.findOne(created.report.reportNo);
  }

  async findAll() {
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        bids: {
          include: {
            contractorCompany: true,
          },
        },
        assignment: {
          include: {
            contractorCompany: true,
          },
        },
        _count: {
          select: {
            messages: true,
            attachments: true,
            bids: true,
            workUpdates: true,
          },
        },
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reportNo: report.reportNo,
      customerPhone: report.customerPhone,
      channel: report.channel,
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
      messageCount: report._count.messages,
      attachmentCount: report._count.attachments,
      workUpdateCount: report._count.workUpdates,
      assignedCompanyName:
        report.assignment?.contractorCompany.companyName ?? null,
      minEstimatedPrice: this.getMinBidPrice(report.bids),
      createdAt: toIso(report.createdAt),
      adminApprovedAt: toIso(report.adminApprovedAt),
      assignedAt: toIso(report.assignedAt),
      resolvedAt: toIso(report.resolvedAt),
      updatedAt: toIso(report.updatedAt),
    }));
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        OR: [{ id }, { reportNo: id }],
      },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        aiAnalyses: {
          orderBy: { createdAt: "desc" },
        },
        revisions: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
        locationCandidates: {
          orderBy: { createdAt: "desc" },
        },
        bids: {
          orderBy: { submittedAt: "desc" },
          include: {
            contractorCompany: true,
          },
        },
        assignment: {
          include: {
            contractorCompany: true,
            bid: true,
          },
        },
        workUpdates: {
          orderBy: { createdAt: "asc" },
          include: {
            contractorCompany: true,
          },
        },
      },
    });

    if (!report) {
      return null;
    }

    return {
      id: report.id,
      reportNo: report.reportNo,
      verificationCode: report.verificationCode,
      customerPhone: report.customerPhone,
      channel: report.channel,
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
      assignedCompanyName:
        report.assignment?.contractorCompany.companyName ?? null,
      createdAt: toIso(report.createdAt),
      adminApprovedAt: toIso(report.adminApprovedAt),
      assignedAt: toIso(report.assignedAt),
      resolvedAt: toIso(report.resolvedAt),
      updatedAt: toIso(report.updatedAt),
      messages: report.messages.map((message) => ({
        id: message.id,
        senderType: message.senderType,
        messageType: message.messageType,
        content: message.content,
        createdAt: toIso(message.createdAt),
      })),
      attachments: report.attachments.map((attachment) => ({
        id: attachment.id,
        fileType: attachment.fileType,
        fileUrl: attachment.fileUrl,
        originalName: attachment.originalName,
        createdAt: toIso(attachment.createdAt),
      })),
      aiAnalyses: report.aiAnalyses.map((analysis) => ({
        id: analysis.id,
        provider: analysis.provider,
        model: analysis.model,
        summary: analysis.summary,
        issueType: analysis.issueType,
        urgency: analysis.urgency,
        missingFields: analysis.missingFields,
        vendorDescription: analysis.vendorDescription,
        confidence: toNumber(analysis.confidence),
        needsReview: analysis.needsReview,
        createdAt: toIso(analysis.createdAt),
      })),
      revisions: report.revisions.map((revision) => ({
        id: revision.id,
        editorType: revision.editorType,
        fieldName: revision.fieldName,
        oldValue: revision.oldValue,
        newValue: revision.newValue,
        reason: revision.reason,
        createdAt: toIso(revision.createdAt),
      })),
      statusHistory: report.statusHistory.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        actorType: history.actorType,
        reason: history.reason,
        createdAt: toIso(history.createdAt),
      })),
      locationCandidates: report.locationCandidates.map((candidate) => ({
        id: candidate.id,
        provider: candidate.provider,
        title: candidate.title,
        addressText: candidate.addressText,
        roadAddressText: candidate.roadAddressText,
        placeName: candidate.placeName,
        category: candidate.category,
        latitude: toNumber(candidate.latitude),
        longitude: toNumber(candidate.longitude),
        confidence: toNumber(candidate.confidence),
        createdAt: toIso(candidate.createdAt),
      })),
      bids: report.bids.map((bid) => ({
        id: bid.id,
        contractorCompanyId: bid.contractorCompanyId,
        contractorCompanyName: bid.contractorCompany.companyName,
        estimatedPrice: bid.estimatedPrice,
        availableTime: toIso(bid.availableTime),
        canWork: bid.canWork,
        workNote: bid.workNote,
        extraCostPolicy: bid.extraCostPolicy,
        status: bid.status,
        submittedAt: toIso(bid.submittedAt),
      })),
      assignment: report.assignment
        ? {
            id: report.assignment.id,
            contractorCompanyName:
              report.assignment.contractorCompany.companyName,
            selectionReason: report.assignment.selectionReason,
            customerMessageRendered: report.assignment.customerMessageRendered,
            assignedAt: toIso(report.assignment.assignedAt),
          }
        : null,
      workUpdates: report.workUpdates.map((update) => ({
        id: update.id,
        contractorCompanyName: update.contractorCompany.companyName,
        status: update.status,
        note: update.note,
        finalPrice: update.finalPrice,
        photoUrls: update.photoUrls,
        createdAt: toIso(update.createdAt),
      })),
    };
  }

  async update(id: string, dto: UpdateReportDto) {
    const report = await this.findReportRecord(id);
    const updateData: Prisma.ReportUpdateInput = {};
    const changes: Array<{
      fieldName: string;
      oldValue: string;
      newValue: string;
    }> = [];
    const reason = this.cleanString(dto.reason) ?? "관리자 신고 내용 수정";

    this.applyStringField(updateData, changes, dto, "summary", report.summary);
    this.applyStringField(
      updateData,
      changes,
      dto,
      "description",
      report.description,
    );
    this.applyStringField(
      updateData,
      changes,
      dto,
      "addressText",
      report.addressText,
    );
    this.applyStringField(
      updateData,
      changes,
      dto,
      "roadAddressText",
      report.roadAddressText,
    );
    this.applyStringField(
      updateData,
      changes,
      dto,
      "placeName",
      report.placeName,
    );
    this.applyEnumField(
      updateData,
      changes,
      dto,
      "issueType",
      report.issueType,
    );
    this.applyEnumField(updateData, changes, dto, "urgency", report.urgency);
    this.applyNumberField(
      updateData,
      changes,
      dto,
      "latitude",
      toNumber(report.latitude),
    );
    this.applyNumberField(
      updateData,
      changes,
      dto,
      "longitude",
      toNumber(report.longitude),
    );

    const touchedLocation = [
      "addressText",
      "roadAddressText",
      "placeName",
      "latitude",
      "longitude",
    ].some((fieldName) => this.has(dto, fieldName));

    if (touchedLocation) {
      updateData.locationConfirmedAt = new Date();
      updateData.locationConfirmedBy = LocationConfirmedBy.ADMIN;
      updateData.locationProvider =
        report.locationProvider ?? MapProvider.KAKAO;
    }

    if (changes.length === 0 && Object.keys(updateData).length === 0) {
      return this.findOne(report.reportNo);
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.report.update({
          where: { id: report.id },
          data: updateData,
        });
      }

      if (changes.length > 0) {
        await tx.reportRevision.createMany({
          data: changes.map((change) => ({
            reportId: report.id,
            editorType: ActorType.ADMIN,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            reason,
          })),
        });
      }
    });

    return this.findOne(report.reportNo);
  }

  async approveForBidding(id: string, dto: ApproveReportDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: {
          OR: [{ id }, { reportNo: id }],
        },
      });

      if (!report) {
        throw new NotFoundException("신고를 찾을 수 없습니다.");
      }

      const disallowedStatuses: ReportStatus[] = [
        ReportStatus.ASSIGNED,
        ReportStatus.RESOLVED,
        ReportStatus.CANCELED,
        ReportStatus.REJECTED,
      ];

      if (disallowedStatuses.includes(report.status)) {
        throw new BadRequestException(
          "이미 배정, 해결, 취소, 반려된 신고는 입찰 승인할 수 없습니다.",
        );
      }

      const nextStatus = ReportStatus.AWAITING_ASSIGNMENT;
      const reason = this.cleanString(dto.reason) ?? "관리자 배분 승인";
      const now = new Date();

      const nextReport = await tx.report.update({
        where: { id: report.id },
        data: {
          status: nextStatus,
          adminApprovedAt: report.adminApprovedAt ?? now,
        },
      });

      if (report.status !== nextStatus) {
        await tx.reportStatusHistory.create({
          data: {
            reportId: report.id,
            fromStatus: report.status,
            toStatus: nextStatus,
            actorType: ActorType.ADMIN,
            reason,
          },
        });
      }

      await tx.aiAnalysis.updateMany({
        where: { reportId: report.id },
        data: { needsReview: false },
      });

      return nextReport;
    });

    // 승인 후 배분 시작 (자동: 첫 제안 / 수동: 관리자 대기)
    await this.distribution.startDistribution(updated.id);

    return this.findOne(updated.reportNo);
  }

  async assignContractor(id: string, dto: AssignReportDto, adminId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: {
          OR: [{ id }, { reportNo: id }],
        },
        include: {
          assignment: true,
        },
      });

      if (!report) {
        throw new NotFoundException("신고를 찾을 수 없습니다.");
      }

      if (report.assignment) {
        throw new ConflictException("이미 업체가 배정된 신고입니다.");
      }

      const bid = await tx.bid.findUnique({
        where: { id: dto.bidId },
        include: {
          contractorCompany: {
            include: { account: true },
          },
        },
      });

      if (!bid || bid.reportId !== report.id) {
        throw new BadRequestException("해당 신고의 입찰을 찾을 수 없습니다.");
      }

      if (!bid.canWork || bid.status !== BidStatus.SUBMITTED) {
        throw new BadRequestException("선택할 수 없는 입찰입니다.");
      }

      const now = new Date();
      const template = await this.findAssignmentTemplate(tx, dto.templateId);
      const webBaseUrl =
        this.config.get<string>("PUBLIC_WEB_BASE_URL")?.replace(/\/$/, "") ??
        "http://localhost:3000";
      const renderedMessage = this.renderTemplate(
        template?.versions[0]?.content ??
          template?.content ??
          this.defaultAssignmentTemplate(),
        {
          customer_phone: report.customerPhone,
          report_no: report.reportNo,
          issue_summary: report.summary ?? "접수",
          company_name: bid.contractorCompany.companyName,
          estimated_price: bid.estimatedPrice
            ? this.formatNumber(bid.estimatedPrice)
            : "미정",
          available_time: bid.availableTime
            ? this.formatDateTimeKo(bid.availableTime)
            : "미정",
          extra_cost_policy: this.cleanString(bid.extraCostPolicy) ?? "없음",
          status_url: `${webBaseUrl}/report/${encodeURIComponent(report.reportNo)}?verificationCode=${encodeURIComponent(report.verificationCode)}`,
        },
      );

      await tx.bid.update({
        where: { id: bid.id },
        data: { status: BidStatus.SELECTED },
      });

      await tx.bid.updateMany({
        where: {
          reportId: report.id,
          id: { not: bid.id },
          status: BidStatus.SUBMITTED,
        },
        data: { status: BidStatus.REJECTED },
      });

      const assignment = await tx.assignment.create({
        data: {
          reportId: report.id,
          bidId: bid.id,
          contractorCompanyId: bid.contractorCompanyId,
          assignedByAdminId: adminId ?? null,
          selectionReason: this.cleanString(dto.selectionReason),
          customerMessageTemplateId: template?.id,
          customerMessageRendered: renderedMessage,
          assignedAt: now,
        },
      });

      if (template) {
        await tx.messageTemplateUsage.create({
          data: {
            templateId: template.id,
            templateVersionId: template.versions[0]?.id,
            reportId: report.id,
            assignmentId: assignment.id,
            renderedContent: renderedMessage,
          },
        });
      }

      await tx.reportMessage.create({
        data: {
          reportId: report.id,
          senderType: SenderType.SYSTEM,
          messageType: MessageType.SYSTEM,
          content: renderedMessage,
        },
      });

      const nextReport = await tx.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.ASSIGNED,
          assignedAt: now,
        },
      });

      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: report.status,
          toStatus: ReportStatus.ASSIGNED,
          actorType: ActorType.ADMIN,
          actorId: adminId ?? null,
          reason: this.cleanString(dto.selectionReason) ?? "관리자 업체 배정",
        },
      });

      return {
        nextReport,
        notify: {
          contractor: {
            email: bid.contractorCompany.account.email,
            phone: bid.contractorCompany.account.phone,
            companyName: bid.contractorCompany.companyName,
          },
          customer: {
            phone: report.customerPhone,
          },
          info: {
            reportNo: report.reportNo,
            issueSummary: report.summary ?? "접수",
            estimatedPrice: bid.estimatedPrice
              ? this.formatNumber(bid.estimatedPrice)
              : "미정",
            availableTime: bid.availableTime
              ? this.formatDateTimeKo(bid.availableTime)
              : "미정",
          },
        },
      };
    });

    const { notify } = updated;

    await Promise.all([
      this.notifications.notifyContractorAssigned(
        notify.contractor,
        notify.info,
      ),
      this.notifications.notifyCustomerAssigned(notify.customer, {
        ...notify.info,
        companyName: notify.contractor.companyName,
      }),
    ]);

    return this.findOne(updated.nextReport.reportNo);
  }

  private getMinBidPrice(bids: Array<{ estimatedPrice: number | null }>) {
    const prices = bids
      .map((bid) => bid.estimatedPrice)
      .filter((price): price is number => typeof price === "number");

    return prices.length > 0 ? Math.min(...prices) : null;
  }

  private async generateReportNo() {
    const dateSegment = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .replace(/\D/g, "");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = Math.floor(1000 + Math.random() * 9000).toString();
      const reportNo = `BD-${dateSegment}-${suffix}`;
      const exists = await this.prisma.report.findUnique({
        where: { reportNo },
      });

      if (!exists) {
        return reportNo;
      }
    }

    return `BD-${dateSegment}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async generateVerificationCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const exists = await this.prisma.report.findFirst({
        where: { verificationCode },
      });

      if (!exists) {
        return verificationCode;
      }
    }

    return randomUUID().replace(/\D/g, "").slice(0, 6).padEnd(6, "0");
  }

  private requireCleanString(
    value: string | null | undefined,
    message: string,
  ) {
    const cleaned = this.cleanString(value);

    if (!cleaned) {
      throw new BadRequestException(message);
    }

    return cleaned;
  }

  private findMissingFields(values: {
    description: string | null;
    location: string | null;
  }) {
    const missingFields: string[] = [];

    if (!this.cleanString(values.location)) {
      missingFields.push("위치");
    }

    if (!this.cleanString(values.description)) {
      missingFields.push("증상");
    }

    return missingFields;
  }

  private inferIssueType(text: string): IssueType {
    if (/침수|물\s*차|물바다|잠김/.test(text)) {
      return IssueType.FLOOD;
    }

    if (/역류|넘치|오수/.test(text)) {
      return IssueType.SEWER_BACKFLOW;
    }

    if (/악취|냄새|하수구\s*냄새/.test(text)) {
      return IssueType.ODOR;
    }

    if (/긴급|출동/.test(text)) {
      return IssueType.EMERGENCY;
    }

    if (/배수|하수|막힘|막혔|뚫/.test(text)) {
      return IssueType.DRAIN;
    }

    return IssueType.OTHER;
  }

  private inferUrgency(text: string): Urgency {
    if (/긴급|침수|지하|물\s*차|영업\s*중단/.test(text)) {
      return Urgency.EMERGENCY;
    }

    if (/역류|넘치|오수|악취/.test(text)) {
      return Urgency.URGENT;
    }

    return Urgency.NORMAL;
  }

  private summarizeDescription(description: string) {
    const normalized = description.replace(/\s+/g, " ").trim();

    if (normalized.length <= 48) {
      return normalized;
    }

    return `${normalized.slice(0, 48)}...`;
  }

  private buildVendorDescription(values: {
    description: string;
    location: string;
    summary: string;
    urgency: Urgency;
  }) {
    return [
      `요약: ${values.summary}`,
      `위치: ${values.location}`,
      `긴급도: ${values.urgency}`,
      `상세: ${values.description}`,
    ].join("\n");
  }

  private async uploadReportAttachments(
    reportId: string,
    reportNo: string,
    messageId: string,
    files: ReportUploadFile[],
  ) {
    const validFiles = files.filter((file) => file.size > 0);

    if (validFiles.length === 0) {
      return;
    }

    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    const bucketName = this.config.get<string>(
      "SUPABASE_REPORT_ATTACHMENTS_BUCKET",
    );

    if (!supabaseUrl || !serviceRoleKey || !bucketName) {
      throw new BadRequestException(
        "첨부 파일 저장 환경변수가 설정되지 않았습니다.",
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const attachments = await Promise.all(
      validFiles.map(async (file, index) => {
        if (
          !file.mimetype.startsWith("image/") &&
          !file.mimetype.startsWith("video/")
        ) {
          throw new BadRequestException(
            "사진 또는 영상 파일만 첨부할 수 있습니다.",
          );
        }

        const extension = this.safeExtension(file);
        const storagePath = `${reportNo}/${Date.now()}-${index}-${randomUUID()}${extension}`;
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) {
          throw new BadRequestException(
            `첨부 파일 업로드에 실패했습니다: ${error.message}`,
          );
        }

        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        return {
          reportId,
          messageId,
          fileType: file.mimetype,
          fileUrl: data.publicUrl,
          originalName: file.originalname,
        };
      }),
    );

    await this.prisma.reportAttachment.createMany({
      data: attachments,
    });
  }

  private safeExtension(file: ReportUploadFile) {
    const extension = extname(file.originalname).toLowerCase();

    if (extension && /^[a-z0-9.]+$/.test(extension)) {
      return extension;
    }

    if (file.mimetype === "image/png") {
      return ".png";
    }

    if (file.mimetype === "image/webp") {
      return ".webp";
    }

    if (file.mimetype.startsWith("video/")) {
      return ".mp4";
    }

    return ".jpg";
  }

  private async findReportRecord(id: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        OR: [{ id }, { reportNo: id }],
      },
    });

    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다.");
    }

    return report;
  }

  private has(source: object, fieldName: string) {
    return (source as Record<string, unknown>)[fieldName] !== undefined;
  }

  private cleanString(value: string | null | undefined) {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private revisionValue(value: unknown) {
    if (value == null) {
      return "";
    }

    return String(value);
  }

  private pushChange(
    changes: Array<{ fieldName: string; oldValue: string; newValue: string }>,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    const serializedOldValue = this.revisionValue(oldValue);
    const serializedNewValue = this.revisionValue(newValue);

    if (serializedOldValue !== serializedNewValue) {
      changes.push({
        fieldName,
        oldValue: serializedOldValue,
        newValue: serializedNewValue,
      });
    }
  }

  private applyStringField(
    updateData: Prisma.ReportUpdateInput,
    changes: Array<{ fieldName: string; oldValue: string; newValue: string }>,
    dto: UpdateReportDto,
    fieldName:
      | "summary"
      | "description"
      | "addressText"
      | "roadAddressText"
      | "placeName",
    oldValue: string | null,
  ) {
    if (!this.has(dto, fieldName)) {
      return;
    }

    const newValue = this.cleanString(dto[fieldName]);
    updateData[fieldName] = newValue;
    this.pushChange(changes, fieldName, oldValue, newValue);
  }

  private applyEnumField(
    updateData: Prisma.ReportUpdateInput,
    changes: Array<{ fieldName: string; oldValue: string; newValue: string }>,
    dto: UpdateReportDto,
    fieldName: "issueType" | "urgency",
    oldValue: string | null,
  ) {
    if (!this.has(dto, fieldName)) {
      return;
    }

    const newValue = dto[fieldName] ?? null;

    if (fieldName === "issueType") {
      updateData.issueType = newValue as IssueType | null;
    } else if (newValue) {
      updateData.urgency = newValue as Urgency;
    }

    this.pushChange(changes, fieldName, oldValue, newValue);
  }

  private applyNumberField(
    updateData: Prisma.ReportUpdateInput,
    changes: Array<{ fieldName: string; oldValue: string; newValue: string }>,
    dto: UpdateReportDto,
    fieldName: "latitude" | "longitude",
    oldValue: number | null,
  ) {
    if (!this.has(dto, fieldName)) {
      return;
    }

    const newValue = dto[fieldName] ?? null;
    updateData[fieldName] = newValue;
    this.pushChange(changes, fieldName, oldValue, newValue);
  }

  private async findAssignmentTemplate(
    tx: Prisma.TransactionClient,
    templateId: string | null | undefined,
  ) {
    if (templateId) {
      return tx.messageTemplate.findFirst({
        where: {
          id: templateId,
          isActive: true,
        },
        include: {
          versions: {
            orderBy: { versionNo: "desc" },
            take: 1,
          },
        },
      });
    }

    const assignmentTemplate = await tx.messageTemplate.findFirst({
      where: {
        channel: TemplateChannel.WEB,
        isActive: true,
        name: "업체 배정 안내",
      },
      include: {
        versions: {
          orderBy: { versionNo: "desc" },
          take: 1,
        },
      },
    });

    if (assignmentTemplate) {
      return assignmentTemplate;
    }

    return tx.messageTemplate.findFirst({
      where: {
        channel: TemplateChannel.WEB,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
      include: {
        versions: {
          orderBy: { versionNo: "desc" },
          take: 1,
        },
      },
    });
  }

  private defaultAssignmentTemplate() {
    return "{{customer_phone}} 고객님, {{issue_summary}} 신고에 {{company_name}} 업체가 배정되었습니다. 예상 견적은 {{estimated_price}}이며 출동 가능 시간은 {{available_time}}입니다.";
  }

  private renderTemplate(template: string, values: Record<string, string>) {
    const rendered = Object.entries(values).reduce(
      (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
      template,
    );

    return rendered.replaceAll("미정원", "미정");
  }

  private formatNumber(value: number) {
    return new Intl.NumberFormat("ko-KR").format(value);
  }

  private formatDateTimeKo(value: Date) {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  }
}
