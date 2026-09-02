"use client";

import { useState } from "react";
import { submitWorkUpdateAction } from "@/app/actions";
import { Modal } from "@/components/ui/modal";
import { PendingOverlay } from "@/components/pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import type { ContractorAssignment } from "@/lib/contractor-api";
import { formatCurrency, formatDateTime } from "@/lib/labels";

type ColumnKey = "DISPATCH_SCHEDULED" | "DISPATCHED" | "IN_PROGRESS" | "RESOLVED";

const COLUMNS: {
  key: ColumnKey;
  label: string;
  dot: string;
  next: ColumnKey | null;
  nextLabel: string | null;
}[] = [
  { key: "DISPATCH_SCHEDULED", label: "출동 예정", dot: "var(--color-muted)", next: "DISPATCHED", nextLabel: "출동 시작" },
  { key: "DISPATCHED", label: "출동", dot: "var(--color-primary)", next: "IN_PROGRESS", nextLabel: "작업 시작" },
  { key: "IN_PROGRESS", label: "작업중", dot: "var(--color-warning)", next: "RESOLVED", nextLabel: "완료 처리" },
  { key: "RESOLVED", label: "완료", dot: "var(--color-success)", next: null, nextLabel: null },
];

function columnOf(assignment: ContractorAssignment): ColumnKey {
  const status = assignment.latestWorkStatus as ColumnKey | null;
  return status && COLUMNS.some((c) => c.key === status) ? status : "DISPATCH_SCHEDULED";
}

function placeOf(assignment: ContractorAssignment) {
  return (
    assignment.report.placeName ??
    assignment.report.roadAddressText ??
    assignment.report.addressText ??
    "-"
  );
}

function finalPriceOf(assignment: ContractorAssignment) {
  const priced = [...assignment.workUpdates].reverse().find((w) => w.finalPrice != null);
  return priced?.finalPrice ?? null;
}

/**
 * 배정 작업 칸반 보드 — 출동예정 → 출동 → 작업중 → 완료.
 * 다음 단계 버튼으로 상태를 진행하고, 완료는 모달에서 최종 금액과 함께 처리한다.
 */
export function JobBoard({
  companyId,
  assignments,
}: {
  companyId: string;
  assignments: ContractorAssignment[];
}) {
  const [completing, setCompleting] = useState<ContractorAssignment | null>(null);
  const [detail, setDetail] = useState<ContractorAssignment | null>(null);

  const byColumn = new Map<ColumnKey, ContractorAssignment[]>();
  for (const col of COLUMNS) byColumn.set(col.key, []);
  for (const a of assignments) byColumn.get(columnOf(a))!.push(a);

  return (
    <>
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const cards = byColumn.get(col.key)!;
          return (
            <section aria-label={col.label} className="kanban-col" key={col.key}>
              <header className="kanban-col-head">
                <span className="col-title">
                  <span className="col-dot" style={{ background: col.dot }} />
                  {col.label}
                </span>
                <span className="col-count">{cards.length}</span>
              </header>
              <div className="kanban-col-body">
                {cards.length === 0 ? (
                  <p className="kanban-empty">해당 단계 작업이 없습니다.</p>
                ) : null}
                {cards.map((a) => {
                  const advance = submitWorkUpdateAction.bind(null, companyId, a.id);
                  const finalPrice = finalPriceOf(a);
                  return (
                    <article
                      className={`kanban-card${col.key === "IN_PROGRESS" ? " card-active" : ""}`}
                      key={a.id}
                    >
                      <span className="card-no">{a.report.reportNo}</span>
                      <h4>{a.report.summary ?? "배정 작업"}</h4>
                      <div className="card-meta">
                        <span>{placeOf(a)}</span>
                        {a.bid?.estimatedPrice != null ? (
                          <b>{formatCurrency(a.bid.estimatedPrice)}</b>
                        ) : null}
                        {col.key === "RESOLVED" && finalPrice != null ? (
                          <b>{formatCurrency(finalPrice)}</b>
                        ) : null}
                      </div>
                      {a.workUpdates.at(-1)?.note ? (
                        <p className="card-note">{a.workUpdates.at(-1)!.note}</p>
                      ) : null}
                      <div className="card-actions">
                        {col.key === "IN_PROGRESS" ? (
                          <button
                            className="primary-button"
                            onClick={() => setCompleting(a)}
                            style={{ minHeight: 38 }}
                            type="button"
                          >
                            완료 처리
                          </button>
                        ) : col.next ? (
                          <form action={advance} style={{ display: "contents" }}>
                            <input name="status" type="hidden" value={col.next} />
                            <SubmitButton className="primary-button" style={{ minHeight: 38 }} type="submit">
                              {col.nextLabel}
                            </SubmitButton>
                          </form>
                        ) : null}
                        <button
                          className="secondary-button"
                          onClick={() => setDetail(a)}
                          style={{ minHeight: 38 }}
                          type="button"
                        >
                          상세
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 완료 처리 모달 */}
      <Modal
        onClose={() => setCompleting(null)}
        open={completing != null}
        title={`완료 처리 · ${completing?.report.reportNo ?? ""}`}
        width={480}
      >
        {completing ? (
          <form
            action={submitWorkUpdateAction.bind(null, companyId, completing.id)}
            className="admin-form"
          >
            <PendingOverlay />
            <input name="status" type="hidden" value="RESOLVED" />
            <label className="form-field">
              <span>최종 금액 (원)</span>
              <input
                defaultValue={completing.bid?.estimatedPrice?.toString() ?? ""}
                inputMode="numeric"
                name="finalPrice"
                placeholder="90000"
              />
            </label>
            <label className="form-field">
              <span>작업 메모 (선택)</span>
              <textarea name="note" placeholder="작업 내용, 교체 부품 등" />
            </label>
            <label className="form-field">
              <span>작업 사진 (선택, 최대 5장)</span>
              <input accept="image/*" multiple name="photos" type="file" />
            </label>
            <div className="action-row">
              <SubmitButton className="primary-button" type="submit">
                완료로 저장
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* 작업 상세 모달 */}
      <Modal
        onClose={() => setDetail(null)}
        open={detail != null}
        title={`작업 이력 · ${detail?.report.reportNo ?? ""}`}
        width={520}
      >
        {detail ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <strong style={{ fontSize: 15 }}>{detail.report.summary ?? "배정 작업"}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: 13 }}>
                {placeOf(detail)} · 배정 {formatDateTime(detail.assignedAt)}
              </p>
            </div>
            <div className="offer-timeline">
              {[...detail.workUpdates].reverse().map((w) => (
                <div className="offer-step filled" key={w.id} style={{ color: "var(--color-primary)" }}>
                  <div className="step-rail">
                    <span className="step-node" />
                    <span className="step-line" />
                  </div>
                  <div className="step-body">
                    <div className="step-title">
                      {COLUMNS.find((c) => c.key === w.status)?.label ?? w.status}
                      {w.finalPrice != null ? <b>{formatCurrency(w.finalPrice)}</b> : null}
                    </div>
                    {w.note ? <div className="step-sub">{w.note}</div> : null}
                    <div className="step-when">{formatDateTime(w.createdAt)}</div>
                  </div>
                </div>
              ))}
              {detail.workUpdates.length === 0 ? (
                <p style={{ color: "var(--color-muted)", fontSize: 13 }}>아직 작업 이력이 없습니다.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
