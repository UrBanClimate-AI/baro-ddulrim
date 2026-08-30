"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { CompanyActivity } from "@/lib/admin-api";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { formatDateTime, labelOf, statusLabels } from "@/lib/labels";

const OFFER_STATUS_LABEL: Record<string, string> = {
  OFFERED: "제안중",
  ACCEPTED: "수락",
  REJECTED: "거절",
  TIMEOUT: "무응답",
  CANCELED: "취소"
};

type View = "assigned" | "completed" | "offered" | "rejected";

export function CompanyActivityCards({ activity }: { activity: CompanyActivity }) {
  const [view, setView] = useState<View | null>(null);
  useBodyScrollLock(view != null);

  const cards: { key: View; label: string; value: number }[] = [
    { key: "assigned", label: "배정", value: activity.counts.assigned },
    { key: "completed", label: "완료", value: activity.counts.completed },
    { key: "offered", label: "제안 받음", value: activity.counts.offered },
    { key: "rejected", label: "거절/무응답", value: activity.counts.rejected }
  ];

  const rows =
    view === "assigned"
      ? activity.assignments
      : view === "completed"
        ? activity.assignments.filter((a) => a.status === "RESOLVED")
        : view === "offered"
          ? activity.offers
          : view === "rejected"
            ? activity.offers.filter(
                (o) => o.status === "REJECTED" || o.status === "TIMEOUT"
              )
            : [];

  const isOffer = view === "offered" || view === "rejected";

  return (
    <>
      <div className="dashboard-grid compact">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className="metric"
            style={{ cursor: "pointer", textAlign: "left" }}
            onClick={() => setView(c.key)}
          >
            <span>{c.label}</span>
            <strong>{c.value}</strong>
            <small style={{ color: "#94a9ba" }}>클릭하면 상세</small>
          </button>
        ))}
      </div>

      {view ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setView(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,36,56,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "min(720px, 96vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px -20px rgba(8,62,100,0.4)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {cards.find((c) => c.key === view)?.label} 상세
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setView(null)}
                style={{ border: "none", background: "#f0f4f7", borderRadius: 10, width: 34, height: 34, cursor: "pointer" }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="data-table-wrap" style={{ marginTop: 14, overflowX: "visible" }}>
              <table className="data-table" style={{ minWidth: 0, tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th>접수번호</th>
                    <th>신고</th>
                    <th>상태</th>
                    <th>{isOffer ? "제안 시각" : "배정 시각"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.reportNo}-${i}`}>
                      <td>
                        <span className="table-link">{r.reportNo}</span>
                      </td>
                      <td>{r.summary ?? "-"}</td>
                      <td>
                        <span className="status-badge">
                          {isOffer
                            ? OFFER_STATUS_LABEL[(r as { status: string }).status] ??
                              (r as { status: string }).status
                            : labelOf(statusLabels, (r as { status: string }).status)}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(
                          isOffer
                            ? (r as { offeredAt: string | null }).offeredAt
                            : (r as { assignedAt: string | null }).assignedAt
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? (
                <p className="empty-text">내역이 없습니다.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
