import type { PublicationStatus } from '@repo/shared-types/publication';
import { IsIn,IsOptional,IsUUID } from 'class-validator';
export class PublicationFilterDto {
  @IsOptional()
  @IsIn(['DRAFT', 'IN_REVIEW', 'PUBLISHED'])
  publicationStatus?: PublicationStatus;
}
export class LessonPublicationQueryDto extends PublicationFilterDto {
  @IsOptional() @IsUUID() collectionId?: string;
}
