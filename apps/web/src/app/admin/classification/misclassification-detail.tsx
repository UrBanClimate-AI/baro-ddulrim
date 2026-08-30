"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ClassificationField } from "@/lib/admin-api";
import { labelOf } from "@/lib/labels";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function MisclassificationDetail({
  title,
  field,
  labels
}: {
  title: string;
  field: ClassificationField;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const lab = (v: string) => labelOf(labels, v);

  // 배경 스크롤 잠금(공통) + ESC 닫기
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (field.misclassified === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        style={{ marginTop: 10, fontSize: 13, padding: "6px 14px" }}
        onClick={() => setOpen(true)}
      >
        상세보기
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} 오분류 상세`}
          onClick={() => setOpen(false)}
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
              borderRadius: 18,
              padding: "24px 24px 28px",
              width: "min(1080px, 96vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px -20px rgba(8,62,100,0.4)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {title} · 오분류 상세 ({field.misclassified}건)
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "#f0f4f7",
                  borderRadius: 10,
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            {/* 오분류 패턴 */}
            {field.confusion.length > 0 ? (
              <>
                <h3 style={{ marginTop: 18, fontSize: 14.5 }}>
                  오분류 패턴 (AI 예측 → 관리자 확정)
                </h3>
                <div
                  className="data-table-wrap"
                  style={{ marginTop: 8, overflowX: "visible" }}
                >
                  <table
                    className="data-table"
                    style={{ minWidth: 0, tableLayout: "auto" }}
                  >
                    <thead>
                      <tr>
                        <th>AI 예측</th>
                        <th>관리자 확정</th>
                        <th>건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {field.confusion.map((c) => (
                        <tr key={`${c.from}-${c.to}`}>
                          <td>{lab(c.from)}</td>
                          <td>{lab(c.to)}</td>
                          <td>{c.count}건</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {/* 오분류 사례 */}
            {field.cases.length > 0 ? (
              <>
                <h3 style={{ marginTop: 20, fontSize: 14.5 }}>오분류 사례</h3>
                <div
                  className="data-table-wrap"
                  style={{ marginTop: 8, overflowX: "visible" }}
                >
                  <table
                    className="data-table"
                    style={{ minWidth: 0, tableLayout: "auto" }}
                  >
                    <thead>
                      <tr>
                        <th>접수번호</th>
                        <th>AI 예측</th>
                        <th>관리자 확정</th>
                        <th>수정 사유</th>
                        <th>수정 시각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {field.cases.map((c, i) => (
                        <tr key={`${c.reportNo}-${i}`}>
                          <td>
                            <span className="table-link">{c.reportNo}</span>
                          </td>
                          <td>{lab(c.aiValue)}</td>
                          <td>{lab(c.finalValue)}</td>
                          <td>{c.reason ?? "-"}</td>
                          <td>{formatDateTime(c.changedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
