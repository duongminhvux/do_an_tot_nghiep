import { Type } from 'class-transformer';
import {
ArrayMaxSize,
ArrayMinSize,
IsArray,
IsEnum,
IsUUID,
ValidateNested
} from 'class-validator';
import { MiniGameSourceType,TypingRushDifficulty } from '../minigame.types.js';
export class MiniGameSourceDto {
  @IsEnum(MiniGameSourceType) type: MiniGameSourceType;
  @IsUUID('4') id: string;
}
export class StartTypingRushDto {
  @IsEnum(TypingRushDifficulty) difficulty: TypingRushDifficulty;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MiniGameSourceDto)
  sources: MiniGameSourceDto[];
}
