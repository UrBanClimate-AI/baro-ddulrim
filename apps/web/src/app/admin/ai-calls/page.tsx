import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EmptyTableState } from "@/components/empty-table-state";
import { getAiCalls } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "통화중",
  ENDED: "종료",
  FAILED: "실패"
};

function durationLabel(sec: number | null) {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default async function AdminAiCallsPage() {
  const { agent, calls } = await getAiCalls();

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">AI 전화</p>
        <h1>통화 기록</h1>
      </header>

      <div className="mode-tabs" aria-label="AI 전화 메뉴" style={{ marginBottom: 18 }}>
        <Link className="mode-tab active" href="/admin/ai-calls">
          통화 기록
        </Link>
        <Link className="mode-tab" href="/admin/ai-calls/prompt">
          프롬프트
        </Link>
      </div>

      <section className="dashboard-grid compact">
        <article className="metric">
          <span>에이전트</span>
          <strong>
            {agent.running ? "실행 중" : agent.enabled ? "대기" : "미설정"}
          </strong>
        </article>
        <article className="metric">
          <span>수신 번호</span>
          <strong>{agent.agentNumber ?? "-"}</strong>
        </article>
        <article className="metric">
          <span>전체 통화</span>
          <strong>{calls.length}</strong>
        </article>
        <article className="metric">
          <span>신고 전환</span>
          <strong>{calls.filter((call) => call.reportNo).length}</strong>
        </article>
      </section>

      {!agent.enabled ? (
        <section className="panel-section" style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 14, color: "#5b7186" }}>
            에이전트가 비활성 상태입니다. 서버 환경변수에{" "}
            <code>CLAWOPS_API_KEY · CLAWOPS_ACCOUNT_ID · CLAWOPS_AGENT_NUMBER ·
            OPENAI_API_KEY</code>{" "}
            를 설정하면 070 수신이 시작됩니다. 웹훅(녹음·요약)은 ClawOps 대시보드에{" "}
            <code>/ai-calls/webhooks/clawops</code> 주소를 등록하세요.
          </p>
        </section>
      ) : null}

      <section className="panel-section">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>수신 시각</th>
                <th>발신 번호</th>
                <th>상태</th>
                <th>통화 시간</th>
                <th>요약</th>
                <th>신고</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td data-label="수신 시각">
                    <Link className="table-link" href={`/admin/ai-calls/${call.id}`}>
                      {formatDateTime(call.startedAt)}
                    </Link>
                  </td>
                  <td data-label="발신 번호">
                    <strong>{call.fromNumber ?? "-"}</strong>
                  </td>
                  <td data-label="상태">
                    <span className="status-badge">
                      {statusLabels[call.status] ?? call.status}
                    </span>
                  </td>
                  <td data-label="통화 시간">{durationLabel(call.durationSec)}</td>
                  <td data-label="요약">
                    <span>
                      {(call.summary ?? call.transcriptText ?? "-").slice(0, 60)}
                    </span>
                  </td>
                  <td data-label="신고">
                    {call.reportNo ? (
                      <Link
                        className="table-link"
                        href={`/admin/reports/${call.reportNo}`}
                      >
                        {call.reportNo}
                      </Link>
                    ) : (
                      <Link
                        className="text-link"
                        href={`/admin/ai-calls/${call.id}/new-report`}
                      >
                        신고 만들기
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {calls.length === 0 ? (
            <EmptyTableState message="아직 수신된 통화가 없습니다." />
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
