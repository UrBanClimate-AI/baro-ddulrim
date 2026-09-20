import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ReportDateFilter } from "@/components/report-date-filter";
import { getReports, type ReportListItem } from "@/lib/admin-api";
import { channelLabels, formatDateTime, labelOf, urgencyLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

// 상태 그룹 → 칸반 컬럼
const columns = [
  {
    key: "review",
    label: "검수중",
    dot: "var(--color-warning)",
    statuses: ["COLLECTING_INFO", "AI_ANALYZED", "ADMIN_REVIEW", "CUSTOMER_INFO_REQUIRED"],
  },
  {
    key: "bidding",
    label: "배분중",
    dot: "var(--color-primary)",
    statuses: ["APPROVED_FOR_BIDDING", "BIDDING", "AWAITING_ASSIGNMENT"],
  },
  {
    key: "working",
    label: "작업중",
    dot: "var(--color-accent)",
    statuses: ["ASSIGNED", "DISPATCH_SCHEDULED", "DISPATCHED", "IN_PROGRESS"],
  },
  { key: "resolved", label: "해결", dot: "var(--color-success)", statuses: ["RESOLVED"] },
  {
    key: "closed",
    label: "보류 · 종료",
    dot: "var(--color-muted)",
    statuses: ["ON_HOLD", "CANCELED", "REJECTED"],
  },
] as const;

function matchesDateRange(report: ReportListItem, from?: string, to?: string) {
  if (!report.createdAt) {
    return !from && !to;
  }

  const createdAt = new Date(report.createdAt).getTime();

  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    if (Number.isFinite(fromTime) && createdAt < fromTime) {
      return false;
    }
  }

  if (to) {
    const toTime = new Date(`${to}T23:59:59.999`).getTime();
    if (Number.isFinite(toTime) && createdAt > toTime) {
      return false;
    }
  }

  return true;
}

function isUrgent(report: ReportListItem) {
  return report.urgency === "URGENT" || report.urgency === "EMERGENCY";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; channel?: string }>;
}) {
  const params = await searchParams;

  // 기본 조회 기간: 최근 1개월 (KST). 사용자가 바꾸면 그대로 따르고,
  // 종료일만 오늘 이후를 막는다.
  const seoulDate = (date: Date) =>
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const today = seoulDate(now);

  const from = params.from?.trim() || seoulDate(monthAgo);
  const rawTo = params.to?.trim() || today;
  const to = rawTo > today ? today : rawTo;
  const channel = params.channel?.trim() || undefined;

  const reports = await getReports();
  const visible = reports.filter(
    (report) =>
      matchesDateRange(report, from, to) &&
      (channel ? report.channel === channel : true)
  );

  const channelQuery = (value?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (value) query.set("channel", value);
    const qs = query.toString();
    return qs ? `/admin/reports?${qs}` : "/admin/reports";
  };
  const channelChips = [
    { value: undefined, label: "전체" },
    { value: "WEB", label: "웹" },
    { value: "AI_CALL", label: "AI 전화" },
    { value: "KAKAO", label: "카카오톡" }
  ] as const;

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">신고 관리</p>
        <h1>신고 보드</h1>
      </header>

      <div className="report-filterbar-row">
        <ReportDateFilter channel={channel} from={from} maxTo={today} status="all" to={to} />
        <div className="mode-tabs channel-tabs" aria-label="접수 채널">
          {channelChips.map((chip) => (
            <Link
              className={`mode-tab${(channel ?? undefined) === chip.value ? " active" : ""}`}
              href={channelQuery(chip.value)}
              key={chip.label}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="kanban-board cols-5" style={{ marginTop: 16 }}>
        {columns.map((col) => {
          const cards = visible
            .filter((r) => (col.statuses as readonly string[]).includes(r.status))
            .sort((a, b) => {
              // 긴급 우선, 이후 최신순
              const urgentDiff = Number(isUrgent(b)) - Number(isUrgent(a));
              if (urgentDiff !== 0 && col.key !== "resolved" && col.key !== "closed") {
                return urgentDiff;
              }
              return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
            });

          return (
            <section aria-label={col.label} className="kanban-col" key={col.key}>
              <header className="kanban-col-head">
                <span className="col-title">
                  <span className="col-dot" style={{ background: col.dot }} />
                  {col.label}
                </span>
                <span className="col-count">{cards.length}</span>
              </header>
              <div className="kanban-col-body">
                {cards.length === 0 ? (
                  <p className="kanban-empty">해당 상태의 신고가 없습니다.</p>
                ) : null}
                {cards.map((report) => (
                  <Link
                    className={`report-card${isUrgent(report) ? " urgent" : ""}`}
                    href={`/admin/reports/${report.reportNo}`}
                    key={report.id}
                  >
                    <span className="rc-top">
                      <span className="rc-no">{report.reportNo}</span>
                      {isUrgent(report) ? (
                        <span
                          className={`ui-pill ${report.urgency === "EMERGENCY" ? "tone-bad" : "tone-warn"}`}
                        >
                          {labelOf(urgencyLabels, report.urgency)}
                        </span>
                      ) : null}
                    </span>
                    <span className="rc-title">{report.summary ?? "요약 없음"}</span>
                    <span className="rc-sub">
                      {report.placeName ?? report.roadAddressText ?? report.addressText ?? "-"}
                      {report.addressDetail ? ` · ${report.addressDetail}` : ""}
                    </span>
                    <span className="rc-foot">
                      <span>{labelOf(channelLabels, report.channel)}</span>
                      <span>{formatDateTime(report.createdAt)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
