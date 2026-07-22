import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class RegisterContractorDto {
  // 식별 이메일은 로그인 토큰에서 가져오므로 더 이상 필수가 아니다.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string | null;

  // 담당자 이름은 대표자명으로 대체되었다. (하위 호환용 optional)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string | null;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsString()
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MaxLength(60)
  representativeName!: string;

  @IsString()
  @MaxLength(40)
  businessNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressDetail?: string | null;

  @IsOptional()
  @IsString()
  serviceRegions?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceRadiusKm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearsOfExperience?: number | null;

  @IsOptional()
  specialties?: string[] | string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number | null;
}
