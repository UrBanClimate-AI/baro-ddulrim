import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { getMessageTemplates } from "@/lib/admin-api";
import { formatDateTime, labelOf, templateChannelLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const templates = await getMessageTemplates();

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">메시지</p>
        <h1>템플릿 관리</h1>
      </header>

      <div className="action-row split-actions">
        <Link className="primary-button" href="/admin/templates/new">
          새 템플릿
        </Link>
      </div>

      <section className="panel-section">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>채널</th>
                <th>상태</th>
                <th>사용</th>
                <th>버전</th>
                <th>수정</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td data-label="이름">
                    <Link
                      className="table-link"
                      href={`/admin/templates/${template.id}`}
                    >
                      {template.name}
                    </Link>
                    <span>{template.content}</span>
                  </td>
                  <td data-label="채널">{labelOf(templateChannelLabels, template.channel)}</td>
                  <td data-label="상태">
                    <span className="status-badge">
                      {template.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td data-label="사용">{template.usageCount}회</td>
                  <td data-label="버전">v{template.versionCount}</td>
                  <td data-label="수정">{formatDateTime(template.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 ? (
            <p className="empty-text">등록된 템플릿이 없습니다.</p>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
