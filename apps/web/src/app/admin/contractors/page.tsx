import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EmptyTableState } from "@/components/empty-table-state";
import { getAdminContractorCompanies } from "@/lib/admin-api";
import { contractorStatusLabels, formatDateTime, labelOf } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AdminContractorsPage() {
  const companies = await getAdminContractorCompanies();

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">업체</p>
        <h1>업체 관리</h1>
      </header>

      <section className="dashboard-grid compact">
        <article className="metric">
          <span>전체</span>
          <strong>{companies.length}</strong>
        </article>
        <article className="metric">
          <span>검토중</span>
          <strong>
            {
              companies.filter((company) => company.status === "REVIEWING")
                .length
            }
          </strong>
        </article>
        <article className="metric">
          <span>활성 가능</span>
          <strong>
            {
              companies.filter((company) =>
                ["APPROVED", "ACTIVE"].includes(company.status),
              ).length
            }
          </strong>
        </article>
        <article className="metric">
          <span>제한/반려</span>
          <strong>
            {
              companies.filter((company) =>
                ["RESTRICTED", "REJECTED"].includes(company.status),
              ).length
            }
          </strong>
        </article>
      </section>

      <section className="panel-section">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>업체</th>
                <th>담당</th>
                <th>지역</th>
                <th>상태</th>
                <th>활동</th>
                <th>승인</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td data-label="업체">
                    <Link
                      className="table-link"
                      href={`/admin/contractors/${company.id}`}
                    >
                      {company.companyName}
                    </Link>
                    <span>{company.businessNumber}</span>
                  </td>
                  <td data-label="담당">
                    <strong>{company.managerName}</strong>
                    <span>{company.phone}</span>
                  </td>
                  <td data-label="지역">
                    <strong>{company.serviceRegions.join(", ") || "-"}</strong>
                    <span>{company.address ?? "-"}</span>
                  </td>
                  <td data-label="상태">
                    <span className="status-badge">
                      {labelOf(contractorStatusLabels, company.status)}
                    </span>
                  </td>
                  <td data-label="활동">
                    <span>배정 {company.assignmentCount}</span>
                  </td>
                  <td data-label="승인">{formatDateTime(company.approvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {companies.length === 0 ? (
            <EmptyTableState message="등록된 업체가 없습니다." />
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
