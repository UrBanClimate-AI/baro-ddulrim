export const statusLabels: Record<string, string> = {
  COLLECTING_INFO: "정보 수집중",
  AI_ANALYZED: "AI 분석 완료",
  ADMIN_REVIEW: "관리자 검수중",
  CUSTOMER_INFO_REQUIRED: "추가질문 필요",
  APPROVED_FOR_BIDDING: "배분 승인",
  BIDDING: "배분중",
  AWAITING_ASSIGNMENT: "배분 대기",
  ASSIGNED: "업체 배정",
  DISPATCH_SCHEDULED: "출동 예정",
  DISPATCHED: "출동 완료",
  IN_PROGRESS: "처리중",
  RESOLVED: "해결 완료",
  ON_HOLD: "보류",
  CANCELED: "취소",
  REJECTED: "반려"
};

// 상태를 5개 톤 그룹으로 묶는다 (배지 색상용)
export function statusTone(status: string | null | undefined) {
  switch (status) {
    case "APPROVED_FOR_BIDDING":
    case "BIDDING":
    case "AWAITING_ASSIGNMENT":
      return "tone-bidding";
    case "ASSIGNED":
    case "DISPATCH_SCHEDULED":
    case "DISPATCHED":
    case "IN_PROGRESS":
      return "tone-working";
    case "RESOLVED":
      return "tone-resolved";
    case "ON_HOLD":
    case "CANCELED":
    case "REJECTED":
      return "tone-exception";
    default:
      return "tone-review";
  }
}

export const issueTypeLabels: Record<string, string> = {
  FLOOD: "침수",
  DRAIN: "배수구",
  SEWER_BACKFLOW: "역류",
  ODOR: "악취",
  EMERGENCY: "긴급출동",
  OTHER: "기타"
};

export const urgencyLabels: Record<string, string> = {
  NORMAL: "일반",
  URGENT: "긴급",
  EMERGENCY: "매우 긴급"
};

export const channelLabels: Record<string, string> = {
  WEB: "웹",
  APP: "앱",
  SMS: "문자",
  KAKAO: "카카오톡",
  AI_CALL: "AI 전화",
  PHONE: "전화"
};

export const templateChannelLabels: Record<string, string> = {
  WEB: "웹",
  SMS: "문자",
  KAKAO: "카카오톡",
  AI_CALL: "AI 전화"
};

export const actorLabels: Record<string, string> = {
  AI: "AI",
  ADMIN: "관리자",
  CONTRACTOR: "업체",
  CUSTOMER: "고객",
  SYSTEM: "시스템"
};

export const bidStatusLabels: Record<string, string> = {
  SUBMITTED: "제출",
  SELECTED: "선택",
  WITHDRAWN: "철회",
  REJECTED: "미선정"
};

export const contractorStatusLabels: Record<string, string> = {
  REVIEWING: "검토중",
  APPROVED: "승인",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  RESTRICTED: "활동 제한",
  REJECTED: "반려"
};

export const reportFieldLabels: Record<string, string> = {
  summary: "요약",
  description: "상세 내용",
  issueType: "유형",
  urgency: "긴급도",
  addressText: "주소",
  roadAddressText: "도로명 주소",
  placeName: "장소명",
  latitude: "위도",
  longitude: "경도"
};

export function labelOf(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return labels[value] ?? value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "-";
  }

  // 서버(Node)와 브라우저의 로케일 차이(AM/오전)로 인한 hydration 불일치를 막기 위해
  // Intl 대신 결정적 포맷을 사용한다.
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${ampm} ${pad(h12)}:${pad(d.getMinutes())}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function formatMinutes(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  if (value < 60) {
    return `${value}분`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
