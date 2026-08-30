import { AlertTriangle, CheckCircle2, ListChecks, Target } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import {
  getClassificationPerformance,
  type ClassificationField
} from "@/lib/admin-api";
import { issueTypeLabels, urgencyLabels, labelOf } from "@/lib/labels";
import { MisclassificationDetail } from "./misclassification-detail";

export const dynamic = "force-dynamic";

function FieldSection({
  title,
  field,
  labels
}: {
  title: string;
  field: ClassificationField;
  labels: Record<string, string>;
}) {
  const lab = (v: string) => labelOf(labels, v);

  return (
    <section className="panel-section" style={{ marginTop: 24 }}>
      <h2>{title}</h2>

      {/* 요약 지표 */}
      <div className="dashboard-grid compact" style={{ marginTop: 12 }}>
        <article className="metric">
          <Target aria-hidden="true" size={20} />
          <span>분류 정확도</span>
          <strong>{field.accuracy === null ? "—" : `${field.accuracy}%`}</strong>
        </article>
        <article className="metric">
          <ListChecks aria-hidden="true" size={20} />
          <span>전체 대상</span>
          <strong>{field.total}</strong>
        </article>
        <article className="metric">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>정분류</span>
          <strong>{field.correct}</strong>
        </article>
        <article className="metric">
          <AlertTriangle aria-hidden="true" size={20} />
          <span>오분류</span>
          <strong>{field.misclassified}</strong>
          <MisclassificationDetail
            title={title}
            field={field}
            labels={labels}
          />
        </article>
      </div>

      {field.total === 0 ? (
        <p style={{ marginTop: 14, fontSize: 13.5, color: "#94a9ba" }}>
          아직 AI가 분류한 대상 데이터가 없습니다.
        </p>
      ) : (
        <>
          {/* 라벨별 정확도 */}
          <h3 style={{ marginTop: 20, fontSize: 14.5 }}>라벨별 정확도</h3>
          <div className="data-table-wrap" style={{ marginTop: 8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>AI 예측 라벨</th>
                  <th>대상</th>
                  <th>정분류</th>
                  <th>정확도</th>
                </tr>
              </thead>
              <tbody>
                {field.byLabel.map((row) => (
                  <tr key={row.label}>
                    <td>{lab(row.label)}</td>
                    <td>{row.total}</td>
                    <td>{row.correct}</td>
                    <td>{row.accuracy === null ? "—" : `${row.accuracy}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </>
      )}
    </section>
  );
}

export default async function ClassificationPage() {
  const perf = await getClassificationPerformance();

  return (
    <AdminShell>
      <header className="workspace-header">
        <p className="eyebrow">AI 성능</p>
        <h1>분류 성능</h1>
        <p style={{ color: "#5b7186", fontSize: 14.5, marginTop: 6 }}>
          AI가 최초 예측한 분류를 관리자가 수정한 내역을 기준으로, 문의 유형과
          긴급도의 분류 정확도·오분류 사례를 집계합니다. 관리자가 확정한 값을
          정답으로 봅니다.
        </p>
      </header>

      <FieldSection
        title="문의 유형 분류"
        field={perf.issueType}
        labels={issueTypeLabels}
      />
      <FieldSection
        title="긴급도 분류"
        field={perf.urgency}
        labels={urgencyLabels}
      />
    </AdminShell>
  );
}
