import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { adminLogoutAction } from "@/app/admin/actions";
import { AdminRail } from "@/components/admin-rail";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getDashboardSummary } from "@/lib/admin-api";

/** 관리자 관제 셸 — 아이콘 레일 + 실시간 카운터 커맨드바. */
export async function AdminShell({ children }: { children: ReactNode }) {
  const summary = await getDashboardSummary();

  return (
    <div className="console-shell">
      <AdminRail
        themeSlot={<ThemeToggle />}
        logoutSlot={
          <form action={adminLogoutAction}>
            <button aria-label="로그아웃" className="rail-item" type="submit">
              <LogOut aria-hidden="true" size={18} />
              <span className="rail-tip">로그아웃</span>
            </button>
          </form>
        }
      />
      <div className="console-main">
        <header className="command-bar">
          <h1 className="cmd-title">바로 뚫림 관제</h1>
          <span className="cmd-sub">실시간 운영 현황</span>
          <div className="cmd-right">
            <span className="live-chip">
              <span className="live-dot" style={{ background: "var(--color-danger)" }} />
              긴급 <b>{summary.urgentCount}</b>
            </span>
            <span className="live-chip">
              <span className="live-dot" style={{ background: "var(--color-warning)" }} />
              배분중 <b>{summary.biddingCount}</b>
            </span>
            <span className="live-chip">
              <span className="live-dot" style={{ background: "var(--color-success)" }} />
              진행 <b>{summary.assignedCount}</b>
            </span>
          </div>
        </header>
        <div className="console-body">{children}</div>
      </div>
    </div>
  );
}
