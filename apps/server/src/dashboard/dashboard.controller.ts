import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(AdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get("classification")
  async getClassification() {
    return this.dashboardService.getClassificationPerformance();
  }
}
