import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { RejectReason } from "../../generated/prisma/client";

export class RejectOfferDto {
  @IsEnum(RejectReason)
  reason!: RejectReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string | null;
}
