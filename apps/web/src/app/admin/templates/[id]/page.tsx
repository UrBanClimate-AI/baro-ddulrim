import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Select } from "@/components/ui/select";
import { getMessageTemplates } from "@/lib/admin-api";
import { formatDateTime, labelOf, templateChannelLabels } from "@/lib/labels";
import { updateMessageTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const channelOptions = ["WEB", "SMS", "KAKAO", "AI_CALL"];
const templateHints = [
  "{{customer_phone}}",
  "{{issue_summary}}",
  "{{company_name}}",
  "{{estimated_price}}",
  "{{available_time}}",
];

export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const templates = await getMessageTemplates();
  const template = templates.find((item) => item.id === id);

  if (!template) {
    notFound();
  }

  const updateTemplate = updateMessageTemplateAction.bind(null, template.id);

  return (
    <AdminShell>
      <div className="back-row">
        <Link className="text-link" href="/admin/templates">
          템플릿 목록
        </Link>
      </div>

      <header className="workspace-header">
        <p className="eyebrow">
          {labelOf(templateChannelLabels, template.channel)}
        </p>
        <h1>{template.name}</h1>
      </header>

      <section className="detail-grid">
        <article className="panel-section">
          <h2>템플릿 편집</h2>
          <form action={updateTemplate} className="admin-form compact-form">
            <div className="form-grid">
              <label className="form-field">
                <span>이름</span>
                <input name="name" defaultValue={template.name} required />
              </label>
              <div className="form-field">
                <span>채널</span>
                <Select
                  defaultValue={template.channel}
                  name="channel"
                  options={channelOptions.map((channel) => ({
                    value: channel,
                    label: labelOf(templateChannelLabels, channel),
                  }))}
                />
              </div>
            </div>
            <label className="form-field textarea-field">
              <span>내용</span>
              <textarea
                name="content"
                defaultValue={template.content}
                required
              />
            </label>
            <label className="checkbox-field">
              <input
                defaultChecked={template.isActive}
                name="isActive"
                type="checkbox"
              />
              <span>활성화</span>
            </label>
            <div className="tag-row">
              {templateHints.map((hint) => (
                <span key={hint}>{hint}</span>
              ))}
            </div>
            <div className="action-row">
              <button className="primary-button" type="submit">
                수정 저장
              </button>
            </div>
          </form>
        </article>

        <article className="panel-section">
          <h2>사용 정보</h2>
          <dl className="info-list">
            <div>
              <dt>사용</dt>
              <dd>{template.usageCount}회</dd>
            </div>
            <div>
              <dt>버전</dt>
              <dd>v{template.versionCount}</dd>
            </div>
            <div>
              <dt>수정</dt>
              <dd>{formatDateTime(template.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel-section">
        <h2>버전 이력</h2>
        <div className="template-version-list">
          {template.versions.map((version) => (
            <div className="template-version-entry" key={version.id}>
              <strong>v{version.versionNo}</strong>
              <span>{formatDateTime(version.createdAt)}</span>
              <p>{version.content}</p>
            </div>
          ))}
          {template.versions.length === 0 ? (
            <p className="empty-text">버전 이력이 없습니다.</p>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
