"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Pill, offerStatusTone, reportStatusTone } from "@/components/ui/pill";
import type { CompanyActivity } from "@/lib/admin-api";
import { formatDateTime, labelOf, statusLabels } from "@/lib/labels";

const OFFER_STATUS_LABEL: Record<string, string> = {
  OFFERED: "제안중",
  ACCEPTED: "수락",
  REJECTED: "거절",
  TIMEOUT: "무응답",
  CANCELED: "취소",
};

type View = "assigned" | "completed" | "offered" | "rejected";

/** 업체 처리 이력 — 갯수 카드 클릭 시 모달 상세. */
export function CompanyActivityCards({ activity }: { activity: CompanyActivity }) {
  const [view, setView] = useState<View | null>(null);

  const cards: { key: View; label: string; value: number }[] = [
    { key: "assigned", label: "배정", value: activity.counts.assigned },
    { key: "completed", label: "완료", value: activity.counts.completed },
    { key: "offered", label: "제안 받음", value: activity.counts.offered },
    { key: "rejected", label: "거절/무응답", value: activity.counts.rejected },
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
                (o) => o.status === "REJECTED" || o.status === "TIMEOUT",
              )
            : [];

  const isOffer = view === "offered" || view === "rejected";

  return (
    <>
      <div className="dashboard-grid compact">
        {cards.map((c) => (
          <button
            className="metric"
            key={c.key}
            onClick={() => setView(c.key)}
            style={{ cursor: "pointer", textAlign: "left" }}
            type="button"
          >
            <span>{c.label}</span>
            <strong>{c.value}</strong>
            <small style={{ color: "var(--color-muted)" }}>클릭하면 상세</small>
          </button>
        ))}
      </div>

      <Modal
        onClose={() => setView(null)}
        open={view != null}
        title={`${cards.find((c) => c.key === view)?.label ?? ""} 상세`}
        width={760}
      >
        <div className="data-table-wrap" style={{ overflowX: "visible" }}>
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
                    {isOffer ? (
                      <Pill tone={offerStatusTone((r as { status: string }).status)}>
                        {OFFER_STATUS_LABEL[(r as { status: string }).status] ??
                          (r as { status: string }).status}
                      </Pill>
                    ) : (
                      <Pill tone={reportStatusTone((r as { status: string }).status)}>
                        {labelOf(statusLabels, (r as { status: string }).status)}
                      </Pill>
                    )}
                  </td>
                  <td>
                    {formatDateTime(
                      isOffer
                        ? (r as { offeredAt: string | null }).offeredAt
                        : (r as { assignedAt: string | null }).assignedAt,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="empty-text">내역이 없습니다.</p> : null}
        </div>
      </Modal>
    </>
  );
}
