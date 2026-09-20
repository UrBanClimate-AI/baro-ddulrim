import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getAiCall } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "통화중",
  ENDED: "종료",
  FAILED: "실패"
};

export default async function AdminAiCallDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getAiCall(id);
  if (!call) notFound();

  return (
    <AdminShell>
      <div className="back-row">
        <Link className="text-link" href="/admin/ai-calls">
          통화 기록 목록
        </Link>
      </div>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{formatDateTime(call.startedAt)}</p>
          <h1>{call.fromNumber ?? "발신번호 비공개"}</h1>
          <p>
            수신 번호 {call.toNumber ?? "-"} · 통화{" "}
            {call.durationSec != null ? `${call.durationSec}초` : "-"} · 이벤트{" "}
            {call.eventCount}건
          </p>
        </div>
        <span className="status-badge">
          {statusLabels[call.status] ?? call.status}
        </span>
      </header>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>요약</h2>
          <p style={{ whiteSpace: "pre-line", fontSize: 14.5 }}>
            {call.summary ?? "요약이 아직 없습니다. (요약 웹훅 수신 시 자동 저장)"}
          </p>

          <h2 style={{ marginTop: 22 }}>다음 단계</h2>
          {call.reportNo ? (
            <p style={{ fontSize: 14.5 }}>
              이 통화는{" "}
              <Link className="text-link" href={`/admin/reports/${call.reportNo}`}>
                {call.reportNo}
              </Link>{" "}
              신고로 등록되었습니다.
            </p>
          ) : (
            <div className="action-row" style={{ marginTop: 8 }}>
              <Link
                className="primary-button"
                href={`/admin/ai-calls/${call.id}/new-report`}
              >
                이 통화로 신고 만들기
              </Link>
            </div>
          )}

          {call.recordingUrl ? (
            <p style={{ marginTop: 18 }}>
              <a className="text-link" href={call.recordingUrl} target="_blank">
                🔊 녹음 듣기
              </a>
            </p>
          ) : null}
        </article>

        <article className="panel-section">
          <h2>통화 전문</h2>
          <p
            style={{
              whiteSpace: "pre-line",
              fontSize: 14,
              lineHeight: 1.8,
              maxHeight: 480,
              overflowY: "auto",
              background: "#fbfdff",
              border: "1px solid #d9edf7",
              borderRadius: 12,
              padding: "14px 16px"
            }}
          >
            {call.transcriptText ?? "전사 내용이 없습니다."}
          </p>
        </article>
      </section>
    </AdminShell>
  );
}
