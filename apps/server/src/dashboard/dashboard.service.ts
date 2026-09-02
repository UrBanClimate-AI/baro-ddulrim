import { Injectable } from "@nestjs/common";
import { ReportStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ClassificationReport = {
  id: string;
  reportNo: string;
  issueType: string | null;
  urgency: string | null;
  aiAnalyses: Array<{ issueType: string | null; urgency: string | null }>;
  revisions: Array<{
    fieldName: string;
    reason: string | null;
    createdAt: Date;
  }>;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [reports, activeContractors] = await Promise.all([
      this.prisma.report.findMany({
        include: {
          assignment: {
            include: {
              contractorCompany: true
            }
          },
          workUpdates: true
        }
      }),
      this.prisma.contractorCompany.count({
        where: {
          status: "ACTIVE"
        }
      })
    ]);

    const statusCounts = reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.status] = (acc[report.status] ?? 0) + 1;
      return acc;
    }, {});

    const channelCounts = reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.channel] = (acc[report.channel] ?? 0) + 1;
      return acc;
    }, {});

    const issueTypeCounts = reports.reduce<Record<string, number>>((acc, report) => {
      const key = report.issueType ?? "UNKNOWN";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    // 지역은 주소 첫 토큰(시/도) 기준으로 집계한다.
    const regionCounts = reports.reduce<Record<string, number>>((acc, report) => {
      const region = report.addressText?.trim().split(/\s+/)[0] ?? "미확인";
      acc[region] = (acc[region] ?? 0) + 1;
      return acc;
    }, {});

    const contractorStatsMap = new Map<
      string,
      { companyName: string; assignedCount: number; resolvedCount: number }
    >();

    for (const report of reports) {
      const company = report.assignment?.contractorCompany;

      if (!company) {
        continue;
      }

      const stats = contractorStatsMap.get(company.id) ?? {
        companyName: company.companyName,
        assignedCount: 0,
        resolvedCount: 0
      };
      stats.assignedCount += 1;

      if (report.resolvedAt) {
        stats.resolvedCount += 1;
      }

      contractorStatsMap.set(company.id, stats);
    }

    const contractorStats = Array.from(contractorStatsMap.entries())
      .map(([companyId, stats]) => ({ companyId, ...stats }))
      .sort((a, b) => b.assignedCount - a.assignedCount)
      .slice(0, 10);

    const urgentCount = reports.filter((report) => report.urgency !== "NORMAL").length;
    const mapMarkerCount = reports.filter(
      (report) => report.latitude !== null && report.longitude !== null
    ).length;
    const adminReviewCount =
      (statusCounts[ReportStatus.ADMIN_REVIEW] ?? 0) +
      (statusCounts[ReportStatus.CUSTOMER_INFO_REQUIRED] ?? 0);
    // 배분중(제안 대기 포함) — 역경매 제거 후 AWAITING_ASSIGNMENT가 주 상태
    const biddingCount =
      (statusCounts[ReportStatus.APPROVED_FOR_BIDDING] ?? 0) +
      (statusCounts[ReportStatus.BIDDING] ?? 0) +
      (statusCounts[ReportStatus.AWAITING_ASSIGNMENT] ?? 0);
    const assignedCount = reports.filter((report) => report.assignedAt).length;
    const resolvedCount = reports.filter((report) => report.resolvedAt).length;

    return {
      totalReports: reports.length,
      adminReviewCount,
      biddingCount,
      assignedCount,
      resolvedCount,
      urgentCount,
      activeContractors,
      mapMarkerCount,
      statusCounts,
      channelCounts,
      issueTypeCounts,
      regionCounts,
      contractorStats,
      averageMinutes: {
        approval: this.averageMinutes(
          reports
            .filter((report) => report.adminApprovedAt)
            .map((report) => [report.createdAt, report.adminApprovedAt] as const)
        ),
        assignment: this.averageMinutes(
          reports
            .filter((report) => report.assignedAt)
            .map((report) => [report.createdAt, report.assignedAt] as const)
        ),
        resolution: this.averageMinutes(
          reports
            .filter((report) => report.assignedAt && report.resolvedAt)
            .map((report) => [report.assignedAt, report.resolvedAt] as const)
        )
      }
    };
  }

  /**
   * AI 분류 성능 — AI가 최초 예측한 값(AiAnalysis) 대비 관리자가 확정한 최종값을
   * 정답으로 보고 정확도/오분류를 집계한다. 문의유형·긴급도를 각각 계산한다.
   */
  async getClassificationPerformance() {
    const reports = await this.prisma.report.findMany({
      select: {
        id: true,
        reportNo: true,
        issueType: true,
        urgency: true,
        aiAnalyses: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { issueType: true, urgency: true }
        },
        revisions: {
          where: { fieldName: { in: ["issueType", "urgency"] } },
          orderBy: { createdAt: "desc" },
          select: {
            fieldName: true,
            oldValue: true,
            newValue: true,
            reason: true,
            createdAt: true
          }
        }
      }
    });

    const issueType = this.buildFieldPerformance(
      reports,
      "issueType",
      (r) => r.aiAnalyses[0]?.issueType ?? null,
      (r) => r.issueType
    );
    const urgency = this.buildFieldPerformance(
      reports,
      "urgency",
      (r) => r.aiAnalyses[0]?.urgency ?? null,
      (r) => r.urgency
    );

    return { issueType, urgency };
  }

  private buildFieldPerformance(
    reports: ClassificationReport[],
    field: "issueType" | "urgency",
    aiValueOf: (r: ClassificationReport) => string | null,
    finalValueOf: (r: ClassificationReport) => string | null
  ) {
    let total = 0;
    let correct = 0;
    const confusion = new Map<string, number>();
    const byLabel = new Map<string, { total: number; correct: number }>();
    const cases: Array<{
      reportNo: string;
      aiValue: string;
      finalValue: string;
      reason: string | null;
      changedAt: string | null;
    }> = [];

    for (const report of reports) {
      const ai = aiValueOf(report);
      if (!ai) continue; // AI가 분류하지 않은 건은 정확도 대상에서 제외
      const final = finalValueOf(report) ?? ai;

      total += 1;
      const label = byLabel.get(ai) ?? { total: 0, correct: 0 };
      label.total += 1;

      if (ai === final) {
        correct += 1;
        label.correct += 1;
      } else {
        const key = `${ai}→${final}`;
        confusion.set(key, (confusion.get(key) ?? 0) + 1);
        const revision = report.revisions.find((rev) => rev.fieldName === field);
        cases.push({
          reportNo: report.reportNo,
          aiValue: ai,
          finalValue: final,
          reason: revision?.reason ?? null,
          changedAt: revision?.createdAt
            ? revision.createdAt.toISOString()
            : null
        });
      }

      byLabel.set(ai, label);
    }

    const misclassified = total - correct;

    return {
      total,
      correct,
      misclassified,
      accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
      byLabel: [...byLabel.entries()]
        .map(([label, v]) => ({
          label,
          total: v.total,
          correct: v.correct,
          accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : null
        }))
        .sort((a, b) => b.total - a.total),
      confusion: [...confusion.entries()]
        .map(([pair, count]) => {
          const [from, to] = pair.split("→");
          return { from, to, count };
        })
        .sort((a, b) => b.count - a.count),
      cases: cases.sort((a, b) =>
        (b.changedAt ?? "").localeCompare(a.changedAt ?? "")
      )
    };
  }

  private averageMinutes(pairs: ReadonlyArray<readonly [Date | null, Date | null]>) {
    const durations = pairs
      .filter((pair): pair is readonly [Date, Date] => Boolean(pair[0] && pair[1]))
      .map(([from, to]) => Math.max(0, to.getTime() - from.getTime()) / 60000);

    if (durations.length === 0) {
      return null;
    }

    return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);
  }
}
