"use client";

import { useEffect } from "react";

// 여러 오버레이가 동시에 열려도 올바르게 복원되도록 참조 카운트로 관리한다.
let lockCount = 0;
let previousOverflow = "";

/**
 * active가 true인 동안 배경(body) 스크롤을 잠근다.
 * 모달/오버레이가 열렸을 때 뒤 화면이 스크롤되지 않도록 공통으로 사용한다.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}
