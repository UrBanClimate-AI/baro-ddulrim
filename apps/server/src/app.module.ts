import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AiModule } from "./ai/ai.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ContractorsModule } from "./contractors/contractors.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DistributionModule } from "./distribution/distribution.module";
import { MapsModule } from "./maps/maps.module";
import { MessageTemplatesModule } from "./message-templates/message-templates.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RegionsModule } from "./regions/regions.module";
import { ReportsModule } from "./reports/reports.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env"],
      isGlobal: true
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AiModule,
    NotificationsModule,
    DashboardModule,
    DistributionModule,
    ContractorsModule,
    CustomersModule,
    MapsModule,
    MessageTemplatesModule,
    RegionsModule,
    ReportsModule,
    SettingsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
