import type { ReactNode } from "react";

export type PillTone = "info" | "ok" | "warn" | "bad" | "mute";

/** 상태 배지 — 색 점 + 라벨. tone으로 의미색을 통일한다. */
export function Pill({ tone = "mute", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`ui-pill tone-${tone}`}>{children}</span>;
}

/** 신고 상태 → 톤 매핑 (양쪽 앱 공용 규칙) */
export function reportStatusTone(status: string | null | undefined): PillTone {
  switch (status) {
    case "APPROVED_FOR_BIDDING":
    case "BIDDING":
    case "AWAITING_ASSIGNMENT":
      return "warn";
    case "ASSIGNED":
    case "DISPATCH_SCHEDULED":
    case "DISPATCHED":
    case "IN_PROGRESS":
      return "info";
    case "RESOLVED":
      return "ok";
    case "ON_HOLD":
    case "CANCELED":
    case "REJECTED":
      return "bad";
    default:
      return "mute";
  }
}

/** 배분 제안 상태 → 톤 */
export function offerStatusTone(status: string | null | undefined): PillTone {
  switch (status) {
    case "OFFERED":
      return "warn";
    case "ACCEPTED":
      return "ok";
    case "REJECTED":
    case "TIMEOUT":
      return "bad";
    default:
      return "mute";
  }
}
