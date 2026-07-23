import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { ContractorRegistrationForm } from "@/components/contractor-sections";
import { loadMyContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContractorRegisterPage() {
  const context = await loadMyContext();

  // 이미 등록한 업체가 있으면 작업대로 이동한다.
  if (context?.company) {
    redirect("/");
  }

  return (
    <main className="workspace-page contractor-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">업체</p>
          <h1>업체 등록 신청</h1>
        </div>
        <form action={logoutAction}>
          <button className="secondary-button" type="submit">
            로그아웃
          </button>
        </form>
      </header>

      <ContractorRegistrationForm />
    </main>
  );
}
