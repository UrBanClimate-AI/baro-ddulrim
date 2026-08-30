import { Controller, Get, Query } from "@nestjs/common";
import { RegionsService } from "./regions.service";

@Controller("regions")
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get("sido")
  async sido() {
    return this.regionsService.findSido();
  }

  @Get("sigungu")
  async sigungu(@Query("sido") sidoCode: string) {
    if (!sidoCode) return [];
    return this.regionsService.findSigungu(sidoCode);
  }
}
