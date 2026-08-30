import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * 관리자 운영 알림용 텔레그램 봇.
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 로그만 남기고 건너뛴다.
 */
@Injectable()
export class TelegramProvider {
  private readonly logger = new Logger(TelegramProvider.name);
  private readonly token: string | null;
  private readonly chatId: string | null;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? null;
    this.chatId = this.config.get<string>("TELEGRAM_CHAT_ID") ?? null;
  }

  get enabled(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async send(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      this.logger.log(`[텔레그램 미설정] ${text.slice(0, 60)}…`);
      return;
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true
          })
        }
      );
      if (!res.ok) {
        this.logger.warn(`텔레그램 발송 실패: ${res.status}`);
      }
    } catch (error) {
      this.logger.error("텔레그램 발송 오류", error as Error);
    }
  }
}
