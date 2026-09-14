import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class DraftAnswerDto {
  @IsOptional()
  @IsString()
  questionId?: string;

  @IsString()
  value!: string;
}

export class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftAnswerDto)
  answers!: DraftAnswerDto[];
}

export class ConsumeListenDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  playbackSpeed?: number;
}

export class SubmitDictationDto {
  @IsString()
  @IsNotEmpty()
  answer!: string;
}

export class SubmitToeicDto {
  @IsObject()
  answers!: Record<string, string>;
}
