import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import {
  ArenaFriendMode,
  ArenaMatchFinishReason,
  ArenaMatchStatus,
  ArenaMatchType,
  ArenaQuestionMode,
} from '../schemas/arena-match.schema.js';
export class ArenaAdminQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(ArenaMatchType) type?: ArenaMatchType;
  @IsOptional() @IsEnum(ArenaMatchStatus) status?: ArenaMatchStatus;
  @IsOptional()
  @IsIn([
    ...Object.values(ArenaFriendMode),
    ...Object.values(ArenaQuestionMode),
  ])
  mode?: string;
  @IsOptional() @IsMongoId() matchId?: string;
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsMongoId() winnerId?: string;
  @IsOptional()
  @IsEnum(ArenaMatchFinishReason)
  finishReason?: ArenaMatchFinishReason;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
export class ArenaPlayerQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minMatches?: number;
  @IsOptional() @IsDateString() activeSince?: string;
  @IsOptional()
  @IsIn(['rating', 'rankedMatches', 'winRate', 'lastActivity'])
  sort = 'rating';
}
export class ArenaRoomQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(50) search?: string;
  @IsOptional() @IsIn(['FRIEND', 'ROOM']) type?: 'FRIEND' | 'ROOM';
  @IsOptional() @IsIn(['WAITING', 'IN_MATCH', 'CLOSED']) status?: string;
  @IsOptional() @IsEnum(ArenaFriendMode) mode?: ArenaFriendMode;
  @IsOptional() @IsMongoId() hostId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['true', 'false']) stale?: string;
}
export class ArenaDashboardQuery {
  @IsOptional() @Type(() => Number) @IsIn([7, 30]) days = 7;
}
export class RankedSettingsDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(0) @Max(10000) defaultRating: number;
  @IsInt() @Min(1) @Max(128) kFactor: number;
  @IsInt() @Min(0) @Max(2000) ratingRange: number;
  @IsInt() @Min(1) @Max(50) questionCount: number;
  @IsInt() @Min(5) @Max(120) timePerQuestion: number;
  @IsInt() @Min(5) @Max(120) readyTimeout: number;
  @IsInt() @Min(5) @Max(120) reconnectGrace: number;
}
export class FriendlySettingsDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(5) @Max(120) inviteTimeout: number;
  @IsInt() @Min(5) @Max(120) reconnectGrace: number;
}
export class GroupSettingsDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(3) @Max(8) maxPlayers: number;
  @IsInt() @Min(60) @Max(86400) roomIdleTimeout: number;
  @IsInt() @Min(5) @Max(120) reconnectGrace: number;
}
export class ArenaConfigDto {
  @IsBoolean() maintenance: boolean;
  @IsDefined()
  @ValidateNested()
  @Type(() => RankedSettingsDto)
  ranked: RankedSettingsDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => FriendlySettingsDto)
  friendly: FriendlySettingsDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => GroupSettingsDto)
  group: GroupSettingsDto;
}
export class AdminReasonDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
export class UpdateArenaSettingsDto extends AdminReasonDto {
  @IsInt() @Min(0) revision: number;
  @IsDefined()
  @ValidateNested()
  @Type(() => ArenaConfigDto)
  config: ArenaConfigDto;
}
