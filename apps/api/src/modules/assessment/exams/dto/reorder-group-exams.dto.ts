import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderGroupExamsDto {
  /** Every exam of the group, in the new display order. */
  @IsArray()
  @ArrayUnique()
  @IsUUID('4',{ each: true })
  examIds!: string[];
}
