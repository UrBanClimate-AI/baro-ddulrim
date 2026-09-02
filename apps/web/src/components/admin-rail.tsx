"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  Map,
  Settings,
} from "lucide-react";

const items = [
  { href: "/admin", label: "대시보드", icon: LayoutGrid, exact: true },
  { href: "/admin/reports", label: "신고", icon: FileText, exact: false },
  { href: "/admin/contractors", label: "업체", icon: Building2, exact: false },
  { href: "/admin/map", label: "지도", icon: Map, exact: false },
  { href: "/admin/templates", label: "템플릿", icon: LayoutTemplate, exact: false },
  { href: "/admin/classification", label: "분류 성능", icon: BarChart3, exact: false },
  { href: "/admin/settings", label: "설정", icon: Settings, exact: false },
] as const;

/** 관리자 아이콘 레일 — 호버 시 툴팁, 하단에 테마/로그아웃 슬롯. */
export function AdminRail({
  themeSlot,
  logoutSlot,
}: {
  themeSlot?: ReactNode;
  logoutSlot?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="관리자 메뉴" className="console-rail">
      <Link className="rail-logo" href="/admin">
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
      {themeSlot}
      {logoutSlot}
    </nav>
  );
}
