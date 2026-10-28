import { IsInt,Max,Min } from 'class-validator';
import { GameAudioSettingsDto } from './game-audio-settings.dto.js';
export class WordShooterSettingsDto extends GameAudioSettingsDto {
  @IsInt() @Min(2) @Max(500) minWordCount: number;
  @IsInt() @Min(2) @Max(12) wordsPerRound: number;
  @IsInt() @Min(3) @Max(120) roundDurationSeconds: number;
  @IsInt() @Min(1) @Max(60) wrongShotPenaltySeconds: number;
}
