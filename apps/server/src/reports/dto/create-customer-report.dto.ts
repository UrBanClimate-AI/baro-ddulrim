import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { Urgency } from "../../generated/prisma/client";

export class CreateCustomerReportDto {
  @IsString()
  @MaxLength(40)
  phone!: string;

  // 고객이 직접 고른 긴급도. 입력 시 AI/규칙 추론보다 우선한다.
  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency | null;

  // 마케팅 수신 동의(선택). 신고 건 단위로 기록한다. "true"일 때만 동의.
  @IsOptional()
  @IsString()
  marketingConsent?: string | null;

  @IsString()
  @MaxLength(200)
  location!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roadAddressText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number | null;
}
