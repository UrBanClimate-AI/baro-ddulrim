import { IsOptional, IsString, MaxLength } from "class-validator";

export class SavePromptDto {
  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
