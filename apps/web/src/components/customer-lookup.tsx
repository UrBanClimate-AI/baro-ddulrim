"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { FileSearch, KeyRound, Phone } from "lucide-react";

/**
 * 내 신고 확인 — 폼과 결과 영역을 감싸는 클라이언트 셸.
 * 전체 리로드 대신 클라이언트 전환을 쓰고, 조회 중에는
 * 이전 화면을 유지한 채 결과 영역만 스켈레톤으로 바꾼다.
 */
export function CustomerLookup({
  initialPhone,
  initialReportNo,
  initialCode,
  children,
}: {
  initialPhone?: string;
  initialReportNo?: string;
  initialCode?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [reportNo, setReportNo] = useState(initialReportNo ?? "");
  const [code, setCode] = useState(initialCode ?? "");

  function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      router.push(
        phone.trim()
          ? `/report/lookup?lookupPhone=${encodeURIComponent(phone.trim())}`
          : "/report/lookup",
      );
    });
  }

  function submitVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reportNo.trim() || !code.trim()) {
      return;
    }

    startTransition(() => {
      router.push(
        `/report/lookup?reportNo=${encodeURIComponent(reportNo.trim())}&verificationCode=${encodeURIComponent(code.trim())}`,
      );
    });
  }

  return (
    <main className="shell">
      <section className="customer-panel" aria-labelledby="lookup-title">
        <div className="brand-row">
          <div>
            <p className="eyebrow">하수구랩</p>
            <h1 id="lookup-title">내 신고 확인</h1>
          </div>
        </div>

        <div className="mode-tabs" aria-label="신고 모드">
          <Link className="mode-tab" href="/report/new">
            신규 신고
          </Link>
          <Link className="mode-tab active" href="/report/lookup">
            내 신고 확인
          </Link>
        </div>

        <div className="customer-lookup-stack">
          <form className="lookup-form" onSubmit={submitPhone}>
            <label htmlFor="lookupPhone">연락처로 조회</label>
            <div className="input-row">
              <Phone aria-hidden="true" size={18} />
              <input
                id="lookupPhone"
                name="lookupPhone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="010-1234-5678"
                type="tel"
                value={phone}
              />
            </div>
            <button className="secondary-button" disabled={isPending} type="submit">
              <FileSearch aria-hidden="true" size={16} />
              {isPending ? "조회 중..." : "조회"}
            </button>
          </form>

          <form className="lookup-form" onSubmit={submitVerify}>
            <label htmlFor="reportNo">접수번호 + 확인번호</label>
            <div className="input-row">
              <FileSearch aria-hidden="true" size={18} />
              <input
                id="reportNo"
                name="reportNo"
                onChange={(event) => setReportNo(event.target.value)}
                placeholder="BD-20260101-1234"
                value={reportNo}
              />
            </div>
            <div className="input-row">
              <KeyRound aria-hidden="true" size={18} />
              <input
                aria-label="확인번호"
                id="verificationCode"
                name="verificationCode"
                onChange={(event) => setCode(event.target.value)}
                placeholder="6자리 확인번호"
                value={code}
              />
            </div>
            <button className="secondary-button" disabled={isPending} type="submit">
              {isPending ? "확인 중..." : "확인"}
            </button>
          </form>
        </div>
      </section>

      <aside className="ops-panel" aria-label="조회 결과">
        {isPending ? <LookupSkeleton /> : children}
      </aside>
    </main>
  );
}

function LookupSkeleton() {
  return (
    <div aria-label="조회 중" className="lookup-skeleton" role="status">
      <div className="status-grid">
        <div className="skeleton-block skeleton-metric" />
        <div className="skeleton-block skeleton-metric" />
      </div>
      <div className="skeleton-card">
        <div className="skeleton-block skeleton-line w40" />
        <div className="skeleton-block skeleton-line w70" />
        <div className="skeleton-block skeleton-steps" />
        <div className="skeleton-block skeleton-line w90" />
        <div className="skeleton-block skeleton-line w60" />
      </div>
      <div className="skeleton-card">
        <div className="skeleton-block skeleton-line w40" />
        <div className="skeleton-block skeleton-line w70" />
        <div className="skeleton-block skeleton-steps" />
        <div className="skeleton-block skeleton-line w90" />
      </div>
    </div>
  );
}
