"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { acceptOfferAction, rejectOfferAction } from "@/app/actions";
import type { ContractorOffer } from "@/lib/contractor-api";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  issueTypeLabels,
  urgencyLabels,
  labelOf,
  formatDateTime
} from "@/lib/labels";

const REJECT_REASONS = [
  { value: "TOO_FAR", label: "거리가 멉니다" },
  { value: "NO_TIME", label: "시간이 없습니다" },
  { value: "NO_EQUIPMENT", label: "장비가 없습니다" },
  { value: "NOT_SPECIALTY", label: "전문 분야가 아닙니다" },
  { value: "OTHER", label: "기타" }
];

export function OffersList({ offers }: { offers: ContractorOffer[] }) {
  const [rejecting, setRejecting] = useState<ContractorOffer | null>(null);
  useBodyScrollLock(rejecting != null);

  if (offers.length === 0) {
    return <p className="empty-text">현재 배정 제안이 없습니다.</p>;
  }

  return (
    <>
      <div className="opportunity-grid">
        {offers.map((o) => (
          <article className="opportunity-card" key={o.id}>
            <div className="opportunity-head">
              <div>
                <span className="table-link">{o.report.reportNo}</span>
                <h3>{o.report.summary ?? "신고 요약 없음"}</h3>
              </div>
              <span className={`urgency-badge ${o.report.urgency.toLowerCase()}`}>
                {labelOf(urgencyLabels, o.report.urgency)}
              </span>
            </div>
            <dl className="info-list compact-list">
              <div>
                <dt>유형</dt>
                <dd>{labelOf(issueTypeLabels, o.report.issueType)}</dd>
              </div>
              <div>
                <dt>위치</dt>
                <dd>{o.report.placeName ?? "-"}</dd>
              </div>
              <div>
                <dt>거리</dt>
                <dd>{o.distanceKm != null ? `${o.distanceKm}km` : "-"}</dd>
              </div>
              <div>
                <dt>응답 마감</dt>
                <dd>{formatDateTime(o.deadline)}</dd>
              </div>
            </dl>
            <p>{o.report.description ?? "상세 내용이 없습니다."}</p>
            <div className="action-row split-actions">
              <form action={acceptOfferAction.bind(null, o.id)}>
                <button className="primary-button" type="submit">
                  수락
                </button>
              </form>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setRejecting(o)}
              >
                거절
              </button>
            </div>
          </article>
        ))}
      </div>

      {rejecting ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRejecting(null)}
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
              width: "min(480px, 100%)",
              boxShadow: "0 24px 60px -20px rgba(8,62,100,0.4)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17 }}>거절 사유</h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setRejecting(null)}
                style={{
                  border: "none",
                  background: "#f0f4f7",
                  borderRadius: 10,
                  width: 34,
                  height: 34,
                  cursor: "pointer"
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#5b7186", marginTop: 6 }}>
              {rejecting.report.reportNo} 제안을 거절합니다.
            </p>
            <form
              action={rejectOfferAction.bind(null, rejecting.id)}
              className="admin-form"
            >
              <label className="form-field">
                <span>사유</span>
                <select name="reason" defaultValue="TOO_FAR">
                  {REJECT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>상세 (선택)</span>
                <textarea name="detail" placeholder="추가 설명" />
              </label>
              <div className="action-row">
                <button className="primary-button" type="submit">
                  거절 제출
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
