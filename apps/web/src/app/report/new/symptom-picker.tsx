"use client";

import { useMemo, useState } from "react";
import {
  FLAG_LABEL,
  PLACES,
  STAGES,
  VISIT,
  composeDescription,
  isComplete,
  judge,
  judgeFlags,
  placeOf,
  pointOf,
  priceRange,
  questionsFor,
  type Selection
} from "./diag-data";

const won = (n: number) => n.toLocaleString("ko-KR");

/**
 * 증상 선택 — check.html 자가진단과 같은 코드 체계의 순차 펼침 UI.
 * 선택 결과는 hidden name="description" 으로 합성되어 기존 접수 액션에 그대로 전달된다.
 */
export function SymptomPicker({ initial }: { initial?: Selection | null }) {
  const [sel, setSel] = useState<Selection>(initial ?? {});
  const [detail, setDetail] = useState("");

  const resolved = pointOf(sel);
  const questions = questionsFor(sel.place);
  const complete = isComplete(sel);
  const description = complete ? composeDescription(sel, detail) : "";

  const stage = complete ? judge(sel) : null;
  const range = complete ? priceRange(sel) : null;
  const flags = complete ? judgeFlags(sel) : [];

  // 다음에 답할 질문까지만 펼친다 (선택 항목 TIME은 앞 질문이 끝나면 함께 노출)
  const visibleQuestions = useMemo(() => {
    if (!resolved) return [];
    const list: typeof questions = [];
    for (const q of questions) {
      list.push(q);
      if (q.required && !sel[q.code as keyof Selection]) break;
    }
    return list;
  }, [resolved, questions, sel]);

  function setAnswer(patch: Selection) {
    setSel((prev) => {
      const next = { ...prev, ...patch };
      if (patch.place && patch.place !== prev.place) {
        delete next.space;
        delete next.point;
        delete next.BIZ;
        delete next.TIME;
      }
      return next;
    });
    if (patch.SYMPTOM) syncUrgency(patch.SYMPTOM);
  }

  // 증상 선택에 맞춰 아래 긴급도 라디오를 미리 골라준다 (사용자가 다시 바꿀 수 있음)
  function syncUrgency(symptom: string) {
    const value =
      symptom === "OVERFLOW"
        ? "EMERGENCY"
        : symptom === "BLOCKED" || symptom === "BACKFLOW"
          ? "URGENT"
          : "NORMAL";
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="urgency"][value="${value}"]`
    );
    if (radio) radio.checked = true;
  }

  return (
    <div className="sym-picker">
      <textarea
        aria-hidden="true"
        className="sym-required-proxy"
        name="description"
        onChange={() => undefined}
        required
        tabIndex={-1}
        title="증상 선택을 완료해 주세요"
        value={description}
      />

      <div className="sym-step">
        <p className="sym-q">어디가 막혔나요?</p>
        <div className="sym-chips">
          {PLACES.map((p) => (
            <button
              className={`sym-chip${sel.place === p.code ? " on" : ""}`}
              key={p.code}
              onClick={() => setAnswer({ place: p.code })}
              type="button"
            >
              <span className="emo">{p.e}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {sel.place ? (
        <div className="sym-step">
          <p className="sym-q">어느 곳인가요?</p>
          {placeOf(sel.place)!.spaces.map((sp) => (
            <div className="sym-group" key={sp.code}>
              <p className="sym-grp">{sp.label}</p>
              <div className="sym-chips">
                {sp.points.map((pt) => {
                  const on = sel.space === sp.code && sel.point === pt.code;
                  return (
                    <button
                      className={`sym-chip${on ? " on" : ""}${pt.warn ? " warn" : ""}`}
                      key={`${sp.code}-${pt.code}`}
                      onClick={() => setAnswer({ space: sp.code, point: pt.code })}
                      type="button"
                    >
                      <span className="emo">{pt.e}</span>
                      {pt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {visibleQuestions.map((q) => (
        <div className="sym-step" key={q.code}>
          <p className="sym-q">
            {q.label}
            {q.required ? null : <small> (선택)</small>}
          </p>
          {q.sub ? <p className="sym-sub">{q.sub}</p> : null}
          <div className="sym-chips">
            {q.opts.map((o) => {
              const on = sel[q.code as keyof Selection] === o.code;
              return (
                <button
                  className={`sym-chip${on ? " on" : ""}${o.warn ? " warn" : ""}`}
                  key={o.code}
                  onClick={() => setAnswer({ [q.code]: o.code } as Selection)}
                  title={o.sub}
                  type="button"
                >
                  <span className="emo">{o.e}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!complete ? (
        <p className="sym-hint">위 항목을 차례로 선택하면 추정 단계와 예상 범위를 알려드려요.</p>
      ) : null}

      {complete && stage && range ? (
        <div className="sym-result">
          <div className="sym-result-head">
            <span className="sym-stage">{stage}단계</span>
            <div>
              <strong>{STAGES[stage].name.split(" · ")[1]}</strong>
              <span>{STAGES[stage].scope}</span>
            </div>
          </div>
          <dl>
            <dt>예상 범위</dt>
            <dd>
              {won(range.lo)} ~ {won(range.hi)}원 <small>(부가세 별도)</small>
            </dd>
            <dt>출동·진단비</dt>
            <dd>
              {won(VISIT.lo)} ~ {won(VISIT.hi)}원 <small>(작업 진행 시 면제)</small>
            </dd>
            <dt>필요 장비</dt>
            <dd>{STAGES[stage].gear}</dd>
          </dl>
          {flags.length ? (
            <p className="sym-flags">{flags.map((f) => FLAG_LABEL[f] ?? f).join(" · ")}</p>
          ) : null}
          {flags.includes("SHARED") ? (
            <p className="sym-shared">
              두 곳 이상이 동시에 막혔다면 건물 공용 배관이 원인일 수 있어요. 접수하시면
              확인 방법과 관리주체 제출용 자료 안내를 함께 드립니다.
            </p>
          ) : null}
          <p className="sym-note">
            현장 확인 전 참고용 범위입니다. 방문 진단 후 금액을 확정해 동의받고 시작합니다.
          </p>
        </div>
      ) : null}

      <label className="sym-detail" htmlFor="symDetail">
        <span>
          상세 상황 <small>(선택 — 냄새, 지속 기간, 층수 등)</small>
        </span>
        <textarea
          id="symDetail"
          onChange={(e) => setDetail(e.target.value)}
          placeholder="예: 3일 전부터 물이 천천히 빠지다가 오늘 아침부터 역류했어요"
          rows={3}
          value={detail}
        />
      </label>
    </div>
  );
}
