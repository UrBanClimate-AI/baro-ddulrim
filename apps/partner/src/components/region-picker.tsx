"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

type Option = { code: string; name: string };
type Selected = { code: string; name: string };

/**
 * 담당 지역(시군구) 다중선택.
 * 선택된 코드는 name="serviceAreaCodes" hidden input으로 폼에 포함된다.
 * initial 로 기존 담당지역을 넘기면 편집 모드로 시작.
 */
export function RegionPicker({
  initial = [],
  name = "serviceAreaCodes"
}: {
  initial?: Selected[];
  name?: string;
}) {
  const [sidoList, setSidoList] = useState<Option[]>([]);
  const [sido, setSido] = useState("");
  const [sigunguList, setSigunguList] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Selected[]>(initial);

  useEffect(() => {
    fetch(`${apiBaseUrl}/regions/sido`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSidoList)
      .catch(() => setSidoList([]));
  }, []);

  useEffect(() => {
    if (!sido) {
      setSigunguList([]);
      return;
    }
    fetch(`${apiBaseUrl}/regions/sigungu?sido=${encodeURIComponent(sido)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSigunguList)
      .catch(() => setSigunguList([]));
  }, [sido]);

  const add = (code: string) => {
    const opt = sigunguList.find((o) => o.code === code);
    if (!opt) return;
    setSelected((prev) =>
      prev.some((s) => s.code === code) ? prev : [...prev, opt]
    );
  };

  const remove = (code: string) =>
    setSelected((prev) => prev.filter((s) => s.code !== code));

  return (
    <div className="region-picker">
      {selected.map((s) => (
        <input key={s.code} type="hidden" name={name} value={s.code} />
      ))}

      <div className="form-grid">
        <label className="form-field">
          <span>시/도</span>
          <select value={sido} onChange={(e) => setSido(e.target.value)}>
            <option value="">선택</option>
            {sidoList.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>시/군/구 (선택 시 추가)</span>
          <select
            value=""
            disabled={!sido}
            onChange={(e) => {
              add(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">선택</option>
            {sigunguList.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="region-chips">
        {selected.length === 0 ? (
          <span className="field-note">담당할 시/군/구를 추가하세요.</span>
        ) : (
          selected.map((s) => (
            <span className="region-chip" key={s.code}>
              {s.name}
              <button
                type="button"
                aria-label={`${s.name} 제거`}
                onClick={() => remove(s.code)}
              >
                <X aria-hidden="true" size={13} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
