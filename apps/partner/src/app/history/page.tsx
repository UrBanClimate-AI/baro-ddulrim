import { redirect } from "next/navigation";
import { ContractorShell } from "@/components/contractor-shell";
import { getContractorAssignments } from "@/lib/contractor-api";
import { formatCurrency, formatDateTime, labelOf, statusLabels } from "@/lib/labels";
import { isApprovedCompany, loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContractorHistoryPage() {
  const context = await loadMyContext();
  const company = context?.company ?? null;

  if (!company || !isApprovedCompany(company)) {
    redirect("/");
  }

  const assignments = await getContractorAssignments(company.id);

  const workHistory = assignments
    .flatMap((assignment) =>
      assignment.workUpdates.map((update) => ({
        ...update,
        reportNo: assignment.report.reportNo,
        summary: assignment.report.summary,
      })),
    )
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return (
    <ContractorShell>
      <section className="panel-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">히스토리</p>
            <h2>작업 이력</h2>
          </div>
        </div>
        <div className="work-update-list">
          {workHistory.map((update) => (
            <div className="work-update-entry" key={update.id}>
              <span>{formatDateTime(update.createdAt)}</span>
              <strong>
                {update.reportNo} · {labelOf(statusLabels, update.status)}
              </strong>
              <p>
                {update.summary ?? "-"} · {update.note ?? "-"}
                {update.finalPrice
                  ? ` · ${formatCurrency(update.finalPrice)}`
                  : ""}
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
          {workHistory.length === 0 ? (
            <p className="empty-text">아직 작업 이력이 없습니다.</p>
          ) : null}
        </div>
      </section>
    </ContractorShell>
  );
}
