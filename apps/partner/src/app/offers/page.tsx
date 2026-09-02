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
    <ContractorShell
      barExtra={
        <span className="live-chip">
          <span className="live-dot" style={{ background: "var(--color-warning)" }} />
          응답 대기 <b>{offers.length}</b>
        </span>
      }
    >
      <OffersList offers={offers} />
    </ContractorShell>
  );
}
