"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardList, FileText, Gavel, Hammer, User } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

const navItems = [
  { href: "/offers", label: "배정 제안", icon: Gavel },
  { href: "/jobs", label: "배정 작업", icon: Hammer },
  { href: "/history", label: "기록", icon: FileText },
  { href: "/profile", label: "기본정보", icon: User },
] as const;

/** 업체 작업 화면 공통 셸 — 메뉴 왼쪽, 본문 오른쪽. */
export function ContractorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="contractor-shell">
      <aside aria-label="업체 메뉴" className="contractor-side-nav">
        <Link
          className={`contractor-nav-item${pathname === "/" ? " active" : ""}`}
          href="/"
        >
          <ClipboardList aria-hidden="true" size={18} />
          작업대 홈
        </Link>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={`contractor-nav-item${pathname.startsWith(item.href) ? " active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" size={18} />
              {item.label}
            </Link>
          );
        })}
        <form action={logoutAction} className="contractor-nav-logout">
          <SubmitButton className="secondary-button" type="submit">
            로그아웃
          </SubmitButton>
        </form>
      </aside>
      <div className="contractor-shell-main">{children}</div>
    </div>
  );
}
