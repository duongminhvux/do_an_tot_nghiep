import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class AddWordsToLessonDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  wordIds!: string[];
}
