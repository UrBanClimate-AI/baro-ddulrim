import Link from "next/link";
import { ClipboardCheck, Clock3, Siren, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { KpiGrid, KpiTile } from "@/components/ui/kpi";
import { getDashboardSummary, getReports } from "@/lib/admin-api";
import {
  channelLabels,
  formatDateTime,
  formatMinutes,
  issueTypeLabels,
  labelOf,
  statusLabels,
  urgencyLabels,
} from "@/lib/labels";
import { Pill, reportStatusTone } from "@/components/ui/pill";

export const dynamic = "force-dynamic";

function BarList({ entries }: { entries: [string, number][] }) {
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <div className="bar-list">
      {entries.map(([label, count]) => (
        <div className="bar-line" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round((count / max) * 100)}%` }} />
          </div>
          <b>{count}건</b>
        </div>
      ))}
      {entries.length === 0 ? <p className="empty-text">데이터가 없습니다.</p> : null}
    </div>
  );
}

export default async function AdminPage() {
  const [summary, reports] = await Promise.all([getDashboardSummary(), getReports()]);
  const recentReports = reports.slice(0, 7);

  const issueEntries = Object.entries(summary.issueTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => [labelOf(issueTypeLabels, k), v] as [string, number]);
  const regionEntries = Object.entries(summary.regionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) as [string, number][];

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">관리자</p>
        <h1>운영 대시보드</h1>
      </header>

      <KpiGrid>
        <KpiTile
          icon={<ClipboardCheck aria-hidden="true" size={16} />}
          label="검수 대기"
          value={summary.adminReviewCount}
        />
        <KpiTile
          icon={<Clock3 aria-hidden="true" size={16} />}
          label="배분중"
          value={summary.biddingCount}
        />
        <KpiTile
          danger={summary.urgentCount > 0}
          icon={<Siren aria-hidden="true" size={16} />}
          label="긴급 신고"
          value={summary.urgentCount}
        />
        <KpiTile
          icon={<UsersRound aria-hidden="true" size={16} />}
          label="활동 업체"
          value={summary.activeContractors}
        />
      </KpiGrid>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: 16,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {/* 좌: 최근 신고 */}
        <section className="panel-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">실시간</p>
              <h2>최근 신고</h2>
            </div>
            <Link className="text-link" href="/admin/reports">
              신고 보드 열기
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentReports.map((report) => (
              <Link
                className={`report-card${
                  report.urgency === "URGENT" || report.urgency === "EMERGENCY" ? " urgent" : ""
                }`}
                href={`/admin/reports/${report.reportNo}`}
                key={report.id}
              >
                <span className="rc-top">
                  <span className="rc-no">{report.reportNo}</span>
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    {report.urgency !== "NORMAL" ? (
                      <span
                        className={`ui-pill ${report.urgency === "EMERGENCY" ? "tone-bad" : "tone-warn"}`}
                      >
                        {labelOf(urgencyLabels, report.urgency)}
                      </span>
                    ) : null}
                    <Pill tone={reportStatusTone(report.status)}>
                      {labelOf(statusLabels, report.status)}
                    </Pill>
                  </span>
                </span>
                <span className="rc-title">{report.summary ?? "요약 없음"}</span>
                <span className="rc-sub">
                  {report.placeName ?? report.roadAddressText ?? report.addressText ?? "-"}
                </span>
                <span className="rc-foot">
                  <span>{labelOf(channelLabels, report.channel)}</span>
                  <span>{formatDateTime(report.createdAt)}</span>
                </span>
              </Link>
            ))}
            {recentReports.length === 0 ? (
              <p className="empty-text">아직 접수된 신고가 없습니다.</p>
            ) : null}
          </div>
        </section>

        {/* 우: 분포 · 처리 시간 · 실적 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="panel-section">
            <h2>유형별 분포</h2>
            <div style={{ marginTop: 12 }}>
              <BarList entries={issueEntries} />
            </div>
          </section>

          <section className="panel-section">
            <h2>지역별 분포</h2>
            <div style={{ marginTop: 12 }}>
              <BarList entries={regionEntries} />
            </div>
          </section>

          <section className="panel-section">
            <h2>평균 처리 시간</h2>
            <div className="bar-list" style={{ marginTop: 12 }}>
              <div className="bar-line" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>접수 → 배분 승인</span>
                <b>{formatMinutes(summary.averageMinutes.approval)}</b>
              </div>
              <div className="bar-line" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>접수 → 업체 배정</span>
                <b>{formatMinutes(summary.averageMinutes.assignment)}</b>
              </div>
              <div className="bar-line" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>배정 → 해결</span>
                <b>{formatMinutes(summary.averageMinutes.resolution)}</b>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <h2>업체별 실적</h2>
            <div className="bar-list" style={{ marginTop: 12 }}>
              {summary.contractorStats.slice(0, 5).map((stats) => (
                <div
                  className="bar-line"
                  key={stats.companyId}
                  style={{ gridTemplateColumns: "1fr auto" }}
                >
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {stats.companyName}
                  </span>
                  <b>
                    배정 {stats.assignedCount} · 완료 {stats.resolvedCount}
                  </b>
                </div>
              ))}
              {summary.contractorStats.length === 0 ? (
                <p className="empty-text">배정 실적이 없습니다.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
