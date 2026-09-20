import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { getAiCallPrompt } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/labels";
import { savePromptAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminAiCallPromptPage() {
  const prompt = await getAiCallPrompt();

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">AI 전화</p>
        <h1>응대 프롬프트</h1>
      </header>

      <div className="mode-tabs" aria-label="AI 전화 메뉴" style={{ marginBottom: 18 }}>
        <Link className="mode-tab" href="/admin/ai-calls">
          통화 기록
        </Link>
        <Link className="mode-tab active" href="/admin/ai-calls/prompt">
          프롬프트
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>현재 프롬프트</h2>
          <p style={{ fontSize: 13, color: "#5b7186", marginBottom: 12 }}>
            저장하면 새 버전으로 기록되고, 실행 중인 에이전트가 재시작되어 다음
            통화부터 바로 적용됩니다.
            {prompt.isDefault ? " (지금은 기본 프롬프트를 사용 중입니다.)" : ""}
          </p>
          <form action={savePromptAction} className="admin-form">
            <label className="form-field">
              <span>프롬프트</span>
              <textarea
                defaultValue={prompt.content}
                name="content"
                required
                rows={18}
                style={{ fontFamily: "inherit", lineHeight: 1.6 }}
              />
            </label>
            <label className="form-field">
              <span>변경 메모 (선택)</span>
              <input name="note" placeholder="예: 야간 할증 안내 추가" />
            </label>
            <div className="template-meta-row">
              <span>최근 변경 {formatDateTime(prompt.updatedAt)}</span>
            </div>
            <div className="action-row">
              <button className="primary-button" type="submit">
                저장하고 적용
              </button>
            </div>
          </form>
        </article>

        <article className="panel-section">
          <h2>변경 이력</h2>
          {prompt.history.length === 0 ? (
            <p style={{ fontSize: 14, color: "#5b7186" }}>
              아직 저장된 버전이 없습니다.
            </p>
          ) : (
            <ul className="info-list" style={{ display: "grid", gap: 14 }}>
              {prompt.history.map((item, index) => (
                <li key={item.id} style={{ listStyle: "none" }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    {formatDateTime(item.createdAt)}
                    {index === 0 ? " · 현재 적용" : ""}
                    {item.note ? ` — ${item.note}` : ""}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#5b7186",
                      whiteSpace: "pre-line",
                      maxHeight: 96,
                      overflow: "hidden",
                      marginTop: 4
                    }}
                  >
                    {item.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </AdminShell>
  );
}
