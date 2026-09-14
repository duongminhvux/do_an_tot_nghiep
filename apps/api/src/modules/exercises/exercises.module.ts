import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { PublishValidationService } from "./publish-validation.service";

@Module({
  imports: [AccessModule],
  controllers: [ExercisesController],
  providers: [ExercisesService, PublishValidationService],
  exports: [ExercisesService, PublishValidationService],
})
export class ExercisesModule {}
