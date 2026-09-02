import Link from "next/link";
import { ClipboardCheck, Clock3, MapPinned, TimerReset, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getDashboardSummary, getReports } from "@/lib/admin-api";
import {
  channelLabels,
  formatDateTime,
  formatMinutes,
  issueTypeLabels,
  labelOf,
  statusLabels,
  statusTone,
  urgencyLabels
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [summary, reports] = await Promise.all([getDashboardSummary(), getReports()]);
  const metrics = [
    { label: "검수 대기", value: summary.adminReviewCount, icon: ClipboardCheck },
    { label: "배분중", value: summary.biddingCount, icon: Clock3 },
    { label: "활동 업체", value: summary.activeContractors, icon: UsersRound },
    { label: "지도 마커", value: summary.mapMarkerCount, icon: MapPinned }
  ];
  const recentReports = reports.slice(0, 5);

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">관리자</p>
        <h1>운영 대시보드</h1>
      </header>

      <section className="dashboard-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric" key={metric.label}>
              <Icon aria-hidden="true" size={20} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid compact">
        <article className="metric">
          <TimerReset aria-hidden="true" size={20} />
          <span>평균 승인 시간</span>
          <strong>{formatMinutes(summary.averageMinutes.approval)}</strong>
        </article>
        <article className="metric">
          <TimerReset aria-hidden="true" size={20} />
          <span>평균 배정 시간</span>
          <strong>{formatMinutes(summary.averageMinutes.assignment)}</strong>
        </article>
        <article className="metric">
          <TimerReset aria-hidden="true" size={20} />
          <span>평균 처리 시간</span>
          <strong>{formatMinutes(summary.averageMinutes.resolution)}</strong>
        </article>
        <article className="metric">
          <ClipboardCheck aria-hidden="true" size={20} />
          <span>전체 신고</span>
          <strong>{summary.totalReports}</strong>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>유형별 신고</h2>
          <div className="stat-bar-list">
            {Object.entries(summary.issueTypeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([issueType, count]) => (
                <div className="stat-bar-row" key={issueType}>
                  <span>{labelOf(issueTypeLabels, issueType)}</span>
                  <strong>{count}건</strong>
                </div>
              ))}
            {Object.keys(summary.issueTypeCounts).length === 0 ? (
              <p className="empty-text">데이터가 없습니다.</p>
            ) : null}
          </div>
        </article>

        <article className="panel-section">
          <h2>지역별 신고</h2>
          <div className="stat-bar-list">
            {Object.entries(summary.regionCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([region, count]) => (
                <div className="stat-bar-row" key={region}>
                  <span>{region}</span>
                  <strong>{count}건</strong>
                </div>
              ))}
            {Object.keys(summary.regionCounts).length === 0 ? (
              <p className="empty-text">데이터가 없습니다.</p>
            ) : null}
          </div>
        </article>

        <article className="panel-section">
          <h2>업체별 실적</h2>
          <div className="stat-bar-list">
            {summary.contractorStats.map((stats) => (
              <div className="stat-bar-row" key={stats.companyId}>
                <span>{stats.companyName}</span>
                <strong>
                  배정 {stats.assignedCount} · 완료 {stats.resolvedCount}
                </strong>
              </div>
            ))}
            {summary.contractorStats.length === 0 ? (
              <p className="empty-text">배정 실적이 없습니다.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">실시간</p>
            <h2>최근 신고</h2>
          </div>
          <Link className="text-link" href="/admin/reports">
            전체 보기
          </Link>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>접수번호</th>
                <th>내용</th>
                <th>유형</th>
                <th>긴급도</th>
                <th>상태</th>
                <th>채널</th>
                <th>접수</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((report) => (
                <tr key={report.id}>
                  <td data-label="접수번호">
                    <Link className="table-link" href={`/admin/reports/${report.reportNo}`}>
                      {report.reportNo}
                    </Link>
                  </td>
                  <td data-label="내용">
                    <strong>{report.summary ?? "요약 없음"}</strong>
                    <span>{report.placeName ?? report.addressText ?? "-"}</span>
                  </td>
                  <td data-label="유형">{labelOf(issueTypeLabels, report.issueType)}</td>
                  <td data-label="긴급도">
                    <span className={`urgency-badge ${report.urgency.toLowerCase()}`}>
                      {labelOf(urgencyLabels, report.urgency)}
                    </span>
                  </td>
                  <td data-label="상태">
                    <span className={`status-badge ${statusTone(report.status)}`}>
                      {labelOf(statusLabels, report.status)}
                    </span>
                  </td>
                  <td data-label="채널">{labelOf(channelLabels, report.channel)}</td>
                  <td data-label="접수">{formatDateTime(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
