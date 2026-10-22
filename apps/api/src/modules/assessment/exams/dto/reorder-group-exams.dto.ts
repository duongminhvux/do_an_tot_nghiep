import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class ReorderGroupExamsDto {
  /** Every exam of the group, in the new display order. */
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  examIds!: string[];
}
