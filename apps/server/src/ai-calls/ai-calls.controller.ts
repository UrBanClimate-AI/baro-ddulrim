import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { AdminGuard } from "../auth/admin.guard";
import { AiCallAgentService } from "./ai-call-agent.service";
import { AiCallsService } from "./ai-calls.service";
import { SavePromptDto } from "./dto/save-prompt.dto";

@Controller("ai-calls")
export class AiCallsController {
  constructor(
    private readonly aiCalls: AiCallsService,
    private readonly agent: AiCallAgentService,
    private readonly config: ConfigService
  ) {}

  /**
   * ClawOps 웹훅 수신 (녹음·전사·요약·상태) — 비인증 공개 경로.
   * CLAWOPS_WEBHOOK_SECRET 이 설정돼 있으면 X-Signature HMAC-SHA256 을 검증한다.
   */
  @Post("webhooks/clawops")
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-signature") signature: string | undefined,
    @Body() payload: Record<string, unknown>
  ) {
    const secret = this.config.get<string>("CLAWOPS_WEBHOOK_SECRET");
    if (secret) {
      const raw = req.rawBody;
      if (!raw || !signature) {
        throw new UnauthorizedException("서명이 없습니다.");
      }
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const provided = signature.replace(/^sha256=/, "").trim();
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(provided, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException("서명이 올바르지 않습니다.");
      }
    }
    return this.aiCalls.applyWebhook(payload ?? {});
  }

  // ── 관리자 ──

  @Get()
  @UseGuards(AdminGuard)
  async findAll() {
    return {
      agent: this.agent.status,
      calls: await this.aiCalls.findAll()
    };
  }

  @Get("prompt")
  @UseGuards(AdminGuard)
  async getPrompt() {
    return this.aiCalls.getPrompt();
  }

  @Post("prompt")
  @UseGuards(AdminGuard)
  async savePrompt(@Body() dto: SavePromptDto) {
    const prompt = await this.aiCalls.savePrompt(dto.content, dto.note);
    // 상주 에이전트가 있으면 새 프롬프트로 재시작해 즉시 반영한다.
    const agent = await this.agent.restart();
    return { ...prompt, agent };
  }

  @Get(":id")
  @UseGuards(AdminGuard)
  async findOne(@Param("id") id: string) {
    return this.aiCalls.findOne(id);
  }
}
