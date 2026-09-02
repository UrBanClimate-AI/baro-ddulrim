"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { ClassificationField } from "@/lib/admin-api";
import { labelOf } from "@/lib/labels";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 오분류 카드의 상세보기 — 패턴/사례를 모달로 보여준다. */
export function MisclassificationDetail({
  title,
  field,
  labels,
}: {
  title: string;
  field: ClassificationField;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const lab = (v: string) => labelOf(labels, v);

  if (field.misclassified === 0) {
    return null;
  }

  return (
    <>
      <button
        className="secondary-button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 10, fontSize: 13, padding: "6px 14px", minHeight: 34 }}
        type="button"
      >
        상세보기
      </button>

      <Modal
        onClose={() => setOpen(false)}
        open={open}
        title={`${title} · 오분류 상세 (${field.misclassified}건)`}
        width={1080}
      >
        {field.confusion.length > 0 ? (
          <>
            <h3 style={{ margin: "4px 0 8px", fontSize: 14.5 }}>
              오분류 패턴 (AI 예측 → 관리자 확정)
            </h3>
            <div className="data-table-wrap" style={{ overflowX: "visible" }}>
              <table className="data-table" style={{ minWidth: 0, tableLayout: "auto" }}>
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

        {field.cases.length > 0 ? (
          <>
            <h3 style={{ margin: "18px 0 8px", fontSize: 14.5 }}>오분류 사례</h3>
            <div className="data-table-wrap" style={{ overflowX: "visible" }}>
              <table className="data-table" style={{ minWidth: 0, tableLayout: "auto" }}>
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
      </Modal>
    </>
  );
}
