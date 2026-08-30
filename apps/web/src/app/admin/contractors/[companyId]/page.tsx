import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { CompanyActivityCards } from "@/components/company-activity";
import { getAdminContractorCompanies, getCompanyActivity } from "@/lib/admin-api";
import { contractorStatusLabels, formatDateTime, labelOf } from "@/lib/labels";
import { updateContractorStatusAction } from "../actions";

export const dynamic = "force-dynamic";

const contractorStatuses = [
  "REVIEWING",
  "APPROVED",
  "ACTIVE",
  "INACTIVE",
  "RESTRICTED",
  "REJECTED",
];

export default async function AdminContractorDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const companies = await getAdminContractorCompanies();
  const company = companies.find((item) => item.id === companyId);

  if (!company) {
    notFound();
  }

  const activity = await getCompanyActivity(company.id);
  const updateStatus = updateContractorStatusAction.bind(null, company.id);

  return (
    <AdminShell>
      <div className="back-row">
        <Link className="text-link" href="/admin/contractors">
          업체 목록
        </Link>
      </div>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{company.businessNumber}</p>
          <h1>{company.companyName}</h1>
          <p>{company.description ?? "업체 소개가 없습니다."}</p>
        </div>
        <span className="status-badge">
          {labelOf(contractorStatusLabels, company.status)}
        </span>
      </header>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>업체 정보</h2>
          <dl className="info-list">
            <div>
              <dt>대표</dt>
              <dd>{company.representativeName}</dd>
            </div>
            <div>
              <dt>담당</dt>
              <dd>
                {company.managerName} · {company.phone}
              </dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{company.email}</dd>
            </div>
            <div>
              <dt>지역</dt>
              <dd>{company.serviceRegions.join(", ") || "-"}</dd>
            </div>
            <div>
              <dt>업력</dt>
              <dd>
                {company.yearsOfExperience != null
                  ? `${company.yearsOfExperience}년`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>주 종목</dt>
              <dd>{company.specialties.join(", ") || "-"}</dd>
            </div>
            <div>
              <dt>주소</dt>
              <dd>
                {[company.address, company.addressDetail]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </dd>
            </div>
            <div>
              <dt>승인</dt>
              <dd>{formatDateTime(company.approvedAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel-section">
          <h2>처리 이력</h2>
          <p style={{ fontSize: 13, color: "#5b7186", marginBottom: 10 }}>
            갯수를 클릭하면 상세 내역을 볼 수 있습니다.
          </p>
          <CompanyActivityCards activity={activity} />
        </article>

        <article className="panel-section">
          <h2>상태 변경</h2>
          <form action={updateStatus} className="admin-form compact-form">
            <label className="form-field">
              <span>상태</span>
              <select name="status" defaultValue={company.status}>
                {contractorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {labelOf(contractorStatusLabels, status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>상태 사유</span>
              <input
                name="statusReason"
                defaultValue={company.statusReason ?? ""}
                placeholder="서류 확인 완료"
              />
            </label>
            <div className="action-row">
              <button className="primary-button" type="submit">
                상태 저장
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="panel-section">
        <h2>서류와 활동</h2>
        <div className="tag-row">
          <span>입찰 {company.bidCount}</span>
          <span>배정 {company.assignmentCount}</span>
          <span>작업 {company.workUpdateCount}</span>
          {company.businessLicenseFileUrl ? (
            <a
              className="text-link"
              href={company.businessLicenseFileUrl}
              target="_blank"
            >
              사업자등록증
            </a>
          ) : null}
          {company.companyPhotoUrl ? (
            <a
              className="text-link"
              href={company.companyPhotoUrl}
              target="_blank"
            >
              업체 사진
            </a>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
