/**
 * 홈페이지 협력 제안(POST /contractors/apply)으로 접수된 업체의 description 파싱.
 * 서버가 "[홈페이지 협력 제안]" 헤더 + "항목: 값" 줄로 저장한다 — 스키마 변경 없이 표시만 구조화.
 */

const APPLY_HEADER = "[홈페이지 협력 제안]";
const MESSAGE_KEY = "전하고 싶은 말";

export type ApplyProposal = {
  rows: { label: string; value: string }[];
  message: string | null;
};

export function parseApplyProposal(
  description: string | null | undefined
): ApplyProposal | null {
  if (!description || !description.trimStart().startsWith(APPLY_HEADER)) {
    return null;
  }

  const rows: { label: string; value: string }[] = [];
  let message: string | null = null;

  for (const line of description.split("\n").slice(1)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const label = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!label || !value) continue;
    if (label === MESSAGE_KEY) {
      message = value;
    } else {
      rows.push({ label, value });
    }
  }

  return { rows, message };
}
