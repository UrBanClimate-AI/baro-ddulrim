"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

/**
 * 커스텀 셀렉트 (네이티브 <select> 대체).
 * - 폼 호환: hidden input(name)으로 서버 액션에 값 전달
 * - 키보드: Enter/Space 열기, ↑↓ 이동, Enter 선택, Esc 닫기
 * - 제어/비제어 모두 지원 (value+onChange 또는 defaultValue)
 */
export function Select({
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  placeholder = "선택",
  disabled = false,
  required = false,
}: {
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === current) ?? null;

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInner(next);
      onChange?.(next);
      setOpen(false);
    },
    [controlled, onChange],
  );

  // 바깥 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setHovered(Math.max(0, options.findIndex((o) => o.value === current)));
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHovered((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHovered((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hovered >= 0) commit(options[hovered].value);
    }
  };

  return (
    <div className={`ui-select${open ? " open" : ""}`} ref={rootRef}>
      {name ? <input name={name} required={required} type="hidden" value={current} /> : null}
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="ui-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        type="button"
      >
        {selected ? <span>{selected.label}</span> : <span className="placeholder">{placeholder}</span>}
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open ? (
        <div className="ui-select-menu" id={listId} role="listbox">
          {options.map((o, i) => (
            <button
              aria-selected={o.value === current}
              className={`ui-select-option${o.value === current ? " selected" : ""}${i === hovered ? " hovered" : ""}`}
              key={o.value}
              onClick={() => commit(o.value)}
              onMouseEnter={() => setHovered(i)}
              role="option"
              type="button"
            >
              <span>{o.label}</span>
              {o.value === current ? <Check aria-hidden="true" size={15} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
