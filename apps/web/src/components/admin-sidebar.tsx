"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고" },
  { href: "/admin/contractors", label: "업체" },
  { href: "/admin/map", label: "지도" },
  { href: "/admin/templates", label: "템플릿" },
  { href: "/admin/classification", label: "분류 성능" },
  { href: "/admin/settings", label: "설정" }
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 관리자 사이드바. 데스크톱에서는 좌측 고정 메뉴,
 * 960px 이하에서는 상단 바 + 햄버거 드롭다운으로 동작한다.
 */
export function AdminSidebar({ logoutSlot }: { logoutSlot: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <aside
      aria-label="관리자 메뉴"
      className="admin-sidebar"
      data-open={open ? "true" : "false"}
    >
      <div className="admin-sidebar-top">
        <div className="brand-row">
          <div>
            <p className="eyebrow">바로 뚫림</p>
            <strong>관리자</strong>
          </div>
        </div>
        <button
          aria-controls="admin-nav-panel"
          aria-expanded={open}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          className="admin-nav-toggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>
      </div>
      {open ? (
        <div
          aria-hidden="true"
          className="admin-nav-backdrop"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="admin-sidebar-panel" id="admin-nav-panel">
        <nav className="admin-nav">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {logoutSlot}
      </div>
    </aside>
  );
}
