import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import {
  approveReportAction,
  assignBidAction,
  updateReportAction,
} from "@/app/admin/reports/actions";
import type { MessageTemplate, ReportDetail } from "@/lib/admin-api";
import {
  actorLabels,
  bidStatusLabels,
  channelLabels,
  formatCurrency,
  formatDateTime,
  issueTypeLabels,
  labelOf,
  reportFieldLabels,
  statusLabels,
  urgencyLabels,
} from "@/lib/labels";

const issueOptions = [
  "FLOOD",
  "DRAIN",
  "SEWER_BACKFLOW",
  "ODOR",
  "EMERGENCY",
  "OTHER",
];
const urgencyOptions = ["NORMAL", "URGENT", "EMERGENCY"];
const closedStatuses = ["ASSIGNED", "RESOLVED", "CANCELED", "REJECTED"];

type ReportSection = "overview" | "review" | "bids" | "messages" | "history";

function formatRevisionValue(value: string | number | boolean | null) {
  if (value == null || value === "") {
    return "-";
  }

  return String(value);
}

export function AdminReportHeader({
  active,
  report,
}: {
  active: ReportSection;
  report: ReportDetail;
}) {
  const tabs = [
    {
      href: `/admin/reports/${report.reportNo}`,
      key: "overview",
      label: "요약",
    },
    {
      href: `/admin/reports/${report.reportNo}/review`,
      key: "review",
      label: "검수",
    },
    {
      href: `/admin/reports/${report.reportNo}/bids`,
      key: "bids",
      label: "배분",
    },
    {
      href: `/admin/reports/${report.reportNo}/messages`,
      key: "messages",
      label: "상담",
    },
    {
      href: `/admin/reports/${report.reportNo}/history`,
      key: "history",
      label: "이력",
    },
  ] as const;

  return (
    <>
      <div className="back-row">
        <Link className="text-link" href="/admin/reports">
          <ArrowLeft aria-hidden="true" size={16} />
          신고 목록
        </Link>
      </div>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{report.reportNo}</p>
          <h1>{report.summary ?? "신고 상세"}</h1>
          <p>{report.description ?? "상세 설명이 없습니다."}</p>
        </div>
        <div className="header-badges">
          <span className="status-badge">
            {labelOf(statusLabels, report.status)}
          </span>
          <span className={`urgency-badge ${report.urgency.toLowerCase()}`}>
            {labelOf(urgencyLabels, report.urgency)}
          </span>
        </div>
      </header>

      <nav className="detail-tabs" aria-label="신고 상세 메뉴">
        {tabs.map((tab) => (
          <Link
            aria-current={tab.key === active ? "page" : undefined}
            className={`detail-tab ${tab.key === active ? "active" : ""}`}
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function AdminReportOverview({ report }: { report: ReportDetail }) {
  const latestWorkUpdate = report.workUpdates.at(-1);

  return (
    <>
      <section className="detail-grid">
        <article className="panel-section">
          <h2>신고 정보</h2>
          <dl className="info-list">
            <div>
              <dt>연락처</dt>
              <dd>{report.customerPhone}</dd>
            </div>
            <div>
              <dt>채널</dt>
              <dd>{labelOf(channelLabels, report.channel)}</dd>
            </div>
            <div>
              <dt>유형</dt>
              <dd>{labelOf(issueTypeLabels, report.issueType)}</dd>
            </div>
            <div>
              <dt>접수 시각</dt>
              <dd>{formatDateTime(report.createdAt)}</dd>
            </div>
            <div>
              <dt>배정 업체</dt>
              <dd>{report.assignedCompanyName ?? "-"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel-section">
          <h2>위치</h2>
          <div className="location-box">
            <MapPin aria-hidden="true" size={20} />
            <div>
              <strong>{report.placeName ?? report.addressText ?? "-"}</strong>
              <span>{report.roadAddressText ?? report.addressText ?? "-"}</span>
              <small>
                {report.latitude && report.longitude
                  ? `${report.latitude}, ${report.longitude}`
                  : "좌표 없음"}
              </small>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>배정 결과</h2>
          {report.assignment ? (
            <div className="assignment-box">
              <strong>{report.assignment.contractorCompanyName}</strong>
              <span>{formatDateTime(report.assignment.assignedAt)}</span>
              <p>{report.assignment.selectionReason ?? "선택 사유 없음"}</p>
              <small>{report.assignment.customerMessageRendered}</small>
            </div>
          ) : (
            <p className="empty-text">아직 배정된 업체가 없습니다.</p>
          )}
        </article>

        <article className="panel-section">
          <h2>최근 작업</h2>
          {latestWorkUpdate ? (
            <div className="timeline-entry">
              <span>{formatDateTime(latestWorkUpdate.createdAt)}</span>
              <strong>{labelOf(statusLabels, latestWorkUpdate.status)}</strong>
              <p>
                {latestWorkUpdate.contractorCompanyName} ·{" "}
                {latestWorkUpdate.note ?? "-"} ·{" "}
                {formatCurrency(latestWorkUpdate.finalPrice)}
              </p>
            </div>
          ) : (
            <p className="empty-text">작업 이력이 없습니다.</p>
          )}
        </article>
      </section>
    </>
  );
}

export function AdminReportReview({ report }: { report: ReportDetail }) {
  const latestAi = report.aiAnalyses[0];
  const canApprove =
    !closedStatuses.includes(report.status) && report.status !== "BIDDING";
  const updateReport = updateReportAction.bind(null, report.reportNo);
  const approveReport = approveReportAction.bind(null, report.reportNo);

  return (
    <>
      <section className="detail-grid">
        <article className="panel-section">
          <h2>신고 내용 수정</h2>
          <form action={updateReport} className="admin-form">
            <div className="form-grid">
              <label className="form-field">
                <span>요약</span>
                <input name="summary" defaultValue={report.summary ?? ""} />
              </label>
              <label className="form-field">
                <span>유형</span>
                <select name="issueType" defaultValue={report.issueType ?? ""}>
                  <option value="">미정</option>
                  {issueOptions.map((issueType) => (
                    <option key={issueType} value={issueType}>
                      {labelOf(issueTypeLabels, issueType)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>긴급도</span>
                <select name="urgency" defaultValue={report.urgency}>
                  {urgencyOptions.map((urgency) => (
                    <option key={urgency} value={urgency}>
                      {labelOf(urgencyLabels, urgency)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>장소명</span>
                <input name="placeName" defaultValue={report.placeName ?? ""} />
              </label>
              <label className="form-field">
                <span>주소</span>
                <input
                  name="addressText"
                  defaultValue={report.addressText ?? ""}
                />
              </label>
              <label className="form-field">
                <span>도로명 주소</span>
                <input
                  name="roadAddressText"
                  defaultValue={report.roadAddressText ?? ""}
                />
              </label>
              <label className="form-field">
                <span>위도</span>
                <input
                  inputMode="decimal"
                  name="latitude"
                  defaultValue={report.latitude?.toString() ?? ""}
                />
              </label>
              <label className="form-field">
                <span>경도</span>
                <input
                  inputMode="decimal"
                  name="longitude"
                  defaultValue={report.longitude?.toString() ?? ""}
                />
              </label>
            </div>
            <label className="form-field textarea-field">
              <span>상세 내용</span>
              <textarea
                name="description"
                defaultValue={report.description ?? ""}
              />
            </label>
            <label className="form-field">
              <span>수정 사유</span>
              <input name="reason" placeholder="관리자 신고 내용 수정" />
            </label>
            <div className="action-row">
              <button className="primary-button" type="submit">
                수정 저장
              </button>
            </div>
          </form>
        </article>

        <article className="panel-section">
          <h2>관리자 작업</h2>
          <div className="admin-action-stack">
            <dl className="info-list">
              <div>
                <dt>현재 상태</dt>
                <dd>{labelOf(statusLabels, report.status)}</dd>
              </div>
              <div>
                <dt>승인 시각</dt>
                <dd>{formatDateTime(report.adminApprovedAt)}</dd>
              </div>
              <div>
                <dt>입찰 수</dt>
                <dd>{report.bids.length}건</dd>
              </div>
            </dl>
            {canApprove ? (
              <form action={approveReport} className="admin-form compact-form">
                <label className="form-field">
                  <span>승인 사유</span>
                  <input name="reason" placeholder="관리자 입찰 승인" />
                </label>
                <div className="action-row">
                  <button className="primary-button" type="submit">
                    입찰 승인
                  </button>
                </div>
              </form>
            ) : null}
            {report.assignment ? (
              <p className="empty-text">이미 업체 배정이 완료되었습니다.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel-section">
        <h2>AI 분석</h2>
        {latestAi ? (
          <div className="ai-box">
            <div className="ai-score">
              <span>{latestAi.provider}</span>
              <strong>
                {latestAi.confidence
                  ? `${Math.round(latestAi.confidence * 100)}%`
                  : "-"}
              </strong>
            </div>
            <p>
              {latestAi.vendorDescription ??
                latestAi.summary ??
                "분석 설명이 없습니다."}
            </p>
            <div className="tag-row">
              <span>{latestAi.model}</span>
              <span>
                {latestAi.needsReview ? "관리자 확인 필요" : "확인 완료"}
              </span>
            </div>
          </div>
        ) : (
          <p className="empty-text">AI 분석 결과가 없습니다.</p>
        )}
      </section>
    </>
  );
}

export function AdminReportBids({
  report,
  templates,
}: {
  report: ReportDetail;
  templates: MessageTemplate[];
}) {
  const activeWebTemplates = templates.filter(
    (template) => template.isActive && template.channel === "WEB",
  );
  const canAssign = report.status === "BIDDING" && !report.assignment;
  const assignBid = assignBidAction.bind(null, report.reportNo);

  return (
    <>
      <section className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">업체</p>
            <h2>입찰 목록</h2>
          </div>
        </div>
        <div className="bid-grid">
          {report.bids.map((bid) => (
            <article className="bid-card" key={bid.id}>
              <div>
                <strong>{bid.contractorCompanyName}</strong>
                <span className="status-badge">
                  {labelOf(bidStatusLabels, bid.status)}
                </span>
              </div>
              <dl className="info-list compact-list">
                <div>
                  <dt>견적</dt>
                  <dd>{formatCurrency(bid.estimatedPrice)}</dd>
                </div>
                <div>
                  <dt>출동 가능</dt>
                  <dd>{formatDateTime(bid.availableTime)}</dd>
                </div>
              </dl>
              <p>{bid.workNote ?? "작업 메모 없음"}</p>
              <small>{bid.extraCostPolicy ?? "추가 비용 조건 없음"}</small>
              {canAssign && bid.status === "SUBMITTED" ? (
                <form action={assignBid} className="admin-form compact-form">
                  <input name="bidId" type="hidden" value={bid.id} />
                  <label className="form-field">
                    <span>선택 사유</span>
                    <input
                      name="selectionReason"
                      placeholder="견적과 출동 시간이 적합함"
                    />
                  </label>
                  <label className="form-field">
                    <span>고객 안내 템플릿</span>
                    <select name="templateId" defaultValue="">
                      <option value="">기본 템플릿</option>
                      {activeWebTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button" type="submit">
                    이 업체 배정
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {report.bids.length === 0 ? (
            <p className="empty-text">입찰 내역이 없습니다.</p>
          ) : null}
        </div>
      </section>

      <section className="panel-section">
        <h2>배정 결과</h2>
        {report.assignment ? (
          <div className="assignment-box">
            <strong>{report.assignment.contractorCompanyName}</strong>
            <span>{formatDateTime(report.assignment.assignedAt)}</span>
            <p>{report.assignment.selectionReason ?? "선택 사유 없음"}</p>
            <small>{report.assignment.customerMessageRendered}</small>
          </div>
        ) : (
          <p className="empty-text">아직 배정된 업체가 없습니다.</p>
        )}
      </section>
    </>
  );
}

export function AdminReportMessages({ report }: { report: ReportDetail }) {
  return (
    <section className="panel-section">
      <h2>상담 기록</h2>
      <div className="message-thread">
        {report.messages.map((message) => (
          <div className="message-row" key={message.id}>
            <span>{labelOf(actorLabels, message.senderType)}</span>
            <p>{message.content}</p>
            <small>{formatDateTime(message.createdAt)}</small>
          </div>
        ))}
        {report.messages.length === 0 ? (
          <p className="empty-text">상담 기록이 없습니다.</p>
        ) : null}
      </div>
    </section>
  );
}

export function AdminReportHistory({ report }: { report: ReportDetail }) {
  return (
    <>
      <section className="detail-grid">
        <article className="panel-section">
          <h2>상태 이력</h2>
          <div className="timeline">
            {report.statusHistory.map((history) => (
              <div className="timeline-entry" key={history.id}>
                <span>{formatDateTime(history.createdAt)}</span>
                <strong>{labelOf(statusLabels, history.toStatus)}</strong>
                <p>
                  {labelOf(actorLabels, history.actorType)} ·{" "}
                  {history.reason ?? "-"}
                </p>
              </div>
            ))}
            {report.statusHistory.length === 0 ? (
              <p className="empty-text">상태 이력이 없습니다.</p>
            ) : null}
          </div>
        </article>

        <article className="panel-section">
          <h2>수정 이력</h2>
          <div className="timeline">
            {report.revisions.map((revision) => (
              <div className="timeline-entry" key={revision.id}>
                <span>{formatDateTime(revision.createdAt)}</span>
                <strong>
                  {labelOf(reportFieldLabels, revision.fieldName)}
                </strong>
                <p>
                  {formatRevisionValue(revision.oldValue)} →{" "}
                  {formatRevisionValue(revision.newValue)}
                </p>
                <small>
                  {labelOf(actorLabels, revision.editorType)} ·{" "}
                  {revision.reason ?? "-"}
                </small>
              </div>
            ))}
            {report.revisions.length === 0 ? (
              <p className="empty-text">수정 이력이 없습니다.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel-section">
        <h2>작업 이력</h2>
        <div className="timeline">
          {report.workUpdates.map((update) => (
            <div className="timeline-entry" key={update.id}>
              <span>{formatDateTime(update.createdAt)}</span>
              <strong>{labelOf(statusLabels, update.status)}</strong>
              <p>
                {update.contractorCompanyName} · {update.note ?? "-"} ·{" "}
                {formatCurrency(update.finalPrice)}
              </p>
              {update.photoUrls.length > 0 ? (
                <div className="work-photo-grid">
                  {update.photoUrls.map((url) => (
                    <a href={url} key={url} rel="noreferrer" target="_blank">
                      <img alt="작업 사진" src={url} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {report.workUpdates.length === 0 ? (
            <p className="empty-text">작업 이력이 없습니다.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
