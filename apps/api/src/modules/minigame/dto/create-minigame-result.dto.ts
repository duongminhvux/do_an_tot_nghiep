import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { MiniGameType } from '../minigame.types.js';
export class CreateMiniGameResultDto {
  @IsEnum(MiniGameType) gameType: MiniGameType;
  @IsInt() @Min(0) @Max(10_000_000) score: number;
}
