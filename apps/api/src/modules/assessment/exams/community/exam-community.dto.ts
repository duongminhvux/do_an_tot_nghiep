import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export const COMMENT_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤔', '😢'];
export class CommunityPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}
export class CreateExamCommentDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
  @IsOptional() @IsUUID() replyToId?: string;
}
export class CommentReactionDto {
  @IsIn(COMMENT_EMOJIS) emoji!: string;
}
