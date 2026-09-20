"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/server";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function savePromptAction(formData: FormData) {
  const token = await getAccessToken();
  const response = await fetch(`${apiBaseUrl}/ai-calls/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      content: textValue(formData, "content"),
      note: textValue(formData, "note")
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "프롬프트를 저장하지 못했습니다.");
  }

  revalidatePath("/admin/ai-calls/prompt");
  redirect("/admin/ai-calls/prompt");
}

export async function createIntakeReportAction(formData: FormData) {
  const token = await getAccessToken();
  const response = await fetch(`${apiBaseUrl}/reports/admin-intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      channel: textValue(formData, "channel") ?? "AI_CALL",
      phone: textValue(formData, "phone"),
      description: textValue(formData, "description"),
      urgency: textValue(formData, "urgency") ?? undefined,
      summary: textValue(formData, "summary"),
      addressText: textValue(formData, "addressText"),
      addressDetail: textValue(formData, "addressDetail"),
      aiCallId: textValue(formData, "aiCallId")
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "신고를 등록하지 못했습니다.");
  }

  const report = (await response.json()) as { reportNo?: string };

  revalidatePath("/admin/ai-calls");
  revalidatePath("/admin/reports");

  if (report.reportNo) {
    redirect(`/admin/reports/${encodeURIComponent(report.reportNo)}`);
  }
  redirect("/admin/reports");
}
