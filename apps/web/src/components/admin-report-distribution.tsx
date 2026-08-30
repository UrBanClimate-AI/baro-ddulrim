import {
  manualOfferAction,
  startDistributionAction,
} from "@/app/admin/reports/actions";
import type {
  AdminContractorCompany,
  ReportOffer,
} from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";

const OFFER_STATUS_LABEL: Record<string, string> = {
  OFFERED: "제안중",
  ACCEPTED: "수락",
  REJECTED: "거절",
  TIMEOUT: "무응답",
  CANCELED: "취소",
};

const REJECT_LABEL: Record<string, string> = {
  TOO_FAR: "거리",
  NO_TIME: "시간",
  NO_EQUIPMENT: "장비",
  NOT_SPECIALTY: "전문분야",
  OTHER: "기타",
};

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

  const startDistribution = startDistributionAction.bind(
    null,
    report.reportNo,
    report.id,
  );
  const manualOffer = manualOfferAction.bind(
    null,
    report.reportNo,
    report.id,
  );

  return (
    <>
      <section className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">지역 배분</p>
            <h2>배분 현황</h2>
          </div>
          <form action={startDistribution}>
            <button className="secondary-button" type="submit">
              배분 시작/다음
            </button>
          </form>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>업체</th>
                <th>거리</th>
                <th>상태</th>
                <th>사유</th>
                <th>제안</th>
                <th>응답</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td>{o.sequence}</td>
                  <td>{o.companyName}</td>
                  <td>{o.distanceKm != null ? `${o.distanceKm}km` : "-"}</td>
                  <td>
                    <span className="status-badge">
                      {OFFER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>
                    {o.rejectReason
                      ? `${REJECT_LABEL[o.rejectReason] ?? o.rejectReason}${o.rejectReasonDetail ? ` · ${o.rejectReasonDetail}` : ""}`
                      : "-"}
                  </td>
                  <td>{formatDateTime(o.offeredAt)}</td>
                  <td>{o.respondedAt ? formatDateTime(o.respondedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {offers.length === 0 ? (
            <p className="empty-text">아직 배분 이력이 없습니다.</p>
          ) : null}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">수동 배분</p>
            <h2>업체 지정</h2>
          </div>
        </div>
        {hasActiveOffer ? (
          <p className="empty-text">
            진행 중인 제안이 있어 지정할 수 없습니다. 응답을 기다리거나
            타임아웃 후 진행됩니다.
          </p>
        ) : (
          <form action={manualOffer} className="admin-form compact-form">
            <label className="form-field">
              <span>업체 선택</span>
              <select name="companyId" defaultValue="">
                <option value="">선택</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </label>
            <div className="action-row">
              <button className="primary-button" type="submit">
                이 업체에 제안
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
