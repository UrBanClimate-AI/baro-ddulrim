import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCallsService } from "./ai-calls.service";

type ClawOpsAgentLike = {
  on(event: string, handler: (...args: unknown[]) => void | Promise<void>): unknown;
  connect(): Promise<void>;
  drain(options?: { timeoutMs?: number }): Promise<void>;
  disconnect(): Promise<void>;
};

/**
 * ClawOps 인바운드 에이전트 상주 워커.
 * CLAWOPS_API_KEY / CLAWOPS_ACCOUNT_ID / CLAWOPS_AGENT_NUMBER / OPENAI_API_KEY 가
 * 모두 있어야 시작하며, 없으면 조용히 비활성화된다 (서버는 정상 기동).
 * 프롬프트는 DB의 최신 버전을 사용하고, 관리자가 저장하면 restart()로 반영한다.
 */
@Injectable()
export class AiCallAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("AiCallAgent");
  private agent: ClawOpsAgentLike | null = null;
  private starting = false;

  constructor(
    private readonly config: ConfigService,
    private readonly aiCalls: AiCallsService
  ) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get<string>("CLAWOPS_API_KEY") &&
        this.config.get<string>("CLAWOPS_ACCOUNT_ID") &&
        this.config.get<string>("CLAWOPS_AGENT_NUMBER") &&
        this.config.get<string>("OPENAI_API_KEY")
    );
  }

  get status() {
    return {
      enabled: this.enabled,
      running: this.agent != null,
      agentNumber: this.config.get<string>("CLAWOPS_AGENT_NUMBER") ?? null
    };
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        "ClawOps 에이전트 비활성화 — CLAWOPS_API_KEY/CLAWOPS_ACCOUNT_ID/CLAWOPS_AGENT_NUMBER/OPENAI_API_KEY 설정 시 자동 시작"
      );
      return;
    }
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  async start() {
    if (this.agent || this.starting || !this.enabled) return;
    this.starting = true;
    try {
      const { ClawOpsAgent, OpenAIRealtime } = await import(
        "@teamlearners/clawops/agent"
      );
      const systemPrompt = await this.aiCalls.currentPromptContent();

      const agent = new ClawOpsAgent({
        apiKey: this.config.get<string>("CLAWOPS_API_KEY"),
        accountId: this.config.get<string>("CLAWOPS_ACCOUNT_ID"),
        from: this.config.get<string>("CLAWOPS_AGENT_NUMBER")!,
        session: new OpenAIRealtime({
          apiKey: this.config.get<string>("OPENAI_API_KEY"),
          systemPrompt,
          language: "ko"
        })
      }) as unknown as ClawOpsAgentLike;

      agent.on("call_start", async (...args: unknown[]) => {
        const call = args[0] as {
          callId: string;
          fromNumber?: string;
          toNumber?: string;
          direction?: string;
        };
        try {
          await this.aiCalls.recordCallStart({
            externalCallId: call.callId,
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            direction: String(call.direction ?? "INBOUND").toUpperCase()
          });
        } catch (error) {
          this.logger.error(`call_start 기록 실패: ${error}`);
        }
      });

      agent.on("transcript", async (...args: unknown[]) => {
        const [call, role, text] = args as [
          { callId: string },
          string,
          string
        ];
        try {
          await this.aiCalls.appendTranscript(call.callId, role, text);
        } catch (error) {
          this.logger.error(`전사 기록 실패: ${error}`);
        }
      });

      agent.on("call_end", async (...args: unknown[]) => {
        const call = args[0] as { callId: string };
        try {
          await this.aiCalls.recordCallEnd(call.callId, {});
        } catch (error) {
          this.logger.error(`call_end 기록 실패: ${error}`);
        }
      });

      agent.on("call_failed", async (...args: unknown[]) => {
        const call = args[0] as { callId?: string };
        if (!call?.callId) return;
        try {
          await this.aiCalls.recordCallEnd(call.callId, {
            failed: true,
            reason: String((args[1] as unknown) ?? "")
          });
        } catch (error) {
          this.logger.error(`call_failed 기록 실패: ${error}`);
        }
      });

      await agent.connect();
      this.agent = agent;
      this.logger.log(
        `ClawOps 에이전트 시작 — 번호 ${this.config.get<string>("CLAWOPS_AGENT_NUMBER")}`
      );
    } catch (error) {
      this.logger.error(`ClawOps 에이전트 시작 실패: ${error}`);
    } finally {
      this.starting = false;
    }
  }

  async stop() {
    const agent = this.agent;
    if (!agent) return;
    this.agent = null;
    try {
      await agent.drain({ timeoutMs: 10000 });
    } catch {
      // drain 실패 시에도 연결은 정리한다.
    }
    try {
      await agent.disconnect();
    } catch {
      // 이미 끊긴 경우 무시.
    }
  }

  /** 프롬프트 변경 등으로 에이전트를 새 설정으로 재시작한다. */
  async restart() {
    await this.stop();
    await this.start();
    return this.status;
  }
}
