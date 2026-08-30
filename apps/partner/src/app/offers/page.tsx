import { redirect } from "next/navigation";
import { ContractorShell } from "@/components/contractor-shell";
import { OffersList } from "@/components/offers-list";
import { getMyOffers } from "@/lib/contractor-api";
import { isApprovedCompany, loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContractorOffersPage() {
  const context = await loadMyContext();
  const company = context?.company ?? null;

  if (!company || !isApprovedCompany(company)) {
    redirect("/");
  }

  const offers = await getMyOffers();

  return (
    <main className="workspace-page contractor-page">
      <header className="workspace-header">
        <p className="eyebrow">업체</p>
        <h1>배정 제안</h1>
      </header>

      <ContractorShell>
        <section className="panel-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">응답 대기</p>
              <h2>새 배정 제안</h2>
            </div>
          </div>
          <OffersList offers={offers} />
        </section>
      </ContractorShell>
    </main>
  );
}
