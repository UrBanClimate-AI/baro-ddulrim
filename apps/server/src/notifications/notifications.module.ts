import { Global, Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { EmailProvider } from "./providers/email.provider";
import { PushProvider } from "./providers/push.provider";
import { SmsProvider } from "./providers/sms.provider";
import { TelegramProvider } from "./providers/telegram.provider";

@Global()
@Module({
  providers: [
    NotificationsService,
    EmailProvider,
    SmsProvider,
    PushProvider,
    TelegramProvider
  ],
  exports: [NotificationsService]
})
export class NotificationsModule {}
