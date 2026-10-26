import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { PublicationStatus } from '@repo/shared-types/publication';
export class PublicationFilterDto {
  @IsOptional()
  @IsIn(['DRAFT', 'IN_REVIEW', 'PUBLISHED'])
  publicationStatus?: PublicationStatus;
}
export class LessonPublicationQueryDto extends PublicationFilterDto {
  @IsOptional() @IsUUID() collectionId?: string;
}
