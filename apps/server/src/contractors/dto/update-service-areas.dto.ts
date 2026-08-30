import { IsArray, IsString } from "class-validator";

export class UpdateServiceAreasDto {
  @IsArray()
  @IsString({ each: true })
  codes!: string[];
}
