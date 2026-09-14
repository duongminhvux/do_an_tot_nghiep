import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [AccessModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
