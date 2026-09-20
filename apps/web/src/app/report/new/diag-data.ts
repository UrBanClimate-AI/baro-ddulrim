/**
 * 자가진단_공용템플릿_v1 데이터 — hasugulab.com/check.html 과 같은 코드 체계.
 * 코드(대문자)는 진단·접수·배정이 공유하는 고정값이므로 바꾸지 않는다. label만 수정.
 */

export type PointDef = {
  code: string;
  label: string;
  e: string;
  floor: number;
  warn?: boolean;
};

export type SpaceDef = { code: string; label: string; points: PointDef[] };

export type PlaceDef = {
  code: string;
  label: string;
  e: string;
  spaces: SpaceDef[];
};

export type OptionDef = {
  code: string;
  label: string;
  e: string;
  sub?: string;
  warn?: boolean;
};

export type QuestionDef = {
  code: string;
  label: string;
  sub?: string;
  applies: string[];
  required: boolean;
  opts: OptionDef[];
};

export const PLACES: PlaceDef[] = [
  {
    code: "HOME",
    label: "집 · 아파트",
    e: "🏠",
    spaces: [
      {
        code: "TOILET",
        label: "화장실",
        points: [
          { code: "BOWL", label: "변기", e: "🚽", floor: 1 },
          { code: "BASIN", label: "세면대", e: "🫧", floor: 1 },
          { code: "FDRAIN", label: "바닥 배수구", e: "🕳️", floor: 1 }
        ]
      },
      {
        code: "KITCHEN",
        label: "주방 · 부엌",
        points: [{ code: "SINK", label: "싱크대", e: "🚰", floor: 1 }]
      },
      {
        code: "LAUNDRY",
        label: "베란다 · 세탁실",
        points: [
          { code: "FDRAIN", label: "바닥 배수구", e: "🕳️", floor: 1 },
          { code: "WASHER", label: "세탁기 배수", e: "🧺", floor: 1 }
        ]
      }
    ]
  },
  {
    code: "SHOP",
    label: "가게 · 식당 · 상가",
    e: "🏪",
    spaces: [
      {
        code: "KITCHEN",
        label: "주방",
        points: [
          { code: "SINK", label: "주방 싱크대", e: "🍳", floor: 2 },
          { code: "TRENCH", label: "바닥 트렌치", e: "〰️", floor: 3 },
          { code: "GREASE", label: "그리스트랩 (집수정)", e: "🛢️", floor: 3 }
        ]
      },
      {
        code: "TOILET",
        label: "화장실",
        points: [
          { code: "BOWL", label: "변기", e: "🚽", floor: 2 },
          { code: "BASIN", label: "세면대", e: "🫧", floor: 2 },
          { code: "FDRAIN", label: "바닥 배수구", e: "🕳️", floor: 2 },
          { code: "URINAL", label: "소변기", e: "🚹", floor: 2 }
        ]
      },
      {
        code: "PIPE",
        label: "배관 설비",
        points: [
          { code: "MAIN", label: "건물 메인 배관", e: "🏗️", floor: 4, warn: true }
        ]
      }
    ]
  },
  {
    code: "OFFICE",
    label: "사무실 · 회사",
    e: "🏢",
    spaces: [
      {
        code: "TOILET",
        label: "화장실",
        points: [
          { code: "BOWL", label: "변기", e: "🚽", floor: 2 },
          { code: "BASIN", label: "세면대", e: "🫧", floor: 2 },
          { code: "FDRAIN", label: "바닥 배수구", e: "🕳️", floor: 2 },
          { code: "URINAL", label: "소변기", e: "🚹", floor: 2 }
        ]
      },
      {
        code: "KITCHEN",
        label: "주방 · 탕비실",
        points: [{ code: "SINK", label: "탕비실 싱크대", e: "🚰", floor: 2 }]
      },
      {
        code: "PIPE",
        label: "배관 설비",
        points: [
          { code: "MAIN", label: "건물 메인 배관", e: "🏗️", floor: 4, warn: true }
        ]
      }
    ]
  }
];

export const QUESTIONS: QuestionDef[] = [
  {
    code: "SYMPTOM",
    label: "지금 어떤 상태인가요?",
    applies: ["ALL"],
    required: true,
    opts: [
      { code: "SLOW", label: "물이 천천히 빠짐", e: "🐢" },
      { code: "BLOCKED", label: "전혀 안 내려감", e: "🛑" },
      { code: "BACKFLOW", label: "물이 역류함", e: "🔄", sub: "다른 배수구에서 올라오는 경우 포함" },
      { code: "ODOR", label: "악취가 남", e: "👃" },
      { code: "OVERFLOW", label: "지금 물이 넘치는 중", e: "🚨", sub: "즉시 대응이 필요합니다", warn: true }
    ]
  },
  {
    code: "SCOPE",
    label: "막힌 곳이 한 군데인가요, 여러 군데인가요?",
    sub: "원인이 집(가게) 안에 있는지, 건물 공용 배관에 있는지가 갈립니다.",
    applies: ["ALL"],
    required: true,
    opts: [
      { code: "ONE", label: "한 군데만", e: "1️⃣" },
      { code: "MULTI", label: "두 군데 이상 동시에", e: "⚠️", sub: "예: 싱크대와 화장실이 같이", warn: true }
    ]
  },
  {
    code: "HISTORY",
    label: "전에 같은 곳을 작업한 적이 있나요?",
    applies: ["ALL"],
    required: true,
    opts: [
      { code: "NONE", label: "처음입니다", e: "🆕" },
      { code: "RECURRED", label: "뚫었는데 또 막혔습니다", e: "🔁", sub: "스프링·관통기 작업만 했던 경우" },
      { code: "HIGHPRESS", label: "고압세척까지 해봤습니다", e: "💦", sub: "그런데도 재발", warn: true }
    ]
  },
  {
    code: "BIZ",
    label: "업종이 어떻게 되나요?",
    applies: ["SHOP"],
    required: true,
    opts: [
      { code: "GREASY", label: "중식 · 치킨 · 고깃집 · 분식", e: "🍖", sub: "기름 사용이 많은 업종" },
      { code: "NORMAL", label: "한식 · 일식 · 양식", e: "🍚" },
      { code: "CAFE", label: "카페 · 베이커리", e: "☕" },
      { code: "OTHER", label: "그 외 상가", e: "🏬" }
    ]
  },
  {
    code: "TIME",
    label: "언제 작업하면 좋을까요?",
    applies: ["SHOP", "OFFICE"],
    required: false,
    opts: [
      { code: "NOW", label: "지금 당장", e: "⏱️", sub: "영업 중이라도" },
      { code: "BREAK", label: "브레이크타임", e: "🕒" },
      { code: "NIGHT", label: "마감 후 야간", e: "🌙", sub: "21시 이후는 할증이 붙습니다" }
    ]
  }
];

export const STAGES: Record<
  number,
  { name: string; lo: number; hi: number; gear: string; time: string; scope: string }
> = {
  1: {
    name: "1단계 · 단순 관통",
    lo: 70000,
    hi: 120000,
    gear: "석션기, 수동·전동 관통기",
    time: "30분 ~ 1시간",
    scope: "배관 훼손 없는 표면 이물질 제거 (5m 이내)"
  },
  2: {
    name: "2단계 · 배관 스케일링",
    lo: 180000,
    hi: 300000,
    gear: "플렉스샤프트, 배관 내시경 카메라",
    time: "1 ~ 2시간",
    scope: "유지방 슬러지·머리카락 제거 (10m 이내) · 내시경 통수 확인 포함"
  },
  3: {
    name: "3단계 · 식당·상가 특화",
    lo: 350000,
    hi: 550000,
    gear: "온수 플렉스샤프트, 소형 고압세척",
    time: "2 ~ 3시간",
    scope: "F&B 주방배관·트랩·집수정 연결관 (15m 기준, 초과 시 가산)"
  },
  4: {
    name: "4단계 · 고압세척",
    lo: 700000,
    hi: 1200000,
    gear: "엔진형 고압세척기, 내시경, 관로탐지기",
    time: "3 ~ 5시간",
    scope: "다가구 오배수 메인관·상가 메인 배관 전체"
  }
};

export const VISIT = { lo: 30000, hi: 50000 };
export const NIGHT_RATE = 0.3;

export type Selection = {
  place?: string;
  space?: string;
  point?: string;
  SYMPTOM?: string;
  SCOPE?: string;
  HISTORY?: string;
  BIZ?: string;
  TIME?: string;
};

export const placeOf = (code: string | undefined) =>
  PLACES.find((p) => p.code === code);

export function pointOf(sel: Selection) {
  const place = placeOf(sel.place);
  const space = place?.spaces.find((s) => s.code === sel.space);
  const point = space?.points.find((p) => p.code === sel.point);
  return place && space && point ? { place, space, point } : null;
}

export function questionsFor(place: string | undefined): QuestionDef[] {
  if (!place) return [];
  return QUESTIONS.filter(
    (q) => q.applies.includes("ALL") || q.applies.includes(place)
  );
}

/** 필수 항목이 모두 선택됐는지 (템플릿상 TIME은 선택) */
export function isComplete(sel: Selection): boolean {
  if (!pointOf(sel)) return false;
  return questionsFor(sel.place)
    .filter((q) => q.required)
    .every((q) => Boolean(sel[q.code as keyof Selection]));
}

/** 판정 — 템플릿 시트4 stage_floor + 시트7 규칙: stage = min(4, max(floor, 규칙 STAGE_MIN)) */
export function judge(sel: Selection): number {
  const resolved = pointOf(sel);
  let s = resolved ? resolved.point.floor : 1;
  if (sel.place === "SHOP" || sel.place === "OFFICE") s = Math.max(s, 2);
  if (sel.SYMPTOM === "BACKFLOW" || sel.SYMPTOM === "OVERFLOW") s = Math.max(s, 2);
  if (sel.SCOPE === "MULTI") s = Math.max(s, 2);
  if (sel.HISTORY === "RECURRED") s = Math.max(s, 2);
  if (sel.HISTORY === "HIGHPRESS") s = 4;
  if (sel.place === "SHOP" && sel.BIZ === "GREASY") s = Math.max(s, 3);
  if (sel.place === "SHOP" && sel.point === "SINK" && sel.HISTORY === "RECURRED")
    s = Math.max(s, 3);
  return Math.min(s, 4);
}

export function judgeFlags(sel: Selection): string[] {
  return [
    ...(sel.SYMPTOM === "OVERFLOW" ? ["URGENT"] : []),
    ...(sel.SCOPE === "MULTI" ? ["SHARED"] : []),
    ...(sel.TIME === "NIGHT" ? ["SURCHARGE"] : [])
  ];
}

export const FLAG_LABEL: Record<string, string> = {
  URGENT: "긴급 — 물이 넘치는 중",
  SHARED: "공용관 가능성 — 두 곳 이상 동시 막힘",
  SURCHARGE: "야간 할증 적용"
};

export function priceRange(sel: Selection) {
  const st = STAGES[judge(sel)];
  const night = sel.TIME === "NIGHT";
  return {
    lo: night ? Math.round(st.lo * (1 + NIGHT_RATE)) : st.lo,
    hi: night ? Math.round(st.hi * (1 + NIGHT_RATE)) : st.hi
  };
}

const won = (n: number) => n.toLocaleString("ko-KR");

const QUESTION_SHORT: Record<string, string> = {
  SYMPTOM: "상태",
  SCOPE: "막힌 범위",
  HISTORY: "작업 이력",
  BIZ: "업종",
  TIME: "희망 시간대"
};

/** 선택 내용 + 상세 상황 → 접수 증상란 저장용 텍스트 */
export function composeDescription(sel: Selection, detail: string): string {
  const resolved = pointOf(sel);
  if (!resolved) return detail.trim();

  const lines = ["[증상 선택]"];
  lines.push(
    `장소: ${resolved.place.label} / ${resolved.space.label} · ${resolved.point.label}`
  );
  for (const q of questionsFor(sel.place)) {
    const value = sel[q.code as keyof Selection];
    const opt = q.opts.find((o) => o.code === value);
    if (opt) lines.push(`${QUESTION_SHORT[q.code] ?? q.code}: ${opt.label}`);
  }

  const stage = judge(sel);
  const st = STAGES[stage];
  const { lo, hi } = priceRange(sel);
  lines.push(`추정 단계: ${st.name} (예상 ${won(lo)}~${won(hi)}원, 부가세 별도)`);

  const flags = judgeFlags(sel).map((f) => FLAG_LABEL[f] ?? f);
  if (flags.length) lines.push(`참고: ${flags.join(" / ")}`);

  if (detail.trim()) lines.push("", `상세 상황: ${detail.trim()}`);
  return lines.join("\n");
}
