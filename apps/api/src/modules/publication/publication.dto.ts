import type { PublicationStatus } from '@repo/shared-types/publication';
import { IsIn,IsOptional,IsUUID } from 'class-validator';
export class PublicationFilterDto {
  @IsOptional()
  /** NOT_PUBLISHED = everything learners cannot open (hidden + incomplete). */
  @IsIn(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'NOT_PUBLISHED'])
  publicationStatus?: PublicationStatus | 'NOT_PUBLISHED';
}
export class LessonPublicationQueryDto extends PublicationFilterDto {
  @IsOptional() @IsUUID() collectionId?: string;
}
