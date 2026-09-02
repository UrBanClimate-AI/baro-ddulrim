"use client";

import { useState } from "react";
import { acceptOfferAction, rejectOfferAction } from "@/app/actions";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";
import { PendingOverlay } from "@/components/pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import type { ContractorOffer } from "@/lib/contractor-api";
import {
  issueTypeLabels,
  urgencyLabels,
  labelOf,
  formatDateTime,
} from "@/lib/labels";

const REJECT_REASONS = [
  { value: "TOO_FAR", label: "거리가 멉니다" },
  { value: "NO_TIME", label: "시간이 없습니다" },
  { value: "NO_EQUIPMENT", label: "장비가 없습니다" },
  { value: "NOT_SPECIALTY", label: "전문 분야가 아닙니다" },
  { value: "OTHER", label: "기타" },
];

function urgencyTone(urgency: string) {
  if (urgency === "EMERGENCY") return "bad" as const;
  if (urgency === "URGENT") return "warn" as const;
  return "mute" as const;
}

/** 배정 제안 목록 — 수락 즉시 처리, 거절은 사유 모달. */
export function OffersList({ offers }: { offers: ContractorOffer[] }) {
  const [rejecting, setRejecting] = useState<ContractorOffer | null>(null);

  if (offers.length === 0) {
    return (
      <section className="panel-section">
        <p className="empty-text">현재 배정 제안이 없습니다. 새 제안이 오면 알림으로 안내됩니다.</p>
      </section>
    );
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
              <Pill tone={urgencyTone(o.report.urgency)}>
                {labelOf(urgencyLabels, o.report.urgency)}
              </Pill>
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
                <dd className="deadline-mono">{formatDateTime(o.deadline)}</dd>
              </div>
            </dl>
            <p>{o.report.description ?? "상세 내용이 없습니다."}</p>
            <div className="action-row split-actions">
              <form action={acceptOfferAction.bind(null, o.id)} style={{ flex: 1 }}>
                <PendingOverlay />
                <SubmitButton className="primary-button" style={{ width: "100%" }} type="submit">
                  수락
                </SubmitButton>
              </form>
              <button
                className="secondary-button"
                onClick={() => setRejecting(o)}
                style={{ flex: 1 }}
                type="button"
              >
                거절
              </button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        onClose={() => setRejecting(null)}
        open={rejecting != null}
        title={`거절 사유 · ${rejecting?.report.reportNo ?? ""}`}
        width={460}
      >
        {rejecting ? (
          <form action={rejectOfferAction.bind(null, rejecting.id)} className="admin-form">
            <PendingOverlay />
            <label className="form-field">
              <span>사유 선택</span>
              <Select defaultValue="TOO_FAR" name="reason" options={REJECT_REASONS} />
            </label>
            <label className="form-field">
              <span>상세 (선택)</span>
              <textarea name="detail" placeholder="추가 설명이 있으면 적어주세요" />
            </label>
            <div className="action-row">
              <SubmitButton className="primary-button" type="submit">
                거절 제출
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
