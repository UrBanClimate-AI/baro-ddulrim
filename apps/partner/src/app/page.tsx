import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ContractorRejectedScreen,
  ContractorSummaryMetrics,
  ContractorWaitingScreen,
} from "@/components/contractor-sections";
import { ContractorShell } from "@/components/contractor-shell";
import { getContractorAssignments, getMyOffers } from "@/lib/contractor-api";
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

  // 승인 전(대기/반려)은 셸 없이 게이트 화면만 보여준다.
  if (!approved) {
    return (
      <main className="workspace-page contractor-page">
        <header className="workspace-header">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Image alt="바로뚫림 캐릭터" height={48} priority src="/character.png" style={{ objectFit: "contain" }} width={48} />
            <div>
              <p className="eyebrow" style={{ margin: 0, marginBottom: 4 }}>바로 뚫림 · 업체</p>
              <h1 style={{ margin: 0 }}>업체 작업대</h1>
            </div>
          </div>
          <form action={logoutAction}>
            <SubmitButton className="secondary-button" type="submit">
              로그아웃
            </SubmitButton>
          </form>
        </header>
        {company.status === "REJECTED" ? (
          <ContractorRejectedScreen company={company} />
        ) : (
          <ContractorWaitingScreen company={company} />
        )}
      </main>
    );
  }

  const [offers, assignments] = await Promise.all([
    getMyOffers(),
    getContractorAssignments(company.id),
  ]);

  return (
    <ContractorShell
      barExtra={
        offers.length > 0 ? (
          <span className="live-chip">
            <span className="live-dot" style={{ background: "var(--color-warning)" }} />
            응답 대기 <b>{offers.length}</b>
          </span>
        ) : null
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ContractorSummaryMetrics assignments={assignments} offerCount={offers.length} />
        {offers.length > 0 ? (
          <section className="panel-section" style={{ borderColor: "var(--color-warning)" }}>
            <div className="section-header">
              <div>
                <p className="eyebrow">응답 필요</p>
                <h2>새 배정 제안 {offers.length}건이 기다리고 있어요</h2>
              </div>
              <Link className="primary-button" href="/offers">
                제안 확인
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </ContractorShell>
  );
}
