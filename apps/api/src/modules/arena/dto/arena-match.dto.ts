import {
IsEnum,
IsInt,
IsOptional,
IsString,
IsUUID,
Max,
MaxLength,
Min,
MinLength
} from 'class-validator';
import { ArenaFriendMode } from '../rows/arena-match.row.js';

export class CreateFriendMatchDto {
  @IsOptional()
  @IsEnum(ArenaFriendMode)
  mode?: ArenaFriendMode;
  @IsUUID('4')
  opponentId: string;
}

export class CreateArenaRoomDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(8)
  maxPlayers?: number;
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
