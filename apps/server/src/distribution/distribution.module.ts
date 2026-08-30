import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DistributionController } from "./distribution.controller";
import { DistributionService } from "./distribution.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DistributionController],
  providers: [DistributionService],
  exports: [DistributionService]
})
export class DistributionModule {}
