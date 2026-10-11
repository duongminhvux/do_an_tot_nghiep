import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFriendMatchDto {
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
