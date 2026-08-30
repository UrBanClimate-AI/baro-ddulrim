import { redirect } from "next/navigation";
import {
  updateContractorPhoneAction,
  updateServiceAreasAction,
} from "@/app/actions";
import { ContractorShell } from "@/components/contractor-shell";
import { PendingOverlay } from "@/components/pending-overlay";
import { RegionPicker } from "@/components/region-picker";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime, labelOf } from "@/lib/labels";
import { loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const contractorStatusLabels: Record<string, string> = {
  REVIEWING: "검토중",
  APPROVED: "승인",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  RESTRICTED: "활동 제한",
  REJECTED: "반려",
};

export default async function ContractorProfilePage() {
  const context = await loadMyContext();
  const company = context?.company ?? null;

  if (!context || !company) {
    redirect("/register");
  }

  return (
    <main className="workspace-page contractor-page">
      <header className="workspace-header">
        <p className="eyebrow">업체</p>
        <h1>기본정보</h1>
      </header>

      <ContractorShell>
        <section className="panel-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">{company.businessNumber ?? "-"}</p>
              <h2>{company.companyName}</h2>
            </div>
            <span className="status-badge">
              {labelOf(contractorStatusLabels, company.status)}
            </span>
          </div>

          <p className="profile-note">
            업체 정보 변경이 필요하면 관리자에게 문의해 주세요. 담당자 연락처만
            직접 수정할 수 있습니다.
          </p>

          <dl className="info-list">
            <div>
              <dt>대표자</dt>
              <dd>{company.representativeName}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{context.email}</dd>
            </div>
            <div>
              <dt>활동 지역</dt>
              <dd>{company.serviceRegions.join(", ") || "-"}</dd>
            </div>
            <div>
              <dt>활동 반경</dt>
              <dd>
                {company.serviceRadiusKm ? `${company.serviceRadiusKm}km` : "-"}
              </dd>
            </div>
            <div>
              <dt>업력</dt>
              <dd>
                {company.yearsOfExperience
                  ? `${company.yearsOfExperience}년`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>주 종목</dt>
              <dd>{company.specialties?.join(", ") || "-"}</dd>
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
              <dt>소개</dt>
              <dd>{company.description ?? "-"}</dd>
            </div>
            <div>
              <dt>승인일</dt>
              <dd>{formatDateTime(company.approvedAt ?? null)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">수정 가능</p>
              <h2>담당자 연락처</h2>
            </div>
          </div>
          <form action={updateContractorPhoneAction} className="admin-form compact-form">
            <PendingOverlay />
            <label className="form-field">
              <span>연락처</span>
              <input
                defaultValue={context.phone}
                name="phone"
                placeholder="010-0000-0000"
                required
                type="tel"
              />
            </label>
            <label className="consent-check consent-optional">
              <input
                defaultChecked={context.marketingOptIn ?? false}
                name="marketingConsent"
                type="checkbox"
              />
              <span>신규 신고·혜택 등 마케팅 정보 수신에 동의합니다. (선택)</span>
            </label>
            <div className="action-row">
              <SubmitButton className="primary-button" type="submit">
                연락처 저장
              </SubmitButton>
            </div>
          </form>
        </section>

        <section className="panel-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">수정 가능</p>
              <h2>담당 지역</h2>
            </div>
          </div>
          <form action={updateServiceAreasAction} className="admin-form compact-form">
            <PendingOverlay />
            <RegionPicker
              initial={(company.serviceAreas ?? []).map((a) => ({
                code: a.regionCode,
                name: a.regionName,
              }))}
            />
            <div className="action-row">
              <SubmitButton className="primary-button" type="submit">
                담당 지역 저장
              </SubmitButton>
            </div>
          </form>
        </section>
      </ContractorShell>
    </main>
  );
}
