export type CustomerReport = {
  id: string;
  reportNo: string;
  channel: string;
  status: string;
  issueType: string | null;
  urgency: string;
  summary: string | null;
  description: string | null;
  addressText: string | null;
  addressDetail: string | null;
  roadAddressText: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  adminApprovedAt: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
  attachmentCount: number;
  messageCount: number;
  bidCount: number;
  assignment: {
    id: string;
    contractorCompanyName: string;
    estimatedPrice: number | null;
    availableTime: string | null;
    selectionReason: string | null;
    customerMessageRendered: string | null;
    assignedAt: string | null;
  } | null;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    reason: string | null;
    createdAt: string | null;
  }>;
  workUpdates: Array<{
    id: string;
    contractorCompanyName: string;
    status: string;
    note: string | null;
    finalPrice: number | null;
    photoUrls: string[];
    createdAt: string | null;
  }>;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getCustomerReportsByPhone(phone: string | null | undefined) {
  if (!phone?.trim()) {
    return Promise.resolve<CustomerReport[]>([]);
  }

  return fetchJson<CustomerReport[]>(
    `/customers/reports?phone=${encodeURIComponent(phone.trim())}`,
    []
  );
}

export function getCustomerReportByVerification(
  reportNo: string | null | undefined,
  verificationCode: string | null | undefined
) {
  if (!reportNo?.trim() || !verificationCode?.trim()) {
    return Promise.resolve<CustomerReport | null>(null);
  }

  return fetchJson<CustomerReport | null>(
    `/customers/reports/verify?reportNo=${encodeURIComponent(
      reportNo.trim()
    )}&verificationCode=${encodeURIComponent(verificationCode.trim())}`,
    null
  );
}
