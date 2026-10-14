import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ArenaFriendMode } from '../schemas/arena-match.schema.js';

export class CreateFriendMatchDto {
  @IsOptional()
  @IsEnum(ArenaFriendMode)
  mode?: ArenaFriendMode;
  @IsMongoId()
  opponentId: string;
}

export class CreateArenaRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}

export class JoinArenaRoomDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code: string;
}
