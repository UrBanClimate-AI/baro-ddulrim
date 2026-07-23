import { getAccessToken } from "@/lib/supabase/server";

export type ContractorCompany = {
  id: string;
  companyName: string;
  representativeName: string;
  businessNumber?: string;
  managerName?: string;
  phone: string;
  email: string;
  status: string;
  statusReason?: string | null;
  serviceRegions: string[];
  serviceRadiusKm: number | null;
  yearsOfExperience?: number | null;
  specialties?: string[];
  description?: string | null;
  address: string | null;
  addressDetail?: string | null;
  latitude: number | null;
  longitude: number | null;
  bidCount: number;
  assignmentCount: number;
  workUpdateCount: number;
  approvedAt?: string | null;
};

export type ContractorBid = {
  id: string;
  reportId: string;
  contractorCompanyId: string;
  estimatedPrice: number | null;
  availableTime: string | null;
  canWork: boolean;
  workNote: string | null;
  extraCostPolicy: string | null;
  status: string;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ContractorOpportunity = {
  id: string;
  reportNo: string;
  status: string;
  issueType: string | null;
  urgency: string;
  summary: string | null;
  description: string | null;
  addressText: string | null;
  roadAddressText: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  bidCount: number;
  attachmentCount: number;
  messageCount: number;
  createdAt: string | null;
  adminApprovedAt: string | null;
  myBid: ContractorBid | null;
};

export type ContractorBidWithReport = ContractorBid & {
  report: {
    id: string;
    reportNo: string;
    status: string;
    issueType: string | null;
    urgency: string;
    summary: string | null;
    placeName: string | null;
    addressText: string | null;
    assignedCompanyName: string | null;
    createdAt: string | null;
    assignedAt: string | null;
    resolvedAt: string | null;
  };
};

export type ContractorAssignment = {
  id: string;
  reportId: string;
  bidId: string;
  contractorCompanyId: string;
  selectionReason: string | null;
  customerMessageRendered: string | null;
  assignedAt: string | null;
  createdAt: string | null;
  bid: {
    estimatedPrice: number | null;
    availableTime: string | null;
    workNote: string | null;
    extraCostPolicy: string | null;
  };
  report: {
    id: string;
    reportNo: string;
    status: string;
    issueType: string | null;
    urgency: string;
    summary: string | null;
    description: string | null;
    customerPhone: string;
    addressText: string | null;
    roadAddressText: string | null;
    placeName: string | null;
    latitude: number | null;
    longitude: number | null;
    assignedAt: string | null;
    resolvedAt: string | null;
    createdAt: string | null;
  };
  latestWorkStatus: string | null;
  workUpdates: Array<{
    id: string;
    status: string;
    note: string | null;
    finalPrice: number | null;
    photoUrls: string[];
    createdAt: string | null;
  }>;
};

export type ContractorContext = {
  id: string;
  email: string;
  name: string;
  phone: string;
  marketingOptIn?: boolean;
  company: ContractorCompany | null;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
}

async function authedFetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await authedFetch(path);

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

/** 로그인한 업체 계정과 등록된 업체 프로필을 조회한다. */
export async function getMyContext(): Promise<ContractorContext | null> {
  try {
    const response = await authedFetch("/contractors/me");

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ContractorContext;
  } catch {
    return null;
  }
}

export function getContractorOpportunities(companyId: string) {
  return authedFetchJson<ContractorOpportunity[]>(
    `/contractors/${encodeURIComponent(companyId)}/opportunities`,
    []
  );
}

export function getContractorBids(companyId: string) {
  return authedFetchJson<ContractorBidWithReport[]>(
    `/contractors/${encodeURIComponent(companyId)}/bids`,
    []
  );
}

export function getContractorAssignments(companyId: string) {
  return authedFetchJson<ContractorAssignment[]>(
    `/contractors/${encodeURIComponent(companyId)}/assignments`,
    []
  );
}
