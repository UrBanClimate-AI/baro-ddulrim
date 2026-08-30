import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  ActorType,
  OfferStatus,
  RejectReason,
  ReportStatus
} from "../generated/prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

export const SETTING_MODE = "distribution_mode"; // "auto" | "manual"
export const SETTING_TIMEOUT = "distribution_timeout_minutes"; // number

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async getMode(): Promise<"auto" | "manual"> {
    const s = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_MODE }
    });
    return (s?.value as string) === "manual" ? "manual" : "auto";
  }

  private async getTimeoutMinutes(): Promise<number> {
    const s = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_TIMEOUT }
    });
    const n = Number(s?.value);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  private sigunguCode(regionCode: string | null): string | null {
    if (!regionCode || regionCode.length < 5) return null;
    return regionCode.slice(0, 5) + "00000";
  }

  private distanceKm(
    lat1: number | null,
    lng1: number | null,
    lat2: number | null,
    lng2: number | null
  ): number {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return Number.POSITIVE_INFINITY;
    }
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** 배분 시작 — 승인 직후 호출. 자동이면 첫 제안, 수동이면 관리자 대기. */
  async startDistribution(reportId: string) {
    const mode = await this.getMode();
    if (mode === "auto") {
      return this.offerNext(reportId);
    }
    await this.setStatus(reportId, ReportStatus.AWAITING_ASSIGNMENT, ActorType.SYSTEM, "수동 배분 대기");
    return { mode, status: "awaiting_manual" as const };
  }

  /** 다음 후보(거리순)에게 제안. 후보 없으면 보류. */
  async offerNext(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true, regionCode: true, summary: true, reportNo: true,
        latitude: true, longitude: true, customerPhone: true
      }
    });
    if (!report) throw new NotFoundException("신고를 찾을 수 없습니다.");

    const sigungu = this.sigunguCode(report.regionCode);
    const already = await this.prisma.assignmentOffer.findMany({
      where: { reportId },
      select: { contractorCompanyId: true }
    });
    const excludeIds = already.map((o) => o.contractorCompanyId);

    const candidates = sigungu
      ? await this.prisma.contractorServiceArea.findMany({
          where: {
            regionCode: sigungu,
            contractorCompany: {
              status: "ACTIVE",
              id: { notIn: excludeIds.length ? excludeIds : undefined }
            }
          },
          select: {
            contractorCompany: {
              select: { id: true, companyName: true, latitude: true, longitude: true, account: { select: { email: true, phone: true } } }
            }
          }
        })
      : [];

    const ranked = candidates
      .map((c) => c.contractorCompany)
      .filter((c) => !excludeIds.includes(c.id))
      .map((c) => ({
        company: c,
        distance: this.distanceKm(
          this.num(report.latitude), this.num(report.longitude),
          this.num(c.latitude), this.num(c.longitude)
        )
      }))
      .sort((a, b) => a.distance - b.distance);

    if (ranked.length === 0) {
      await this.setStatus(reportId, ReportStatus.ON_HOLD, ActorType.SYSTEM, "배분 가능한 업체 없음");
      await this.notifications.notifyAdminHold(report.reportNo, report.summary, sigungu ? "전원 거절/무매칭" : "지역 정보 없음");
      return { status: "on_hold" as const };
    }

    const top = ranked[0];
    const timeout = await this.getTimeoutMinutes();
    const deadline = new Date(Date.now() + timeout * 60000);
    const seq = already.length + 1;

    const offer = await this.prisma.assignmentOffer.create({
      data: {
        reportId,
        contractorCompanyId: top.company.id,
        sequence: seq,
        distanceKm: Number.isFinite(top.distance) ? top.distance.toFixed(2) : null,
        status: OfferStatus.OFFERED,
        deadline
      }
    });

    await this.setStatus(reportId, ReportStatus.AWAITING_ASSIGNMENT, ActorType.SYSTEM, `제안 #${seq}: ${top.company.companyName}`);

    await this.notifications.notifyOffer(
      { email: top.company.account.email, phone: top.company.account.phone, companyName: top.company.companyName },
      { reportNo: report.reportNo, issueSummary: report.summary ?? "접수", deadline }
    );

    return { status: "offered" as const, offerId: offer.id, companyId: top.company.id, sequence: seq };
  }

  /** 수동 배분 — 관리자가 특정 업체에게 제안. */
  async offerToCompany(reportId: string, companyId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, reportNo: true, summary: true, latitude: true, longitude: true }
    });
    if (!report) throw new NotFoundException("신고를 찾을 수 없습니다.");

    const company = await this.prisma.contractorCompany.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, latitude: true, longitude: true, account: { select: { email: true, phone: true } } }
    });
    if (!company) throw new NotFoundException("업체를 찾을 수 없습니다.");

    const active = await this.prisma.assignmentOffer.findFirst({
      where: { reportId, status: OfferStatus.OFFERED }
    });
    if (active) {
      throw new BadRequestException("이미 진행 중인 제안이 있습니다.");
    }

    const count = await this.prisma.assignmentOffer.count({ where: { reportId } });
    const timeout = await this.getTimeoutMinutes();
    const deadline = new Date(Date.now() + timeout * 60000);
    const dist = this.distanceKm(
      this.num(report.latitude), this.num(report.longitude),
      this.num(company.latitude), this.num(company.longitude)
    );

    const offer = await this.prisma.assignmentOffer.create({
      data: {
        reportId,
        contractorCompanyId: companyId,
        sequence: count + 1,
        distanceKm: Number.isFinite(dist) ? dist.toFixed(2) : null,
        status: OfferStatus.OFFERED,
        deadline
      }
    });

    await this.setStatus(reportId, ReportStatus.AWAITING_ASSIGNMENT, ActorType.ADMIN, `수동 제안: ${company.companyName}`);
    await this.notifications.notifyOffer(
      { email: company.account.email, phone: company.account.phone, companyName: company.companyName },
      { reportNo: report.reportNo, issueSummary: report.summary ?? "접수", deadline }
    );
    return { status: "offered" as const, offerId: offer.id };
  }

  /** 업체 수락 → 배정 확정 */
  async acceptOffer(offerId: string, companyId: string) {
    const offer = await this.prisma.assignmentOffer.findUnique({
      where: { id: offerId },
      include: { report: { select: { id: true, reportNo: true, summary: true, customerPhone: true } }, contractorCompany: { select: { companyName: true, account: { select: { email: true, phone: true } } } } }
    });
    if (!offer || offer.contractorCompanyId !== companyId) {
      throw new NotFoundException("제안을 찾을 수 없습니다.");
    }
    if (offer.status !== OfferStatus.OFFERED) {
      throw new BadRequestException("이미 처리된 제안입니다.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.assignmentOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED, respondedAt: new Date() }
      });
      await tx.assignment.create({
        data: {
          reportId: offer.reportId,
          offerId: offer.id,
          contractorCompanyId: companyId,
          assignedAt: new Date()
        }
      });
      await tx.report.update({
        where: { id: offer.reportId },
        data: { status: ReportStatus.ASSIGNED, assignedAt: new Date() }
      });
      await tx.reportStatusHistory.create({
        data: { reportId: offer.reportId, toStatus: ReportStatus.ASSIGNED, actorType: ActorType.CONTRACTOR, reason: `${offer.contractorCompany.companyName} 수락` }
      });
    });

    const info = { reportNo: offer.report.reportNo, issueSummary: offer.report.summary ?? "접수", estimatedPrice: "미정", availableTime: "협의" };
    await Promise.all([
      this.notifications.notifyContractorAssigned(
        { email: offer.contractorCompany.account.email, phone: offer.contractorCompany.account.phone, companyName: offer.contractorCompany.companyName },
        info
      ),
      this.notifications.notifyCustomerAssigned(
        { phone: offer.report.customerPhone },
        { ...info, companyName: offer.contractorCompany.companyName }
      ),
      this.notifications.notifyAdminAssigned(offer.report.reportNo, offer.contractorCompany.companyName)
    ]);

    return { status: "assigned" as const };
  }

  /** 업체 거절 → 다음 단계 진행 */
  async rejectOffer(offerId: string, companyId: string, reason: RejectReason, detail: string | null) {
    const offer = await this.prisma.assignmentOffer.findUnique({
      where: { id: offerId },
      include: { report: { select: { reportNo: true } }, contractorCompany: { select: { companyName: true } } }
    });
    if (!offer || offer.contractorCompanyId !== companyId) {
      throw new NotFoundException("제안을 찾을 수 없습니다.");
    }
    if (offer.status !== OfferStatus.OFFERED) {
      throw new BadRequestException("이미 처리된 제안입니다.");
    }

    await this.prisma.assignmentOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.REJECTED, rejectReason: reason, rejectReasonDetail: detail, respondedAt: new Date() }
    });
    await this.notifications.notifyAdminRejected(offer.report.reportNo, offer.contractorCompany.companyName, reason);
    await this.advanceAfterDecline(offer.reportId);
    return { status: "rejected" as const };
  }

  private async advanceAfterDecline(reportId: string) {
    const mode = await this.getMode();
    if (mode === "auto") {
      return this.offerNext(reportId);
    }
    await this.setStatus(reportId, ReportStatus.AWAITING_ASSIGNMENT, ActorType.SYSTEM, "거절/무응답 — 수동 재배정 필요");
    return { status: "awaiting_manual" as const };
  }

  /** 타임아웃 스캔 (1분마다) */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimeouts() {
    const now = new Date();
    const expired = await this.prisma.assignmentOffer.findMany({
      where: { status: OfferStatus.OFFERED, deadline: { lt: now } },
      select: { id: true, reportId: true }
    });
    for (const o of expired) {
      await this.prisma.assignmentOffer.update({
        where: { id: o.id },
        data: { status: OfferStatus.TIMEOUT, respondedAt: now }
      });
      this.logger.log(`제안 타임아웃 → ${o.id}`);
      await this.advanceAfterDecline(o.reportId);
    }
  }

  /** 업체의 진행 중 제안 목록 (partner) */
  async getMyOffers(companyId: string) {
    const offers = await this.prisma.assignmentOffer.findMany({
      where: { contractorCompanyId: companyId, status: OfferStatus.OFFERED },
      orderBy: { offeredAt: "desc" },
      include: {
        report: {
          select: {
            reportNo: true, summary: true, description: true, issueType: true,
            urgency: true, addressText: true, roadAddressText: true, placeName: true
          }
        }
      }
    });
    return offers.map((o) => ({
      id: o.id,
      sequence: o.sequence,
      distanceKm: o.distanceKm ? Number(o.distanceKm) : null,
      deadline: o.deadline.toISOString(),
      offeredAt: o.offeredAt.toISOString(),
      report: {
        reportNo: o.report.reportNo,
        summary: o.report.summary,
        description: o.report.description,
        issueType: o.report.issueType,
        urgency: o.report.urgency,
        placeName: o.report.placeName ?? o.report.roadAddressText ?? o.report.addressText
      }
    }));
  }

  /** 신고의 제안 이력 (admin) */
  async getReportOffers(reportId: string) {
    const offers = await this.prisma.assignmentOffer.findMany({
      where: { reportId },
      orderBy: { sequence: "asc" },
      include: { contractorCompany: { select: { companyName: true } } }
    });
    return offers.map((o) => ({
      id: o.id,
      sequence: o.sequence,
      companyName: o.contractorCompany.companyName,
      distanceKm: o.distanceKm ? Number(o.distanceKm) : null,
      status: o.status,
      rejectReason: o.rejectReason,
      rejectReasonDetail: o.rejectReasonDetail,
      offeredAt: o.offeredAt.toISOString(),
      deadline: o.deadline.toISOString(),
      respondedAt: o.respondedAt ? o.respondedAt.toISOString() : null
    }));
  }

  private num(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private async setStatus(reportId: string, status: ReportStatus, actor: ActorType, reason: string) {
    const current = await this.prisma.report.findUnique({ where: { id: reportId }, select: { status: true } });
    await this.prisma.report.update({ where: { id: reportId }, data: { status } });
    await this.prisma.reportStatusHistory.create({
      data: { reportId, fromStatus: current?.status, toStatus: status, actorType: actor, reason }
    });
  }
}
