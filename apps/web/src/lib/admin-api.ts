import { getAccessToken } from "@/lib/supabase/server";

export type DashboardSummary = {
  totalReports: number;
  adminReviewCount: number;
  biddingCount: number;
  assignedCount: number;
  resolvedCount: number;
  urgentCount: number;
  activeContractors: number;
  mapMarkerCount: number;
  statusCounts: Record<string, number>;
  channelCounts: Record<string, number>;
  issueTypeCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  contractorStats: Array<{
    companyId: string;
    companyName: string;
    assignedCount: number;
    resolvedCount: number;
  }>;
  averageMinutes: {
    approval: number | null;
    assignment: number | null;
    resolution: number | null;
  };
};

export type ReportListItem = {
  id: string;
  reportNo: string;
  customerPhone: string;
  channel: string;
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
  messageCount: number;
  attachmentCount: number;
  workUpdateCount: number;
  assignedCompanyName: string | null;
  minEstimatedPrice: number | null;
  createdAt: string | null;
  adminApprovedAt: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
};

export type ReportDetail = ReportListItem & {
  verificationCode: string;
  messages: Array<{
    id: string;
    senderType: string;
    messageType: string;
    content: string;
    createdAt: string | null;
  }>;
  attachments: Array<{
    id: string;
    fileType: string;
    fileUrl: string;
    originalName: string | null;
    createdAt: string | null;
  }>;
  aiAnalyses: Array<{
    id: string;
    provider: string;
    model: string;
    summary: string | null;
    issueType: string | null;
    urgency: string | null;
    missingFields: string[];
    vendorDescription: string | null;
    confidence: number | null;
    needsReview: boolean;
    createdAt: string | null;
  }>;
  revisions: Array<{
    id: string;
    editorType: string;
    fieldName: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
    reason: string | null;
    createdAt: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    reason: string | null;
    createdAt: string | null;
  }>;
  locationCandidates: Array<{
    id: string;
    provider: string;
    title: string;
    addressText: string | null;
    roadAddressText: string | null;
    placeName: string | null;
    category: string | null;
    latitude: number | null;
    longitude: number | null;
    confidence: number | null;
    createdAt: string | null;
  }>;
  bids: Array<{
    id: string;
    contractorCompanyId: string;
    contractorCompanyName: string;
    estimatedPrice: number | null;
    availableTime: string | null;
    canWork: boolean;
    workNote: string | null;
    extraCostPolicy: string | null;
    status: string;
    submittedAt: string | null;
  }>;
  assignment: {
    id: string;
    contractorCompanyName: string;
    selectionReason: string | null;
    customerMessageRendered: string | null;
    assignedAt: string | null;
  } | null;
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

export type MessageTemplate = {
  id: string;
  name: string;
  channel: string;
  content: string;
  isActive: boolean;
  usageCount: number;
  versionCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  versions: Array<{
    id: string;
    versionNo: number;
    content: string;
    createdAt: string | null;
  }>;
};

export type AdminContractorCompany = {
  id: string;
  companyName: string;
  representativeName: string;
  businessNumber: string;
  businessLicenseFileUrl: string | null;
  companyPhotoUrl: string | null;
  managerName: string;
  phone: string;
  email: string;
  status: string;
  statusReason: string | null;
  serviceRegions: string[];
  serviceRadiusKm: number | null;
  yearsOfExperience: number | null;
  specialties: string[];
  description: string | null;
  address: string | null;
  addressDetail: string | null;
  latitude: number | null;
  longitude: number | null;
  bidCount: number;
  assignmentCount: number;
  workUpdateCount: number;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AppSetting = {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string | null;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getDashboardSummary() {
  return fetchJson<DashboardSummary>("/dashboard/summary", {
    totalReports: 0,
    adminReviewCount: 0,
    biddingCount: 0,
    assignedCount: 0,
    resolvedCount: 0,
    urgentCount: 0,
    activeContractors: 0,
    mapMarkerCount: 0,
    statusCounts: {},
    channelCounts: {},
    issueTypeCounts: {},
    regionCounts: {},
    contractorStats: [],
    averageMinutes: {
      approval: null,
      assignment: null,
      resolution: null
    }
  });
}

export type ClassificationField = {
  total: number;
  correct: number;
  misclassified: number;
  accuracy: number | null;
  byLabel: {
    label: string;
    total: number;
    correct: number;
    accuracy: number | null;
  }[];
  confusion: { from: string; to: string; count: number }[];
  cases: {
    reportNo: string;
    aiValue: string;
    finalValue: string;
    reason: string | null;
    changedAt: string | null;
  }[];
};

export type ClassificationPerformance = {
  issueType: ClassificationField;
  urgency: ClassificationField;
};

const emptyClassificationField: ClassificationField = {
  total: 0,
  correct: 0,
  misclassified: 0,
  accuracy: null,
  byLabel: [],
  confusion: [],
  cases: []
};

export function getClassificationPerformance() {
  return fetchJson<ClassificationPerformance>("/dashboard/classification", {
    issueType: emptyClassificationField,
    urgency: emptyClassificationField
  });
}

export function getReports() {
  return fetchJson<ReportListItem[]>("/reports", []);
}

export function getReport(id: string) {
  return fetchJson<ReportDetail | null>(`/reports/${encodeURIComponent(id)}`, null);
}

export function getMessageTemplates() {
  return fetchJson<MessageTemplate[]>("/message-templates", []);
}

export function getAdminContractorCompanies() {
  return fetchJson<AdminContractorCompany[]>("/contractors/admin/companies", []);
}

export type ReportOffer = {
  id: string;
  sequence: number;
  companyName: string;
  distanceKm: number | null;
  status: string;
  rejectReason: string | null;
  rejectReasonDetail: string | null;
  offeredAt: string;
  deadline: string;
  respondedAt: string | null;
};

export function getReportOffers(reportId: string) {
  return fetchJson<ReportOffer[]>(
    `/distribution/reports/${encodeURIComponent(reportId)}/offers`,
    []
  );
}

export type CompanyActivity = {
  counts: {
    assigned: number;
    completed: number;
    offered: number;
    rejected: number;
  };
  assignments: {
    reportNo: string;
    summary: string | null;
    status: string;
    assignedAt: string | null;
    resolvedAt: string | null;
  }[];
  offers: {
    reportNo: string;
    summary: string | null;
    status: string;
    rejectReason: string | null;
    offeredAt: string | null;
  }[];
};

export function getCompanyActivity(companyId: string) {
  return fetchJson<CompanyActivity>(
    `/contractors/admin/companies/${encodeURIComponent(companyId)}/activity`,
    { counts: { assigned: 0, completed: 0, offered: 0, rejected: 0 }, assignments: [], offers: [] }
  );
}

export function getAppSettings() {
  return fetchJson<AppSetting[]>("/settings", []);
}
