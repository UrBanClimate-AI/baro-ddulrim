"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "kakao" | "google";

export function AuthOAuthButtons({
  next = "/register",
  disabled = false,
  disabledMessage,
}: {
  next?: string;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  async function signInWith(provider: OAuthProvider) {
    if (disabled) {
      setError(disabledMessage ?? "약관에 동의해 주세요.");
      return;
    }

    setPending(provider);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });

    if (oauthError) {
      setError("소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPending(null);
    }
    // 성공 시 공급자 페이지로 리다이렉트되므로 별도 처리 없음.
  }

  return (
    <div className="oauth-group">
      <button
        className="oauth-button oauth-kakao"
        disabled={pending !== null}
        onClick={() => signInWith("kakao")}
        type="button"
      >
        <span className="oauth-mark" aria-hidden="true">
          K
        </span>
        {pending === "kakao" ? "이동 중..." : "카카오로 계속하기"}
      </button>
      <button
        className="oauth-button oauth-google"
        disabled={pending !== null}
        onClick={() => signInWith("google")}
        type="button"
      >
        <span className="oauth-mark oauth-mark-google" aria-hidden="true">
          G
        </span>
        {pending === "google" ? "이동 중..." : "구글로 계속하기"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
