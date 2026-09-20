import Link from "next/link";
import { ArrowRight, ClipboardCheck, Phone } from "lucide-react";
import { createCustomerReportAction } from "@/app/actions";
import { LocationSearchInput } from "@/components/location-search-input";
import { PendingOverlay } from "@/components/pending-overlay";
import { ReportPhotoUploader } from "@/components/report-photo-uploader";
import { SubmitButton } from "@/components/submit-button";
import Image from "next/image";
import { diagDescription, diagFlagLabels, diagUrgency, parseDiag } from "./diag";

export default async function NewReportPage({
  searchParams
}: {
  searchParams: Promise<{ diag?: string }>;
}) {
  const { diag: rawDiag } = await searchParams;
  const diag = parseDiag(rawDiag);
  const defaultDescription = diag ? diagDescription(diag) : undefined;
  const defaultUrgency = diag ? diagUrgency(diag) : "NORMAL";
  const won = (n: number | undefined) =>
    typeof n === "number" ? n.toLocaleString("ko-KR") : null;

  return (
    <main className="shell report-shell">
      <section className="customer-panel" aria-labelledby="report-title">
        <div className="brand-row">
          <Image src="/character.png" alt="하수구랩 캐릭터" width={56} height={56} style={{ objectFit: 'contain' }} priority />
          <div>
            <p className="eyebrow">하수구랩</p>
            <h1 id="report-title">배수 문제 신고</h1>
          </div>
        </div>

        <div className="mode-tabs" aria-label="신고 모드">
          <Link className="mode-tab active" href="/report/new">
            신규 신고
          </Link>
          <Link className="mode-tab" href="/report/lookup">
            내 신고 확인
          </Link>
        </div>

        {diag ? (
          <aside className="diag-card" aria-label="자가 진단 결과">
            <div className="diag-head">
              <ClipboardCheck aria-hidden="true" size={18} />
              <strong>자가 진단 결과가 담긴 접수입니다</strong>
            </div>
            <dl>
              {diag.place ? (
                <>
                  <dt>장소</dt>
                  <dd>
                    {diag.place.label}
                    {diag.point ? ` / ${diag.point.spaceLabel} · ${diag.point.label}` : ""}
                  </dd>
                </>
              ) : null}
              {diag.stageName ? (
                <>
                  <dt>추정 단계</dt>
                  <dd>
                    {diag.stageName}
                    {won(diag.lo) && won(diag.hi)
                      ? ` · 예상 ${won(diag.lo)}~${won(diag.hi)}원 (부가세 별도)`
                      : ""}
                  </dd>
                </>
              ) : null}
            </dl>
            {diagFlagLabels(diag).length ? (
              <p className="diag-flags">{diagFlagLabels(diag).join(" · ")}</p>
            ) : null}
            <p className="diag-note">
              아래 증상란에 진단 내용이 채워져 있어요. 상세 상황만 덧붙이고 접수하시면 됩니다.
            </p>
          </aside>
        ) : null}

        <form action={createCustomerReportAction} className="report-form">
          <PendingOverlay message="신고를 정리하고 있어요. 잠시만 기다려 주세요." />
          <label htmlFor="phone">연락처</label>
          <div className="input-row">
            <Phone aria-hidden="true" size={18} />
            <input
              autoComplete="tel"
              id="phone"
              name="phone"
              placeholder="010-0000-0000"
              required
              type="tel"
            />
          </div>

          <LocationSearchInput />

          <label htmlFor="description">증상</label>
          <textarea
            defaultValue={defaultDescription}
            id="description"
            name="description"
            placeholder="역류, 침수, 악취 등 현재 상황"
            required
            rows={diag ? 10 : 5}
          />

          <fieldset className="urgency-choice">
            <legend>얼마나 급한가요?</legend>
            <div className="urgency-options">
              <label className="urgency-option">
                <input
                  defaultChecked={defaultUrgency === "NORMAL"}
                  name="urgency"
                  type="radio"
                  value="NORMAL"
                />
                <span>
                  <strong>보통</strong>
                  <small>며칠 안에 처리되면 돼요</small>
                </span>
              </label>
              <label className="urgency-option">
                <input
                  defaultChecked={defaultUrgency === "URGENT"}
                  name="urgency"
                  type="radio"
                  value="URGENT"
                />
                <span>
                  <strong>급함</strong>
                  <small>오늘 안에 봐주세요</small>
                </span>
              </label>
              <label className="urgency-option">
                <input
                  defaultChecked={defaultUrgency === "EMERGENCY"}
                  name="urgency"
                  type="radio"
                  value="EMERGENCY"
                />
                <span>
                  <strong>긴급</strong>
                  <small>지금 물이 넘치고 있어요</small>
                </span>
              </label>
            </div>
          </fieldset>

          <ReportPhotoUploader />

          <label className="consent-check">
            <input name="consent" required type="checkbox" />
            <span>
              <a href="/terms" rel="noreferrer" target="_blank">
                서비스 이용약관
              </a>
              ,{" "}
              <a href="/privacy" rel="noreferrer" target="_blank">
                개인정보 처리방침
              </a>
              ,{" "}
              <a href="/third-party" rel="noreferrer" target="_blank">
                제3자 정보 제공
              </a>
              에 모두 동의합니다. <em>(필수)</em>
            </span>
          </label>

          <label className="consent-check consent-optional">
            <input name="marketingConsent" type="checkbox" />
            <span>
              할인·이벤트 등 마케팅 정보 수신에 동의합니다. (선택)
            </span>
          </label>

          <SubmitButton className="primary-button" type="submit">
            신고 접수 시작
            <ArrowRight aria-hidden="true" size={18} />
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
