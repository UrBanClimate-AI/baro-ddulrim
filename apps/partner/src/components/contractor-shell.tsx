"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ClipboardList,
  FileText,
  Hammer,
  Handshake,
  LogOut,
  User,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const items = [
  { href: "/", label: "작업대 홈", icon: ClipboardList, exact: true },
  { href: "/offers", label: "배정 제안", icon: Handshake, exact: false },
  { href: "/jobs", label: "배정 작업", icon: Hammer, exact: false },
  { href: "/history", label: "기록", icon: FileText, exact: false },
  { href: "/profile", label: "기본정보", icon: User, exact: false },
] as const;

const titles: Record<string, string> = {
  "/": "업체 작업대",
  "/offers": "배정 제안",
  "/jobs": "현장 작업 보드",
  "/history": "기록",
  "/profile": "기본정보",
};

/** 파트너 관제 셸 — 아이콘 레일 + 커맨드바. barExtra로 우측 칩을 주입한다. */
export function ContractorShell({
  children,
  barExtra,
}: {
  children: ReactNode;
  barExtra?: ReactNode;
}) {
  const pathname = usePathname();
  const title =
    titles[pathname] ??
    titles[Object.keys(titles).find((k) => k !== "/" && pathname.startsWith(k)) ?? "/"];

  return (
    <div className="console-shell">
      <nav aria-label="업체 메뉴" className="console-rail">
        <Link className="rail-logo" href="/">
          바
        </Link>
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`rail-item${active ? " active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" size={19} />
              <span className="rail-tip">{item.label}</span>
            </Link>
          );
        })}
        <span className="rail-spacer" />
        <ThemeToggle />
        <form action={logoutAction}>
          <button aria-label="로그아웃" className="rail-item" type="submit">
            <LogOut aria-hidden="true" size={18} />
            <span className="rail-tip">로그아웃</span>
          </button>
        </form>
      </nav>
      <div className="console-main">
        <header className="command-bar">
          <h1 className="cmd-title">{title}</h1>
          <span className="cmd-sub">바로 뚫림 파트너</span>
          <div className="cmd-right">{barExtra}</div>
        </header>
        <div className="console-body">{children}</div>
      </div>
    </div>
  );
}
