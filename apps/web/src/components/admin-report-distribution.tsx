import {
  manualOfferAction,
  startDistributionAction,
} from "@/app/admin/reports/actions";
import { Pill, offerStatusTone } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";
import type { AdminContractorCompany, ReportOffer } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";

const OFFER_STATUS_LABEL: Record<string, string> = {
  OFFERED: "제안중",
  ACCEPTED: "수락",
  REJECTED: "거절",
  TIMEOUT: "무응답",
  CANCELED: "취소",
};

const REJECT_LABEL: Record<string, string> = {
  TOO_FAR: "거리가 멀어요",
  NO_TIME: "시간이 없어요",
  NO_EQUIPMENT: "장비가 없어요",
  NOT_SPECIALTY: "전문 분야가 아니에요",
  OTHER: "기타",
};

const STEP_COLOR: Record<string, string> = {
  OFFERED: "var(--color-warning)",
  ACCEPTED: "var(--color-success)",
  REJECTED: "var(--color-danger)",
  TIMEOUT: "var(--color-danger)",
  CANCELED: "var(--color-muted)",
};

/** 신고 배분 — 거리순 제안 타임라인 + 수동 지정. */
export function AdminReportDistribution({
  report,
  offers,
  companies,
}: {
  report: { id: string; reportNo: string; status: string };
  offers: ReportOffer[];
  companies: AdminContractorCompany[];
}) {
  const activeCompanies = companies.filter(
    (c) => c.status === "ACTIVE" || c.status === "APPROVED",
  );
  const hasActiveOffer = offers.some((o) => o.status === "OFFERED");

  const startDistribution = startDistributionAction.bind(null, report.reportNo, report.id);
  const manualOffer = manualOfferAction.bind(null, report.reportNo, report.id);

  return (
    <section className="detail-grid">
      <article className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">지역 배분 · 거리순 자동</p>
            <h2>배분 현황</h2>
          </div>
          <form action={startDistribution}>
            <button className="secondary-button" type="submit">
              배분 시작 / 다음 업체
            </button>
          </form>
        </div>

        {offers.length === 0 ? (
          <p className="empty-text">
            아직 배분 이력이 없습니다. 배분을 시작하면 신고 지역 담당 업체에
            거리순으로 제안됩니다.
          </p>
        ) : (
          <div className="offer-timeline" style={{ marginTop: 6 }}>
            {offers.map((o) => (
              <div
                className={`offer-step${o.status !== "OFFERED" ? " filled" : ""}`}
                key={o.id}
                style={{ color: STEP_COLOR[o.status] ?? "var(--color-muted)" }}
              >
                <div className="step-rail">
                  <span className="step-node" />
                  <span className="step-line" />
                </div>
                <div className="step-body">
                  <div className="step-title">
                    <span>
                      {o.sequence}. {o.companyName}
                    </span>
                    <Pill tone={offerStatusTone(o.status)}>
                      {OFFER_STATUS_LABEL[o.status] ?? o.status}
                    </Pill>
                    {o.distanceKm != null ? (
                      <span style={{ color: "var(--color-muted)", fontWeight: 500, fontSize: 12 }}>
                        {o.distanceKm}km
                      </span>
                    ) : null}
                  </div>
                  {o.rejectReason ? (
                    <div className="step-sub">
                      사유 · {REJECT_LABEL[o.rejectReason] ?? o.rejectReason}
                      {o.rejectReasonDetail ? ` — “${o.rejectReasonDetail}”` : ""}
                    </div>
                  ) : null}
                  {o.status === "OFFERED" ? (
                    <div className="step-sub">
                      응답 대기 · 마감 <span className="deadline-mono">{formatDateTime(o.deadline)}</span>
                    </div>
                  ) : null}
                  <div className="step-when">
                    {formatDateTime(o.offeredAt)} 제안
                    {o.respondedAt ? ` · ${formatDateTime(o.respondedAt)} 응답` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">수동 배분</p>
            <h2>업체 지정</h2>
          </div>
        </div>
        {hasActiveOffer ? (
          <p className="empty-text">
            진행 중인 제안이 있어 지정할 수 없습니다. 응답 또는 타임아웃 후
            진행해 주세요.
          </p>
        ) : (
          <form action={manualOffer} className="admin-form compact-form">
            <div className="form-field">
              <span>업체 선택</span>
              <Select
                name="companyId"
                options={activeCompanies.map((c) => ({
                  value: c.id,
                  label: c.companyName,
                }))}
                placeholder="업체를 선택하세요"
              />
            </div>
            <div className="action-row">
              <button className="primary-button" type="submit">
                이 업체에 제안
              </button>
            </div>
          </form>
        )}
      </article>
    </section>
  );
}
