import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { DashboardService } from "./dashboard.service";

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("student/dashboard")
  @Roles(UserRole.STUDENT)
  student(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.student(user);
  }

  @Get("admin/dashboard")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  admin(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.admin(user);
  }
}
