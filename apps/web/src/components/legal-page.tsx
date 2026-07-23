import Link from "next/link";
import type { ReactNode } from "react";

/** 약관/방침 문서 공통 레이아웃 — 로그인 없이 누구나 볼 수 있다. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-main">
      <p className="eyebrow">바로 뚫림</p>
      <h1>{title}</h1>
      <p className="legal-updated">시행일: {updated}</p>
      <div className="legal-body">{children}</div>
      <div className="legal-links">
        <Link href="/terms">서비스 이용약관</Link>
        <Link href="/privacy">개인정보 처리방침</Link>
        <Link href="/third-party">제3자 정보 제공 동의</Link>
      </div>
    </main>
  );
}
