import { Injectable } from "@nestjs/common";
import { toIso, toNumber } from "../common/format";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const customerReportInclude = {
  assignment: {
    include: {
      contractorCompany: true,
      bid: true
    }
  },
  statusHistory: {
    orderBy: { createdAt: "asc" as const }
  },
  workUpdates: {
    orderBy: { createdAt: "asc" as const },
    include: {
      contractorCompany: true
    }
  },
  _count: {
    select: {
      attachments: true,
      messages: true,
      bids: true
    }
  }
} satisfies Prisma.ReportInclude;

type CustomerReportRecord = Prisma.ReportGetPayload<{ include: typeof customerReportInclude }>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findReportsByPhone(phone: string) {
    const normalizedPhone = phone.trim();
    const reports = await this.prisma.report.findMany({
      where: {
        customerPhone: normalizedPhone
      },
      orderBy: { createdAt: "desc" },
      include: customerReportInclude
    });

    return reports.map((report) => this.serializeReport(report));
  }

  async findReportByVerification(reportNo: string, verificationCode: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        reportNo: reportNo.trim(),
        verificationCode: verificationCode.trim()
      },
      include: customerReportInclude
    });

    return report ? this.serializeReport(report) : null;
  }

  private serializeReport(report: CustomerReportRecord) {
    return {
      id: report.id,
      reportNo: report.reportNo,
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
      createdAt: toIso(report.createdAt),
      adminApprovedAt: toIso(report.adminApprovedAt),
      assignedAt: toIso(report.assignedAt),
      resolvedAt: toIso(report.resolvedAt),
      updatedAt: toIso(report.updatedAt),
      attachmentCount: report._count.attachments,
      messageCount: report._count.messages,
      bidCount: report._count.bids,
      assignment: report.assignment
        ? {
            id: report.assignment.id,
            contractorCompanyName: report.assignment.contractorCompany.companyName,
            estimatedPrice: report.assignment.bid?.estimatedPrice ?? null,
            availableTime: toIso(report.assignment.bid?.availableTime ?? null),
            selectionReason: report.assignment.selectionReason,
            customerMessageRendered: report.assignment.customerMessageRendered,
            assignedAt: toIso(report.assignment.assignedAt)
          }
        : null,
      statusHistory: report.statusHistory.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        actorType: history.actorType,
        reason: history.reason,
        createdAt: toIso(history.createdAt)
      })),
      workUpdates: report.workUpdates.map((update) => ({
        id: update.id,
        contractorCompanyName: update.contractorCompany.companyName,
        status: update.status,
        note: update.note,
        finalPrice: update.finalPrice,
        photoUrls: update.photoUrls,
        createdAt: toIso(update.createdAt)
      }))
    };
  }
}
