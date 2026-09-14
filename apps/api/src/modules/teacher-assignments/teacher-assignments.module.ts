import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { TeacherAssignmentsController } from "./teacher-assignments.controller";
import { TeacherAssignmentsService } from "./teacher-assignments.service";

@Module({
  imports: [AccessModule],
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService],
})
export class TeacherAssignmentsModule {}
