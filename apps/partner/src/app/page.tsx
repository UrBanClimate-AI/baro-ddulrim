import { redirect } from "next/navigation";
import Image from "next/image";
import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ContractorRejectedScreen,
  ContractorSummaryMetrics,
  ContractorWaitingScreen,
} from "@/components/contractor-sections";
import { ContractorShell } from "@/components/contractor-shell";
import {
  getContractorAssignments,
  getContractorBids,
  getContractorOpportunities,
} from "@/lib/contractor-api";
import { isApprovedCompany, loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContractorPage() {
  const context = await loadMyContext();

  // 등록된 업체가 없으면 바로 업체 등록 신청 화면으로 보낸다.
  if (!context?.company) {
    redirect("/register");
  }

  const company = context.company;
  const approved = isApprovedCompany(company);
  const showGate = company.status === "REJECTED" || !approved;

  return (
    <main className="workspace-page contractor-page">
      <header className="workspace-header">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Image src="/character.png" alt="바로뚫림 캐릭터" width={48} height={48} style={{ objectFit: 'contain' }} priority />
          <div>
            <p className="eyebrow" style={{ margin: 0, marginBottom: '4px' }}>바로 뚫림 · 업체</p>
            <h1 style={{ margin: 0 }}>업체 작업대</h1>
          </div>
        </div>
        {showGate ? (
          <form action={logoutAction}>
            <SubmitButton className="secondary-button" type="submit">
              로그아웃
            </SubmitButton>
          </form>
        ) : null}
      </header>

      {showGate ? (
        company.status === "REJECTED" ? (
          <ContractorRejectedScreen company={company} />
        ) : (
          <ContractorWaitingScreen company={company} />
        )
      ) : (
        <ContractorShell>
          <ApprovedWorkspace companyId={company.id} />
        </ContractorShell>
      )}
    </main>
  );
}

async function ApprovedWorkspace({ companyId }: { companyId: string }) {
  const [opportunities, bids, assignments] = await Promise.all([
    getContractorOpportunities(companyId),
    getContractorBids(companyId),
    getContractorAssignments(companyId),
  ]);

  return (
    <ContractorSummaryMetrics
      assignments={assignments}
      bids={bids}
      opportunities={opportunities}
    />
  );
}
