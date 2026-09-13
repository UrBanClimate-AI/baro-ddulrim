import Link from "next/link";
import { CheckCircle2, FileSearch } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { CustomerReportCard } from "@/components/customer-report-card";
import { VerificationForm } from "@/components/verification-form";
import { getCustomerReportByVerification } from "@/lib/customer-api";

export default async function CustomerReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportNo: string }>;
  searchParams: Promise<{ verificationCode?: string; created?: string }>;
}) {
  const { reportNo } = await params;
  const { verificationCode, created } = await searchParams;
  const report = await getCustomerReportByVerification(
    reportNo,
    verificationCode,
  );

  return (
    <main className="shell customer-detail-shell">
      <section
        className="customer-panel"
        aria-labelledby="customer-report-title"
      >
        <div className="brand-row">
          <div>
            <p className="eyebrow">{reportNo}</p>
            <h1 id="customer-report-title">신고 상세</h1>
          </div>
        </div>

        <div className="mode-tabs" aria-label="신고 모드">
          <Link className="mode-tab" href="/report/new">
            신규 신고
          </Link>
          <Link className="mode-tab active" href="/report/lookup">
            내 신고 확인
          </Link>
        </div>

        {report && created === "1" ? (
          <div className="report-created-panel">
            <div className="report-created-head">
              <CheckCircle2 aria-hidden="true" size={28} />
              <h2>신고가 접수되었습니다</h2>
            </div>
            <p>
              아래 번호로 진행 상황을 확인할 수 있습니다. 문자나 전화로도 안내해
              드리니, 번호를 꼭 보관해 주세요.
            </p>
            <div className="report-created-codes">
              <div>
                <span>접수번호</span>
                <strong>{report.reportNo}</strong>
              </div>
              <div>
                <span>확인번호</span>
                <strong>{verificationCode}</strong>
              </div>
            </div>
            <CopyButton
              label="접수번호·확인번호 복사"
              value={`하수구랩 접수번호 ${report.reportNo} / 확인번호 ${verificationCode}`}
            />
          </div>
        ) : null}

        {report ? (
          <CustomerReportCard report={report} />
        ) : (
          <VerificationForm initialCode={verificationCode} reportNo={reportNo} />
        )}
      </section>

      <aside className="ops-panel" aria-label="신고 조회">
        <div className="timeline-card">
          <h2>다른 신고 조회</h2>
          <Link className="secondary-button" href="/report/lookup">
            <FileSearch aria-hidden="true" size={16} />
            조회 화면으로 이동
          </Link>
        </div>
      </aside>
    </main>
  );
}
