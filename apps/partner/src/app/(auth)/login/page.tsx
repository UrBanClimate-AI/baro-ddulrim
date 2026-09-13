"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthOAuthButtons } from "@/components/auth-oauth-buttons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ContractorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("not confirmed")
          ? "이메일 인증이 완료되지 않았습니다. 메일을 확인해 주세요."
          : "이메일 또는 비밀번호를 확인해 주세요."
      );
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="auth-body">
      <h1 className="auth-title">업체 로그인</h1>
      <p className="auth-subtitle">하수구랩 업체 작업대에 로그인하세요.</p>

      <AuthOAuthButtons next="/" />

      <div className="auth-divider">
        <span>또는 이메일로 로그인</span>
      </div>

      <form className="admin-form" onSubmit={onSubmit}>
        <label className="form-field">
          <span>이메일</span>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="partner@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="form-field">
          <span>비밀번호</span>
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "로그인 중..." : "이메일로 로그인"}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">비밀번호 찾기</Link>
        <span className="auth-switch">
          계정이 없으신가요? <Link href="/signup">업체 회원가입</Link>
        </span>
      </div>
    </div>
  );
}
