import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Select } from "@/components/ui/select";
import { getAiCall } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";
import { createIntakeReportAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminAiCallNewReportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getAiCall(id);
  if (!call) notFound();

  const defaultDescription = [
    "[AI 전화 상담 접수]",
    `통화 시각: ${formatDateTime(call.startedAt)}`,
    call.summary ? `통화 요약: ${call.summary}` : null,
    "",
    "--- 통화 전문 ---",
    call.transcriptText ?? "(전사 없음)"
  ]
    .filter((line) => line !== null)
    .join("\n");

  return (
    <AdminShell>
      <div className="back-row">
        <Link className="text-link" href={`/admin/ai-calls/${call.id}`}>
          통화 상세로
        </Link>
      </div>

      <header className="workspace-header">
        <p className="eyebrow">AI 전화 · 1차 신고 등록</p>
        <h1>통화 내용으로 신고 만들기</h1>
      </header>

      <section className="panel-section" style={{ maxWidth: 860 }}>
        <p style={{ fontSize: 13.5, color: "#5b7186", marginBottom: 14 }}>
          통화 내용이 미리 채워져 있습니다. 고객과 재통화한 내용을 보태 정리한 뒤
          등록하세요. 상담 채널 신고는 승인 후에도 <b>자동 배분 없이 수동 배정</b>
          으로만 진행됩니다.
        </p>

        <form action={createIntakeReportAction} className="admin-form">
          <input name="aiCallId" type="hidden" value={call.id} />

          <div className="form-field">
            <span>접수 채널</span>
            <Select
              defaultValue="AI_CALL"
              name="channel"
              options={[
                { label: "AI 전화", value: "AI_CALL" },
                { label: "전화 (직접 통화)", value: "PHONE" },
                { label: "카카오톡", value: "KAKAO" }
              ]}
            />
          </div>

          <label className="form-field">
            <span>고객 연락처</span>
            <input
              defaultValue={call.fromNumber ?? ""}
              name="phone"
              placeholder="010-0000-0000"
              required
            />
          </label>

          <label className="form-field">
            <span>요약 (선택 — 비우면 자동 생성)</span>
            <input
              defaultValue={call.summary ?? ""}
              maxLength={120}
              name="summary"
              placeholder="예: 정자동 아파트 싱크대 역류"
            />
          </label>

          <label className="form-field">
            <span>위치 (주소)</span>
            <input
              maxLength={200}
              name="addressText"
              placeholder="예: 경기 성남시 분당구 정자동 ○○아파트"
            />
          </label>

          <label className="form-field">
            <span>상세 위치 (동·호수·층 등)</span>
            <input
              maxLength={120}
              name="addressDetail"
              placeholder="예: 101동 1204호"
            />
          </label>

          <label className="form-field">
            <span>상담 내용 (증상)</span>
            <textarea
              defaultValue={defaultDescription}
              name="description"
              required
              rows={14}
              style={{ lineHeight: 1.6 }}
            />
          </label>

          <div className="form-field">
            <span>긴급도</span>
            <Select
              defaultValue="NORMAL"
              name="urgency"
              options={[
                { label: "보통", value: "NORMAL" },
                { label: "급함", value: "URGENT" },
                { label: "긴급", value: "EMERGENCY" }
              ]}
            />
          </div>

          <div className="action-row">
            <button className="primary-button" type="submit">
              1차 신고 등록
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
