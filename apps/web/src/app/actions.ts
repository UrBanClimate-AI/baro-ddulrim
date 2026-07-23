"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function appendText(formData: FormData, key: string, value: string | null) {
  if (value) {
    formData.append(key, value);
  }
}

export async function createCustomerReportAction(formData: FormData) {
  const apiFormData = new FormData();

  appendText(apiFormData, "phone", textValue(formData, "phone"));
  appendText(apiFormData, "location", textValue(formData, "location"));
  appendText(apiFormData, "placeName", textValue(formData, "placeName"));
  appendText(
    apiFormData,
    "roadAddressText",
    textValue(formData, "roadAddressText"),
  );
  appendText(apiFormData, "latitude", textValue(formData, "latitude"));
  appendText(apiFormData, "longitude", textValue(formData, "longitude"));
  appendText(apiFormData, "description", textValue(formData, "description"));
  appendText(apiFormData, "urgency", textValue(formData, "urgency"));
  appendText(
    apiFormData,
    "marketingConsent",
    formData.get("marketingConsent") === "on" ? "true" : null,
  );

  formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 5)
    .forEach((file) => {
      apiFormData.append("attachments", file, file.name);
    });

  const response = await fetch(`${apiBaseUrl}/reports`, {
    method: "POST",
    body: apiFormData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "신고를 접수하지 못했습니다.");
  }

  const report = (await response.json()) as {
    reportNo: string;
    verificationCode: string;
  };

  revalidatePath("/report/new");
  revalidatePath("/report/lookup");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(
    `/report/${encodeURIComponent(report.reportNo)}?verificationCode=${encodeURIComponent(
      report.verificationCode,
    )}&created=1`,
  );
}

