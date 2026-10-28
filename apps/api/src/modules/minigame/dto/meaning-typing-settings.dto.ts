import { IsInt,IsOptional,Max,Min } from 'class-validator';
import { GameAudioSettingsDto } from './game-audio-settings.dto.js';

export class MeaningTypingSettingsDto extends GameAudioSettingsDto {
  @IsInt() @Min(1) @Max(500) minWordCount: number;
  @IsInt() @Min(1) @Max(10) lives: number;
  @IsInt() @Min(1) @Max(10) maxLives: number;
  @IsInt() @Min(10) @Max(300) initialFallSpeed: number;
  @IsInt() @Min(300) @Max(10000) spawnInterval: number;
  @IsInt() @Min(1) @Max(200) heartEveryWords: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) hintPercent?: number;
}
