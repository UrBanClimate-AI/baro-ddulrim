"use client";

import { useFormStatus } from "react-dom";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/**
 * 폼(서버 액션) 제출 중에만 표시되는 딤드 오버레이.
 * 반드시 <form> 안에 넣어야 pending 상태를 읽을 수 있다.
 */
export function PendingOverlay({ message }: { message?: string }) {
  const { pending } = useFormStatus();
  useBodyScrollLock(pending);

  if (!pending) {
    return null;
  }

  return (
    <div aria-label={message ?? "처리 중"} className="pending-overlay" role="status">
      <span aria-hidden="true" className="spinner" />
      {message ? <p className="pending-overlay-message">{message}</p> : null}
    </div>
  );
}
