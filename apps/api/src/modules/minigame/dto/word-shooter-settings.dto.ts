import { IsInt, Min, Max } from 'class-validator';
export class WordShooterSettingsDto {
  @IsInt() @Min(2) @Max(500) minWordCount: number;
  @IsInt() @Min(2) @Max(12) wordsPerRound: number;
  @IsInt() @Min(3) @Max(120) roundDurationSeconds: number;
  @IsInt() @Min(1) @Max(60) wrongShotPenaltySeconds: number;
}
