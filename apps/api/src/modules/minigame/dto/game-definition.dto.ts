import { PartialType } from '@nestjs/mapped-types';
import { Transform,Type } from 'class-transformer';
import {
ArrayMaxSize,
ArrayUnique,
IsArray,
IsBoolean,
IsEnum,
IsIn,
IsInt,
IsNotEmpty,
IsString,
IsUUID,
Matches,
Max,
MaxLength,
Min,
ValidateIf,
ValidateNested
} from 'class-validator';
import { GameCategory } from '../rows/game-definition.row.js';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
class GameMetadataDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  nameEn?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  imageUrl?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['NEW', 'POPULAR', 'FEATURED', null])
  badge?: 'NEW' | 'POPULAR' | 'FEATURED' | null;
  @IsEnum(GameCategory) category: GameCategory;
  @IsInt() @Min(0) @Max(100000) order: number;
  @IsBoolean() isActive: boolean;
}
export class UpdateGameDto extends PartialType(GameMetadataDto, {
  skipNullProperties: false }) {}
export class GameOrderItemDto {
  @IsUUID('4') id: string;
  @IsInt() @Min(0) @Max(100000) order: number;
}
export class ReorderGamesDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique((item: GameOrderItemDto) => item?.id)
  @ValidateNested({ each: true })
  @Type(() => GameOrderItemDto)
  items: GameOrderItemDto[];
}
