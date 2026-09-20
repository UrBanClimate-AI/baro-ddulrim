import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { toIso } from "../common/format";
import { PrismaService } from "../prisma/prisma.service";

/** 관리자 프롬프트가 아직 없을 때 에이전트가 쓰는 기본 프롬프트. */
export const DEFAULT_AI_CALL_PROMPT = `당신은 "하수구랩"의 전화 접수 상담원입니다. 존댓말의 한국어로 친절하고 간결하게 응대합니다.

역할: 배수구 막힘·역류·침수·악취 등 배수 문제 신고 전화를 받아 아래 정보를 자연스럽게 수집합니다.
1) 어떤 문제인지 (증상: 막힘 / 역류 / 물 넘침 / 악취)
2) 어디인지 (집·아파트 / 가게·식당 / 사무실, 그리고 변기·싱크대·바닥 배수구 등 지점)
3) 주소 (시·구·동까지, 아파트면 동·호수도)
4) 언제부터인지, 이전에 작업한 적이 있는지
5) 연락 가능한 전화번호 확인

안내 원칙:
- 정확한 금액은 현장 확인 후 확정된다고 안내하고, 기본 출동·진단비는 3만~5만원(작업 진행 시 면제)이라고만 말합니다.
- 지금 물이 넘치는 긴급 상황이면 수도 밸브를 잠그도록 먼저 안내합니다.
- 수집이 끝나면 "접수되었고 담당자가 확인 후 곧 연락드린다"고 마무리합니다.
- 모르는 내용은 지어내지 말고 담당자 확인 후 연락드린다고 답합니다.`;

const CALL_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  ENDED: "ENDED",
  FAILED: "FAILED"
} as const;

@Injectable()
export class AiCallsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 통화 기록 ──

  async findAll() {
    const calls = await this.prisma.aiCall.findMany({
      orderBy: { startedAt: "desc" },
      take: 200,
      include: {
        report: { select: { reportNo: true, status: true } },
        _count: { select: { events: true } }
      }
    });
    return calls.map((call) => this.serializeCall(call));
  }

  async findOne(id: string) {
    const call = await this.prisma.aiCall.findUnique({
      where: { id },
      include: {
        report: { select: { reportNo: true, status: true } },
        _count: { select: { events: true } }
      }
    });
    if (!call) throw new NotFoundException("통화 기록을 찾을 수 없습니다.");
    return this.serializeCall(call);
  }

  // ── 에이전트 이벤트 반영 (SDK) ──

  async recordCallStart(input: {
    externalCallId: string;
    fromNumber?: string | null;
    toNumber?: string | null;
    direction?: string;
    startedAt?: Date;
  }) {
    const call = await this.prisma.aiCall.upsert({
      where: { externalCallId: input.externalCallId },
      update: {
        fromNumber: input.fromNumber ?? undefined,
        toNumber: input.toNumber ?? undefined,
        status: CALL_STATUS.IN_PROGRESS
      },
      create: {
        externalCallId: input.externalCallId,
        fromNumber: input.fromNumber ?? null,
        toNumber: input.toNumber ?? null,
        direction: input.direction ?? "INBOUND",
        startedAt: input.startedAt ?? new Date(),
        status: CALL_STATUS.IN_PROGRESS
      }
    });
    await this.appendEvent(call.id, "call_start", {
      fromNumber: input.fromNumber,
      toNumber: input.toNumber
    });
    return call;
  }

  /** 전사 한 줄 추가 — transcriptText에 "역할: 내용" 형식으로 누적한다. */
  async appendTranscript(externalCallId: string, role: string, text: string) {
    const clean = text?.trim();
    if (!clean) return;
    const call = await this.ensureCall(externalCallId);
    const speaker = role === "user" ? "고객" : role === "assistant" ? "상담원" : role;
    const line = `${speaker}: ${clean}`;
    await this.prisma.aiCall.update({
      where: { id: call.id },
      data: {
        transcriptText: call.transcriptText
          ? `${call.transcriptText}\n${line}`
          : line
      }
    });
    await this.appendEvent(call.id, "transcript", { role, text: clean });
  }

  async recordCallEnd(
    externalCallId: string,
    input: { failed?: boolean; durationSec?: number | null; reason?: string | null }
  ) {
    const call = await this.ensureCall(externalCallId);
    const endedAt = new Date();
    const durationSec =
      input.durationSec ??
      Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000));
    await this.prisma.aiCall.update({
      where: { id: call.id },
      data: {
        status: input.failed ? CALL_STATUS.FAILED : CALL_STATUS.ENDED,
        endedAt,
        durationSec
      }
    });
    await this.appendEvent(call.id, input.failed ? "call_failed" : "call_end", {
      durationSec,
      reason: input.reason ?? null
    });
  }

  // ── ClawOps 웹훅 반영 (녹음·전사·요약 등) ──

  async applyWebhook(payload: Record<string, unknown>) {
    const externalCallId = this.extractString(payload, [
      "call_id",
      "callId",
      "callSid",
      "id"
    ]);
    if (!externalCallId) {
      return { ok: false, reason: "call id 없음" };
    }
    const call = await this.ensureCall(externalCallId, payload);

    const eventType =
      this.extractString(payload, ["event", "type", "event_type"]) ?? "webhook";

    const recordingUrl = this.extractString(payload, [
      "recording_url",
      "recordingUrl",
      "url"
    ]);
    const summary = this.extractString(payload, ["summary", "summary_text"]);
    const transcript = this.extractString(payload, [
      "transcript",
      "transcript_text",
      "text"
    ]);
    const durationSec = this.extractNumber(payload, [
      "duration",
      "duration_sec",
      "durationSec"
    ]);

    await this.prisma.aiCall.update({
      where: { id: call.id },
      data: {
        ...(recordingUrl && eventType.toLowerCase().includes("record")
          ? { recordingUrl }
          : {}),
        ...(summary ? { summary } : {}),
        // 웹훅 전사가 오면 SDK 누적본보다 우선한다 (전문 STT 결과).
        ...(transcript && eventType.toLowerCase().includes("transcript")
          ? { transcriptText: transcript }
          : {}),
        ...(durationSec != null ? { durationSec } : {})
      }
    });
    await this.appendEvent(call.id, `webhook:${eventType}`, payload);
    return { ok: true };
  }

  // ── 프롬프트 ──

  async getPrompt() {
    const [current, history] = await Promise.all([
      this.prisma.aiCallPrompt.findFirst({ orderBy: { createdAt: "desc" } }),
      this.prisma.aiCallPrompt.findMany({
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);
    return {
      content: current?.content ?? DEFAULT_AI_CALL_PROMPT,
      isDefault: current == null,
      updatedAt: toIso(current?.createdAt ?? null),
      history: history.map((item) => ({
        id: item.id,
        content: item.content,
        note: item.note,
        createdAt: toIso(item.createdAt)
      }))
    };
  }

  async currentPromptContent() {
    const current = await this.prisma.aiCallPrompt.findFirst({
      orderBy: { createdAt: "desc" }
    });
    return current?.content ?? DEFAULT_AI_CALL_PROMPT;
  }

  async savePrompt(content: string, note?: string | null) {
    const clean = content?.trim();
    if (!clean) throw new NotFoundException("프롬프트 내용을 입력해 주세요.");
    await this.prisma.aiCallPrompt.create({
      data: { content: clean, note: note?.trim() || null }
    });
    return this.getPrompt();
  }

  /** 통화 → 신고 연결 (신고 생성 후 호출) */
  async linkReport(aiCallId: string, reportId: string) {
    await this.prisma.aiCall.update({
      where: { id: aiCallId },
      data: { reportId }
    });
  }

  // ── 내부 ──

  private async ensureCall(
    externalCallId: string,
    payload?: Record<string, unknown>
  ) {
    const existing = await this.prisma.aiCall.findUnique({
      where: { externalCallId }
    });
    if (existing) return existing;
    return this.prisma.aiCall.create({
      data: {
        externalCallId,
        fromNumber: payload ? this.extractString(payload, ["from", "from_number", "fromNumber"]) : null,
        toNumber: payload ? this.extractString(payload, ["to", "to_number", "toNumber"]) : null
      }
    });
  }

  private async appendEvent(
    aiCallId: string,
    type: string,
    payload: unknown
  ) {
    await this.prisma.aiCallEvent.create({
      data: { aiCallId, type, payload: (payload ?? {}) as Prisma.InputJsonValue }
    });
  }

  private extractString(
    payload: Record<string, unknown>,
    keys: string[]
  ): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  private extractNumber(
    payload: Record<string, unknown>,
    keys: string[]
  ): number | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    }
    return null;
  }

  private serializeCall(call: {
    id: string;
    provider: string;
    externalCallId: string;
    direction: string;
    fromNumber: string | null;
    toNumber: string | null;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    durationSec: number | null;
    recordingUrl: string | null;
    transcriptText: string | null;
    summary: string | null;
    reportId: string | null;
    report: { reportNo: string; status: string } | null;
    _count: { events: number };
  }) {
    return {
      id: call.id,
      provider: call.provider,
      externalCallId: call.externalCallId,
      direction: call.direction,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      status: call.status,
      startedAt: toIso(call.startedAt),
      endedAt: toIso(call.endedAt),
      durationSec: call.durationSec,
      recordingUrl: call.recordingUrl,
      transcriptText: call.transcriptText,
      summary: call.summary,
      reportId: call.reportId,
      reportNo: call.report?.reportNo ?? null,
      reportStatus: call.report?.status ?? null,
      eventCount: call._count.events
    };
  }
}
