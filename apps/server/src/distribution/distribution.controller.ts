import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentAccount } from "../auth/auth.decorators";
import type { AuthAccount } from "../auth/auth.types";
import { ContractorGuard } from "../auth/contractor.guard";
import { DistributionService } from "./distribution.service";
import { RejectOfferDto } from "./dto/reject-offer.dto";

@Controller("distribution")
export class DistributionController {
  constructor(private readonly distribution: DistributionService) {}

  // ── 업체(partner) ──
  @Get("me/offers")
  @UseGuards(ContractorGuard)
  async myOffers(@CurrentAccount() account: AuthAccount) {
    if (!account.companyId) return [];
    return this.distribution.getMyOffers(account.companyId);
  }

  @Post("offers/:id/accept")
  @UseGuards(ContractorGuard)
  async accept(@CurrentAccount() account: AuthAccount, @Param("id") id: string) {
    if (!account.companyId) throw new BadRequestException("등록된 업체가 없습니다.");
    return this.distribution.acceptOffer(id, account.companyId);
  }

  @Post("offers/:id/reject")
  @UseGuards(ContractorGuard)
  async reject(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() dto: RejectOfferDto
  ) {
    if (!account.companyId) throw new BadRequestException("등록된 업체가 없습니다.");
    return this.distribution.rejectOffer(id, account.companyId, dto.reason, dto.detail ?? null);
  }

  // ── 관리자(admin) ──
  @Get("reports/:reportId/offers")
  @UseGuards(AdminGuard)
  async reportOffers(@Param("reportId") reportId: string) {
    return this.distribution.getReportOffers(reportId);
  }

  @Post("reports/:reportId/offer/:companyId")
  @UseGuards(AdminGuard)
  async manualOffer(
    @Param("reportId") reportId: string,
    @Param("companyId") companyId: string
  ) {
    return this.distribution.offerToCompany(reportId, companyId);
  }

  @Post("reports/:reportId/start")
  @UseGuards(AdminGuard)
  async start(@Param("reportId") reportId: string) {
    return this.distribution.startDistribution(reportId);
  }
}
