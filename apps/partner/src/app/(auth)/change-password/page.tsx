"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 첫 로그인 비밀번호 변경.
 * 홈페이지 협력 제안으로 만들어진 계정은 초기 비밀번호가 연락처 숫자라서,
 * user_metadata.must_change_password 가 해제될 때까지 미들웨어가 이 화면으로 보낸다.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    if (/^\d+$/.test(password)) {
      setError("숫자로만 된 비밀번호는 쓸 수 없습니다. 영문·기호를 섞어 주세요.");
      setLoading(false);
      return;
    }

    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false }
    });

    if (updateError) {
      setError("변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="auth-body">
      <h1 className="auth-title">새 비밀번호를 설정해 주세요</h1>
      <p className="auth-subtitle">
        지금 계정은 연락처 숫자를 임시 비밀번호로 쓰고 있습니다. 보안을 위해
        나만 아는 비밀번호로 바꾼 뒤 작업대를 이용할 수 있어요.
      </p>

      <form className="admin-form" onSubmit={onSubmit}>
        <label className="form-field">
          <span>새 비밀번호 (8자 이상, 숫자만은 불가)</span>
          <input
            autoComplete="new-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="새 비밀번호"
            required
            type="password"
            value={password}
          />
        </label>

        <label className="form-field">
          <span>새 비밀번호 확인</span>
          <input
            autoComplete="new-password"
            name="confirm"
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="한 번 더 입력"
            required
            type="password"
            value={confirm}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "변경 중…" : "비밀번호 변경하고 시작하기"}
        </button>
      </form>
    </div>
  );
}
