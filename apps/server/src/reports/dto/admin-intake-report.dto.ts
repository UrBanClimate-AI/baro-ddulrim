import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { Urgency } from "../../generated/prisma/client";

/** 관리자 직접 접수 (AI 통화·카카오톡·전화 상담 기반 1차 신고) */
export class AdminIntakeReportDto {
  @IsIn(["AI_CALL", "KAKAO", "PHONE"])
  channel!: "AI_CALL" | "KAKAO" | "PHONE";

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressDetail?: string | null;

  /** 연결할 AI 통화 기록 id */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  aiCallId?: string | null;
}
