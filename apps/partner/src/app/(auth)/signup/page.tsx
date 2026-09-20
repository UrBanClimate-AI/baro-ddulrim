import Link from "next/link";

/**
 * 업체 가입은 홈페이지 협력 제안(hasugulab.com/partners.html)으로 일원화됐다.
 * 이 화면은 안내와 이동만 담당한다 — 앱 자체 가입 폼은 사용하지 않는다.
 */
const APPLY_URL = "https://hasugulab.com/partners.html#apply";

export default function ContractorSignupPage() {
  return (
    <div className="auth-body">
      <h1 className="auth-title">업체 회원가입</h1>
      <p className="auth-subtitle">
        하수구랩 협력업체 가입은 홈페이지의 <b>협력 제안 등록</b>으로 진행됩니다.
        등록 즉시 파트너 계정이 만들어져요.
      </p>

      <ol className="signup-guide">
        <li>
          <b>협력 제안 등록</b>
          <span>홈페이지에서 회사 정보와 보유 장비, 활동 지역을 알려주세요.</span>
        </li>
        <li>
          <b>계정 자동 생성</b>
          <span>
            아이디는 <b>등록한 이메일</b>, 초기 비밀번호는 <b>연락처 숫자(- 없이)</b>
            입니다.
          </span>
        </li>
        <li>
          <b>첫 로그인 후 비밀번호 변경</b>
          <span>보안을 위해 첫 로그인에서 새 비밀번호를 설정합니다.</span>
        </li>
      </ol>

      <a className="primary-button signup-cta" href={APPLY_URL}>
        홈페이지에서 협력 제안 등록하기 →
      </a>

      <div className="auth-links">
        <span className="auth-switch">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </span>
      </div>
    </div>
  );
}
