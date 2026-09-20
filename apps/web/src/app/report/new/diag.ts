/**
 * 자가 진단(hasugulab.com/check.html) → 접수 페이지로 넘어오는 ?diag= 파라미터 해석.
 * 페이로드 구조는 자가진단_공용템플릿_v1 코드 체계를 따른다.
 */

export type DiagAnswer = {
  code: string;
  value: string;
  q: string;
  label: string;
};

export type DiagPayload = {
  v: number;
  tpl?: string;
  place?: { code: string; label: string } | null;
  point?: {
    code: string;
    space: string;
    spaceLabel: string;
    label: string;
  } | null;
  answers?: DiagAnswer[];
  stage?: number;
  stageName?: string;
  lo?: number;
  hi?: number;
  visitLo?: number;
  visitHi?: number;
  flags?: string[];
};

const FLAG_LABEL: Record<string, string> = {
  URGENT: "긴급 — 물이 넘치는 중",
  SHARED: "공용관 가능성 — 두 곳 이상 동시 막힘",
  SURCHARGE: "야간 할증 적용"
};

export function parseDiag(raw: string | undefined | null): DiagPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DiagPayload;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function diagFlagLabels(diag: DiagPayload): string[] {
  return (diag.flags ?? []).map((f) => FLAG_LABEL[f] ?? f);
}

export function diagAnswer(diag: DiagPayload, code: string): DiagAnswer | null {
  return diag.answers?.find((a) => a.code === code) ?? null;
}

/** 자가 진단 페이로드 → 증상 선택 UI 초기값 */
export function diagToSelection(diag: DiagPayload): Record<string, string> {
  const sel: Record<string, string> = {};
  if (diag.place?.code) sel.place = diag.place.code;
  if (diag.point?.code) {
    sel.space = diag.point.space;
    sel.point = diag.point.code;
  }
  for (const a of diag.answers ?? []) sel[a.code] = a.value;
  return sel;
}

/** 자가 진단 내용을 접수 증상란에 담을 텍스트로 정리한다. */
export function diagDescription(diag: DiagPayload): string {
  const won = (n: number | undefined) =>
    typeof n === "number" ? n.toLocaleString("ko-KR") : null;

  const lines: string[] = ["[자가 진단 결과]"];
  if (diag.place) {
    const spot = diag.point
      ? ` / ${diag.point.spaceLabel} · ${diag.point.label}`
      : "";
    lines.push(`장소: ${diag.place.label}${spot}`);
  }
  for (const a of diag.answers ?? []) {
    lines.push(`${shortQuestionLabel(a.code)}: ${a.label}`);
  }
  if (diag.stage && diag.stageName) {
    const range =
      won(diag.lo) && won(diag.hi) ? ` (예상 ${won(diag.lo)}~${won(diag.hi)}원, 부가세 별도)` : "";
    lines.push(`추정 단계: ${diag.stageName}${range}`);
  }
  const flags = diagFlagLabels(diag);
  if (flags.length) lines.push(`참고: ${flags.join(" / ")}`);
  lines.push("", "상세 상황: ");
  return lines.join("\n");
}

function shortQuestionLabel(code: string): string {
  switch (code) {
    case "SYMPTOM":
      return "상태";
    case "SCOPE":
      return "막힌 범위";
    case "HISTORY":
      return "작업 이력";
    case "BIZ":
      return "업종";
    case "TIME":
      return "희망 시간대";
    default:
      return code;
  }
}

/** 진단 내용 → 접수 긴급도 기본값. */
export function diagUrgency(diag: DiagPayload): "NORMAL" | "URGENT" | "EMERGENCY" {
  if (diag.flags?.includes("URGENT")) return "EMERGENCY";
  const symptom = diagAnswer(diag, "SYMPTOM")?.value;
  const time = diagAnswer(diag, "TIME")?.value;
  if (symptom === "BLOCKED" || symptom === "BACKFLOW" || time === "NOW") return "URGENT";
  return "NORMAL";
}
