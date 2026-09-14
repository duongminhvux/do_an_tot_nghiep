import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { AttemptsController } from "./attempts.controller";
import { AttemptsService } from "./attempts.service";
import { DictationScoringService } from "./dictation-scoring.service";
import { ToeicScoringService } from "./toeic-scoring.service";

@Module({
  imports: [AccessModule],
  controllers: [AttemptsController],
  providers: [AttemptsService, DictationScoringService, ToeicScoringService],
  exports: [AttemptsService, DictationScoringService, ToeicScoringService],
})
export class AttemptsModule {}
