"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/**
 * 공통 모달. 배경 스크롤 잠금 + ESC/배경 클릭 닫기.
 * width로 최대 폭 조절(px). 헤더가 필요 없으면 title 생략.
 */
export function Modal({
  open,
  onClose,
  title,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: ReactNode;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="ui-modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="ui-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--modal-w" as string]: `${width}px` }}
      >
        {title ? (
          <div className="ui-modal-head">
            <h2>{title}</h2>
            <button aria-label="닫기" className="ui-modal-close" onClick={onClose} type="button">
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        ) : null}
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
