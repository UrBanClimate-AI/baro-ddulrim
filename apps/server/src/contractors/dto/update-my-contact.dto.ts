import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateMyContactDto {
  @IsString()
  @MaxLength(40)
  phone!: string;

  // 마케팅 수신 동의 변경(선택). 생략 시 기존 값 유지.
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
