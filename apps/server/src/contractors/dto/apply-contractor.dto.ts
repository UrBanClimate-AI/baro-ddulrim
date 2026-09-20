import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * 홈페이지(hasugulab.com/partners.html) 협력 제안 폼 접수.
 * 접수와 동시에 파트너 계정을 만든다 — 아이디는 이메일, 초기 비밀번호는 연락처 숫자.
 */
export class ApplyContractorDto {
  @IsString()
  @MaxLength(120)
  company!: string;

  @IsString()
  @MaxLength(60)
  ceo!: string;

  @IsString()
  @MaxLength(20)
  bizno!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MaxLength(40)
  sido!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sigungu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  manager?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  years?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  staff?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  radius?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orgType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orgSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  stages?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  equip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  work?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  insurance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  agree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  page?: string;
}
