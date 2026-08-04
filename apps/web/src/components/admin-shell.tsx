import type { ReactNode } from "react";
import { adminLogoutAction } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/admin-sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="admin-layout">
      <AdminSidebar
        logoutSlot={
          <form action={adminLogoutAction} className="admin-logout">
            <button className="secondary-button" type="submit">
              로그아웃
            </button>
          </form>
        }
      />
      <section className="admin-content">{children}</section>
    </main>
  );
}
