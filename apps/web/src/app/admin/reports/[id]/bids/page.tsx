import { notFound } from "next/navigation";
import { AdminReportHeader } from "@/components/admin-report-detail";
import { AdminReportDistribution } from "@/components/admin-report-distribution";
import { AdminShell } from "@/components/admin-shell";
import {
  getAdminContractorCompanies,
  getReport,
  getReportOffers,
} from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function AdminReportBidsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    notFound();
  }

  const [offers, companies] = await Promise.all([
    getReportOffers(report.id),
    getAdminContractorCompanies(),
  ]);

  return (
    <AdminShell>
      <AdminReportHeader active="bids" report={report} />
      <AdminReportDistribution
        report={report}
        offers={offers}
        companies={companies}
      />
    </AdminShell>
  );
}
