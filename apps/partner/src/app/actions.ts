"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getAccessToken
} from "@/lib/supabase/server";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(formData: FormData, key: string) {
  const value = textValue(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitContractorBidAction(
  companyId: string,
  reportId: string,
  formData: FormData,
) {
  const response = await fetch(
    `${apiBaseUrl}/contractors/${encodeURIComponent(companyId)}/bids`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader()),
      },
      body: JSON.stringify({
        reportId,
        estimatedPrice: numberValue(formData, "estimatedPrice"),
        availableTime: textValue(formData, "availableTime"),
        canWork: true,
        workNote: textValue(formData, "workNote"),
        extraCostPolicy: textValue(formData, "extraCostPolicy"),
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "입찰을 제출하지 못했습니다.");
  }

  // redirect 없이 revalidate만 — 화면 전체 로딩 없이 현재 화면이 갱신된다.
  revalidatePath("/");
  revalidatePath("/bids");
}

function appendText(target: FormData, key: string, value: string | null) {
  if (value) {
    target.append(key, value);
  }
}

function appendFile(
  target: FormData,
  key: string,
  value: FormDataEntryValue | null,
) {
  if (value instanceof File && value.size > 0) {
    target.append(key, value, value.name);
  }
}

export async function registerContractorAction(formData: FormData) {
  const apiFormData = new FormData();

  [
    "email",
    "phone",
    "companyName",
    "representativeName",
    "businessNumber",
    "address",
    "addressDetail",
    "latitude",
    "longitude",
    "serviceRegions",
    "serviceRadiusKm",
    "yearsOfExperience",
    "description",
  ].forEach((key) => appendText(apiFormData, key, textValue(formData, key)));
  appendText(
    apiFormData,
    "marketingConsent",
    formData.get("marketingConsent") === "on" ? "true" : null,
  );
  formData.getAll("specialties").forEach((value) => {
    if (typeof value === "string" && value.trim().length > 0) {
      apiFormData.append("specialties", value);
    }
  });
  appendFile(apiFormData, "businessLicense", formData.get("businessLicense"));
  appendFile(apiFormData, "companyPhoto", formData.get("companyPhoto"));

  const response = await fetch(`${apiBaseUrl}/contractors/register`, {
    method: "POST",
    headers: await authHeader(),
    body: apiFormData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "업체 등록 신청을 처리하지 못했습니다.");
  }

  revalidatePath("/");
  revalidatePath("/register");
  redirect("/");
}

export async function updateContractorPhoneAction(formData: FormData) {
  const phone = textValue(formData, "phone");

  if (!phone) {
    throw new Error("연락처를 입력해 주세요.");
  }

  const response = await fetch(`${apiBaseUrl}/contractors/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify({
      phone,
      marketingConsent: formData.get("marketingConsent") === "on",
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "연락처를 저장하지 못했습니다.");
  }

  revalidatePath("/profile");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function submitWorkUpdateAction(
  companyId: string,
  assignmentId: string,
  formData: FormData,
) {
  const apiFormData = new FormData();
  appendText(apiFormData, "status", textValue(formData, "status"));
  appendText(apiFormData, "note", textValue(formData, "note"));
  appendText(apiFormData, "finalPrice", textValue(formData, "finalPrice"));
  formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 5)
    .forEach((file) => {
      apiFormData.append("photos", file, file.name);
    });

  const response = await fetch(
    `${apiBaseUrl}/contractors/${encodeURIComponent(companyId)}/assignments/${encodeURIComponent(
      assignmentId,
    )}/work-updates`,
    {
      method: "POST",
      headers: await authHeader(),
      body: apiFormData,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "작업 상태를 저장하지 못했습니다.");
  }

  revalidatePath("/");
  revalidatePath("/jobs");
}
