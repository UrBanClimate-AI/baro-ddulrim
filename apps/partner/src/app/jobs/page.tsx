import { redirect } from "next/navigation";
import { ContractorShell } from "@/components/contractor-shell";
import { JobBoard } from "@/components/job-board";
import { getContractorAssignments } from "@/lib/contractor-api";
import { isApprovedCompany, loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContractorJobsPage() {
  const context = await loadMyContext();
  const company = context?.company ?? null;

  if (!company || !isApprovedCompany(company)) {
    redirect("/");
  }

  const assignments = await getContractorAssignments(company.id);
  const completed = assignments.filter((a) => a.report.status === "RESOLVED").length;

  return (
    <ContractorShell
      barExtra={
        <>
          <span className="live-chip">
            <span className="live-dot" style={{ background: "var(--color-primary)" }} />
            진행 <b>{assignments.length - completed}</b>
          </span>
          <span className="live-chip">
            <span className="live-dot" style={{ background: "var(--color-success)" }} />
            완료 <b>{completed}</b>
          </span>
        </>
      }
    >
      <JobBoard assignments={assignments} companyId={company.id} />
    </ContractorShell>
  );
}
