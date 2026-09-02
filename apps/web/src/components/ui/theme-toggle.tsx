"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** 밝음(기본)/어둠 테마 토글. html[data-theme]과 localStorage("theme")를 관리한다. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // 저장 불가 환경(시크릿 등)은 무시
    }
  };

  return (
    <button
      aria-label={dark ? "밝은 테마로 전환" : "어두운 테마로 전환"}
      className="theme-toggle"
      onClick={toggle}
      type="button"
    >
      {dark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
    </button>
  );
}
