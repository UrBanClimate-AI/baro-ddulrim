import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AiCallAgentService } from "./ai-call-agent.service";
import { AiCallsController } from "./ai-calls.controller";
import { AiCallsService } from "./ai-calls.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiCallsController],
  providers: [AiCallsService, AiCallAgentService],
  exports: [AiCallsService]
})
export class AiCallsModule {}
