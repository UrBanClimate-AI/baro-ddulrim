import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileFieldsInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentAccount } from "../auth/auth.decorators";
import type { AuthAccount } from "../auth/auth.types";
import { ContractorGuard } from "../auth/contractor.guard";
import { ContractorsService } from "./contractors.service";
import { RegisterContractorDto } from "./dto/register-contractor.dto";
import { SubmitBidDto } from "./dto/submit-bid.dto";
import { SubmitWorkUpdateDto } from "./dto/submit-work-update.dto";
import { UpdateContractorStatusDto } from "./dto/update-contractor-status.dto";
import { UpdateMyContactDto } from "./dto/update-my-contact.dto";
import { UpdateServiceAreasDto } from "./dto/update-service-areas.dto";

type UploadedContractorFiles = {
  businessLicense?: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>;
  companyPhoto?: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>;
};

@Controller("contractors")
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  /** 랜딩 페이지 협력 제안 접수 현황 게시판 (비인증 공개, 마스킹된 정보만 반환) */
  @Get("public-board")
  async findPublicBoard() {
    return this.contractorsService.findPublicBoard();
  }

  @Get("me")
  @UseGuards(ContractorGuard)
  async getMyContext(@CurrentAccount() account: AuthAccount) {
    return this.contractorsService.getMyContext(account);
  }

  @Patch("me")
  @UseGuards(ContractorGuard)
  async updateMyContact(
    @CurrentAccount() account: AuthAccount,
    @Body() dto: UpdateMyContactDto
  ) {
    return this.contractorsService.updateAccountPhone(
      account,
      dto.phone,
      dto.marketingConsent
    );
  }

  @Patch("me/service-areas")
  @UseGuards(ContractorGuard)
  async updateMyServiceAreas(
    @CurrentAccount() account: AuthAccount,
    @Body() dto: UpdateServiceAreasDto
  ) {
    return this.contractorsService.updateServiceAreas(account, dto.codes);
  }

  @Post("register")
  @UseGuards(ContractorGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "businessLicense", maxCount: 1 },
        { name: "companyPhoto", maxCount: 1 }
      ],
      {
        limits: {
          fileSize: 20 * 1024 * 1024
        }
      }
    )
  )
  async registerCompany(
    @CurrentAccount() account: AuthAccount,
    @Body() dto: RegisterContractorDto,
    @UploadedFiles() files: UploadedContractorFiles
  ) {
    return this.contractorsService.registerCompany(account, dto, files ?? {});
  }

  @Get("admin/companies")
  @UseGuards(AdminGuard)
  async findCompaniesForAdmin() {
    return this.contractorsService.findCompaniesForAdmin();
  }

  @Patch("admin/companies/:companyId/status")
  @UseGuards(AdminGuard)
  async updateCompanyStatus(
    @Param("companyId") companyId: string,
    @Body() dto: UpdateContractorStatusDto
  ) {
    return this.contractorsService.updateCompanyStatus(companyId, dto);
  }

  @Get("companies")
  @UseGuards(AdminGuard)
  async findCompanies() {
    return this.contractorsService.findCompanies();
  }

  @Get("companies/:companyId")
  @UseGuards(ContractorGuard)
  async findCompanyProfile(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.findCompanyProfile(companyId);
  }

  @Get(":companyId/opportunities")
  @UseGuards(ContractorGuard)
  async findOpportunities(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.findOpportunities(companyId);
  }

  @Get(":companyId/bids")
  @UseGuards(ContractorGuard)
  async findBids(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.findBids(companyId);
  }

  @Get(":companyId/assignments")
  @UseGuards(ContractorGuard)
  async findAssignments(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.findAssignments(companyId);
  }

  @Post(":companyId/bids")
  @UseGuards(ContractorGuard)
  async submitBid(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string,
    @Body() dto: SubmitBidDto
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.submitBid(companyId, dto);
  }

  @Post(":companyId/assignments/:assignmentId/work-updates")
  @UseGuards(ContractorGuard)
  @UseInterceptors(
    FilesInterceptor("photos", 5, {
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  )
  async submitWorkUpdate(
    @CurrentAccount() account: AuthAccount,
    @Param("companyId") companyId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: SubmitWorkUpdateDto,
    @UploadedFiles()
    photos: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>
  ) {
    this.assertOwnership(account, companyId);
    return this.contractorsService.submitWorkUpdate(companyId, assignmentId, dto, photos ?? []);
  }

  /** 로그인한 업체 계정이 해당 업체(companyId)의 소유자인지 확인한다. */
  private assertOwnership(account: AuthAccount, companyId: string) {
    if (account.companyId !== companyId) {
      throw new ForbiddenException("해당 업체에 접근할 수 없습니다.");
    }
  }
}
