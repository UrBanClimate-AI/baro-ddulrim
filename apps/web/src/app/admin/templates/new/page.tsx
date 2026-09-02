import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Select } from "@/components/ui/select";
import { labelOf, templateChannelLabels } from "@/lib/labels";
import { createMessageTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const channelOptions = ["WEB", "SMS", "KAKAO", "AI_CALL"];
const templateHints = [
  "{{customer_phone}}",
  "{{issue_summary}}",
  "{{company_name}}",
  "{{estimated_price}}",
  "{{available_time}}",
];

export default function AdminTemplateNewPage() {
  return (
    <AdminShell>
      <div className="back-row">
        <Link className="text-link" href="/admin/templates">
          템플릿 목록
        </Link>
      </div>

      <header className="workspace-header">
        <p className="eyebrow">새 템플릿</p>
        <h1>배정 안내 문구 생성</h1>
      </header>

      <section className="panel-section">
        <form action={createMessageTemplateAction} className="admin-form">
          <div className="form-grid">
            <label className="form-field">
              <span>이름</span>
              <input name="name" placeholder="업체 배정 안내" required />
            </label>
            <div className="form-field">
              <span>채널</span>
              <Select
                defaultValue="WEB"
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
              placeholder="{{customer_phone}} 고객님, {{issue_summary}} 신고에 {{company_name}} 업체가 배정되었습니다."
              required
            />
          </label>
          <label className="checkbox-field">
            <input defaultChecked name="isActive" type="checkbox" />
            <span>활성화</span>
          </label>
          <div className="tag-row">
            {templateHints.map((hint) => (
              <span key={hint}>{hint}</span>
            ))}
          </div>
          <div className="action-row">
            <button className="primary-button" type="submit">
              템플릿 생성
            </button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
