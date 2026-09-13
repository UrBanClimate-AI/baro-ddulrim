import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="auth-brand" href="/">
          <Image src="/character.png" alt="하수구랩 로고" width={48} height={48} style={{ objectFit: 'contain' }} priority />
          <span className="auth-brand-text">
            <strong>하수구랩</strong>
            <small>업체 파트너</small>
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
