import type { CustomerReport } from "@/lib/customer-api";
import {
  actorLabels,
  formatCurrency,
  formatDateTime,
  issueTypeLabels,
  labelOf,
  statusLabels,
  urgencyLabels,
} from "@/lib/labels";

// 고객에게는 내부 14단계 대신 5단계로 보여준다.
const customerSteps = [
  { key: "received", label: "접수" },
  { key: "review", label: "확인 중" },
  { key: "selecting", label: "업체 선정" },
  { key: "working", label: "출동·작업" },
  { key: "done", label: "완료" },
] as const;

const stepIndexByStatus: Record<string, number> = {
  COLLECTING_INFO: 1,
  AI_ANALYZED: 1,
  ADMIN_REVIEW: 1,
  CUSTOMER_INFO_REQUIRED: 1,
  APPROVED_FOR_BIDDING: 2,
  BIDDING: 2,
  AWAITING_ASSIGNMENT: 2,
  ASSIGNED: 3,
  DISPATCH_SCHEDULED: 3,
  DISPATCHED: 3,
  IN_PROGRESS: 3,
  RESOLVED: 4,
};

const exceptionStatuses: Record<string, string> = {
  ON_HOLD: "잠시 보류 중입니다. 곧 다시 안내드릴게요.",
  CANCELED: "접수가 취소되었습니다.",
  REJECTED: "접수가 반려되었습니다. 문의가 필요하면 연락 주세요.",
};

export function CustomerReportCard({ report }: { report: CustomerReport }) {
  const exceptionMessage = exceptionStatuses[report.status];
  const currentStep = stepIndexByStatus[report.status] ?? 1;
  const isDistributing =
    report.status === "APPROVED_FOR_BIDDING" ||
    report.status === "BIDDING" ||
    report.status === "AWAITING_ASSIGNMENT";

  return (
    <article className="customer-report-card">
      <div className="opportunity-head">
        <div>
          <span className="table-link">{report.reportNo}</span>
          <h3>{report.summary ?? "신고 요약 없음"}</h3>
        </div>
        <span className={`urgency-badge ${report.urgency.toLowerCase()}`}>
          {labelOf(urgencyLabels, report.urgency)}
        </span>
      </div>

      {exceptionMessage ? (
        <div className="customer-exception">
          <strong>{labelOf(statusLabels, report.status)}</strong>
          <p>{exceptionMessage}</p>
        </div>
      ) : (
        <ol aria-label="진행 단계" className="customer-steps">
          {customerSteps.map((step, index) => {
            const state =
              index < currentStep
                ? "done"
                : index === currentStep
                  ? "current"
                  : "todo";
            return (
              <li className={`customer-step ${state}`} key={step.key}>
                <span className="customer-step-dot">{index + 1}</span>
                <span className="customer-step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="info-list compact-list">
        <div>
          <dt>접수</dt>
          <dd>{formatDateTime(report.createdAt)}</dd>
        </div>
        <div>
          <dt>유형</dt>
          <dd>{labelOf(issueTypeLabels, report.issueType)}</dd>
        </div>
        <div>
          <dt>위치</dt>
          <dd>
            {report.placeName ??
              report.roadAddressText ??
              report.addressText ??
              "-"}
          </dd>
        </div>
        {isDistributing ? (
          <div>
            <dt>진행</dt>
            <dd>지역 업체에 배정을 진행하고 있어요</dd>
          </div>
        ) : null}
      </dl>

      {report.assignment ? (
        <div className="customer-assignment-box">
          <strong>{report.assignment.contractorCompanyName}</strong>
          <span>{formatCurrency(report.assignment.estimatedPrice)}</span>
          {report.assignment.selectionReason ? (
            <p className="customer-selection-reason">
              선정 이유: {report.assignment.selectionReason}
            </p>
          ) : null}
          <small>{report.assignment.customerMessageRendered}</small>
        </div>
      ) : null}

      {report.workUpdates.length > 0 ? (
        <div className="customer-progress-list">
          {report.workUpdates.map((update) => (
            <div className="customer-progress-entry" key={update.id}>
              <span>{formatDateTime(update.createdAt)}</span>
              <strong>{labelOf(statusLabels, update.status)}</strong>
              <small>
                {update.contractorCompanyName} · {update.note ?? "-"}
                {update.finalPrice
                  ? ` · ${formatCurrency(update.finalPrice)}`
                  : ""}
              </small>
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
        </div>
      ) : null}

      <details className="customer-history-details">
        <summary>자세한 처리 이력 보기</summary>
        <div className="customer-progress-list">
          {report.statusHistory.map((history) => (
            <div className="customer-progress-entry" key={history.id}>
              <span>{formatDateTime(history.createdAt)}</span>
              <strong>{labelOf(statusLabels, history.toStatus)}</strong>
              <small>
                {labelOf(actorLabels, history.actorType)} ·{" "}
                {history.reason ?? "-"}
              </small>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
