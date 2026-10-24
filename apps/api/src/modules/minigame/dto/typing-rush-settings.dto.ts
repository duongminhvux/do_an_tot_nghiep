import { GameAudioSettingsDto } from './game-audio-settings.dto.js';
import { IsInt, Max, Min } from 'class-validator';
export class TypingRushSettingsDto extends GameAudioSettingsDto {
  @IsInt() @Min(1) @Max(30) meaningDurationSeconds: number;
  @IsInt() @Min(1) @Max(500) minWordCount: number;
  @IsInt() @Min(1) @Max(10) lives: number;
  @IsInt() @Min(1) @Max(10) maxLives: number;
  @IsInt() @Min(10) @Max(300) initialFallSpeed: number;
  @IsInt() @Min(300) @Max(10000) spawnInterval: number;
  @IsInt() @Min(1) @Max(200) heartEveryWords: number;
}
