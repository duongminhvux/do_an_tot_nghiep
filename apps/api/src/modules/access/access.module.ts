import { Module } from "@nestjs/common";
import { AttemptAccessService } from "./attempt-access.service";
import { CourseAccessService } from "./course-access.service";
import { ExerciseAccessService } from "./exercise-access.service";

@Module({
  providers: [CourseAccessService, ExerciseAccessService, AttemptAccessService],
  exports: [CourseAccessService, ExerciseAccessService, AttemptAccessService],
})
export class AccessModule {}
