import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
  Max,
  Min,
} from "class-validator";
import {
  AudioSegmentType,
  AudioSource,
  DictationMode,
  Difficulty,
  ExerciseType,
  QuestionKind,
  ToeicPart,
} from "../../../generated/prisma/client";

export class CreateExerciseDto {
  @ApiProperty()
  @IsUUID()
  lessonId!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 255)
  title!: string;

  @ApiProperty()
  @IsString()
  instruction!: string;

  @ApiProperty({ enum: ExerciseType })
  @IsEnum(ExerciseType)
  type!: ExerciseType;

  @ApiPropertyOptional({ enum: DictationMode })
  @IsOptional()
  @IsEnum(DictationMode)
  dictationMode?: DictationMode;

  @ApiPropertyOptional({ enum: ToeicPart })
  @IsOptional()
  @IsEnum(ToeicPart)
  toeicPart?: ToeicPart;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceScript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}

export class UpdateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instruction?: string;

  @ApiPropertyOptional({ enum: DictationMode })
  @IsOptional()
  @IsEnum(DictationMode)
  dictationMode?: DictationMode | null;

  @ApiPropertyOptional({ enum: ToeicPart })
  @IsOptional()
  @IsEnum(ToeicPart)
  toeicPart?: ToeicPart | null;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceScript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ignoreCapitalization?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ignorePunctuation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ignoreExtraSpaces?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowMinorTypo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showTranscript?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showAnswerAfterSubmit?: boolean;

  @ApiPropertyOptional({ enum: AudioSource })
  @IsOptional()
  @IsEnum(AudioSource)
  audioSource?: AudioSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  finalAudioMediaId?: string | null;
}

export class CreateGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sharedScript?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  imageMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sharedAudioMediaId?: string;
}

export class CreateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty()
  @IsString()
  questionText!: string;

  @ApiProperty({ enum: QuestionKind })
  @IsEnum(QuestionKind)
  kind!: QuestionKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  imageMediaId?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CreateOptionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 4)
  label!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;
}

export class CreateAudioSegmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  questionId?: string;

  @ApiProperty({ enum: AudioSegmentType })
  @IsEnum(AudioSegmentType)
  segmentType!: AudioSegmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speakerKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speakerLabel?: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  pauseAfterMs?: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mediaId?: string;
}

export class AttachAudioDto {
  @ApiProperty()
  @IsUUID()
  mediaId!: string;
}

export class SaveExerciseDraftOptionDto {
  @ApiPropertyOptional({
    description: "Persistent UUID or client-local draft key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  id?: string;

  @ApiProperty()
  @IsString()
  @Length(0, 2000)
  text!: string;

  @ApiProperty()
  @IsBoolean()
  correct!: boolean;
}

export class SaveExerciseDraftQuestionDto {
  @ApiPropertyOptional({
    description: "Persistent UUID or client-local draft key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  id?: string;

  @ApiPropertyOptional({
    description: "Persistent UUID or client-local group key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  groupId?: string;

  @ApiProperty()
  @IsString()
  @Length(0, 2000)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  imageMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  explanation?: string;

  @ApiProperty({ type: () => [SaveExerciseDraftOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExerciseDraftOptionDto)
  options!: SaveExerciseDraftOptionDto[];
}

export class SaveExerciseDraftGroupDto {
  @ApiPropertyOptional({
    description: "Persistent UUID or client-local draft key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sharedScript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  imageMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sharedAudioMediaId?: string;

  @ApiProperty({ type: () => [SaveExerciseDraftQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExerciseDraftQuestionDto)
  questions!: SaveExerciseDraftQuestionDto[];
}

export class SaveExerciseDraftAudioSegmentDto {
  @ApiPropertyOptional({
    description: "Persistent UUID or client-local draft key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  id?: string;

  @ApiPropertyOptional({
    description: "Persistent UUID or client-local group key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  groupId?: string;

  @ApiPropertyOptional({
    description: "Persistent UUID or client-local question key.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  questionId?: string;

  @ApiProperty({ enum: AudioSegmentType })
  @IsEnum(AudioSegmentType)
  segmentType!: AudioSegmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 128)
  speakerKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  speakerLabel?: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 128)
  voiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 32)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  pauseAfterMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mediaId?: string;
}

export class SaveExerciseDraftDto {
  @IsEnum(ExerciseType)
  type!: ExerciseType;

  @IsString()
  @Length(2, 255)
  title!: string;

  @IsString()
  instruction!: string;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsOptional()
  @IsEnum(DictationMode)
  dictationMode?: DictationMode | null;

  @IsOptional()
  @IsEnum(ToeicPart)
  toeicPart?: ToeicPart | null;

  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @IsOptional()
  @IsString()
  sourceScript?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  passThreshold!: number;

  @IsInt()
  @Min(1)
  maxPlays!: number;

  @IsInt()
  @Min(1)
  maxAttempts!: number;

  @IsBoolean()
  ignoreCapitalization!: boolean;

  @IsBoolean()
  ignorePunctuation!: boolean;

  @IsBoolean()
  ignoreExtraSpaces!: boolean;

  @IsBoolean()
  allowMinorTypo!: boolean;

  @IsBoolean()
  showTranscript!: boolean;

  @IsBoolean()
  showAnswerAfterSubmit!: boolean;

  @IsOptional()
  @IsString()
  correctText?: string;

  @ApiPropertyOptional({ type: () => [SaveExerciseDraftQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExerciseDraftQuestionDto)
  questions?: SaveExerciseDraftQuestionDto[];

  @ApiPropertyOptional({ type: () => [SaveExerciseDraftGroupDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExerciseDraftGroupDto)
  groups?: SaveExerciseDraftGroupDto[];

  @ApiPropertyOptional({ type: () => [SaveExerciseDraftAudioSegmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExerciseDraftAudioSegmentDto)
  audioSegments?: SaveExerciseDraftAudioSegmentDto[];
}
