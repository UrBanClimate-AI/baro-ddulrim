import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { createCustomerReportAction } from "@/app/actions";
import { LocationSearchInput } from "@/components/location-search-input";
import { PendingOverlay } from "@/components/pending-overlay";
import { ReportPhotoUploader } from "@/components/report-photo-uploader";
import { SubmitButton } from "@/components/submit-button";
import Image from "next/image";

export default function NewReportPage() {
  return (
    <main className="shell report-shell">
      <section className="customer-panel" aria-labelledby="report-title">
        <div className="brand-row">
          <Image src="/character.png" alt="바로뚫림 캐릭터" width={56} height={56} style={{ objectFit: 'contain' }} priority />
          <div>
            <p className="eyebrow">바로 뚫림</p>
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
            id="description"
            name="description"
            placeholder="역류, 침수, 악취 등 현재 상황"
            required
            rows={5}
          />

          <fieldset className="urgency-choice">
            <legend>얼마나 급한가요?</legend>
            <div className="urgency-options">
              <label className="urgency-option">
                <input defaultChecked name="urgency" type="radio" value="NORMAL" />
                <span>
                  <strong>보통</strong>
                  <small>며칠 안에 처리되면 돼요</small>
                </span>
              </label>
              <label className="urgency-option">
                <input name="urgency" type="radio" value="URGENT" />
                <span>
                  <strong>급함</strong>
                  <small>오늘 안에 봐주세요</small>
                </span>
              </label>
              <label className="urgency-option">
                <input name="urgency" type="radio" value="EMERGENCY" />
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
