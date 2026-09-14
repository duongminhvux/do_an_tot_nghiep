import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { AttemptsModule } from "../attempts/attempts.module";
import { CoursesModule } from "../courses/courses.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AccessModule, AttemptsModule, CoursesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
