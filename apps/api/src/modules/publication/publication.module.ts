import {
  Global,
  Get,
  Header,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { PublicationKind } from '@repo/shared-types/publication';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { PublicationService } from './publication.service.js';
export class PublicationLanguageDto {
  @IsOptional() @IsIn(['vi', 'en']) lang?: string;
}
function resourceController(kind: PublicationKind) {
  @AdminController(kind)
  class ResourcePublicationController {
    constructor(
      @Inject(PublicationService) readonly publication: PublicationService,
    ) {}
    @Get(':id/publication')
    @Header('Cache-Control', 'private, no-store')
    info(@Param('id', new ParseUUIDPipe()) id: string) {
      return this.publication.info(kind, id);
    }
    @Post(':id/validate')
    validate(
      @Param('id', new ParseUUIDPipe()) id: string,
      @Req() request: { user: { _id: string } },
      @Query() query: PublicationLanguageDto,
    ) {
      return this.publication.validate(
        kind,
        id,
        String(request.user._id),
        query.lang,
      );
    }
    @Get(':id/preview')
    @Header('Cache-Control', 'private, no-store')
    preview(@Param('id', new ParseUUIDPipe()) id: string) {
      return this.publication.preview(kind, id);
    }
    publish(
      @Param('id', new ParseUUIDPipe()) id: string,
      @Req() request: { user: { _id: string } },
      @Query() query: PublicationLanguageDto,
    ) {
      return this.publication.publish(
        kind,
        id,
        String(request.user._id),
        query.lang,
      );
    }
    unpublish(
      @Param('id', new ParseUUIDPipe()) id: string,
      @Req() request: { user: { _id: string } },
    ) {
      return this.publication.unpublish(kind, id, String(request.user._id));
    }
  }
  if (kind !== 'dictation') {
    Post(':id/publish')(
      ResourcePublicationController.prototype,
      'publish',
      Object.getOwnPropertyDescriptor(
        ResourcePublicationController.prototype,
        'publish',
      )!,
    );
    Post(':id/unpublish')(
      ResourcePublicationController.prototype,
      'unpublish',
      Object.getOwnPropertyDescriptor(
        ResourcePublicationController.prototype,
        'unpublish',
      )!,
    );
  }
  return ResourcePublicationController;
}
export const ExamPublicationController = resourceController('exams');
export const WordPublicationController = resourceController('words');
export const LessonPublicationController = resourceController('lessons');
export const DictationPublicationController = resourceController('dictation');
@Global()
@Module({
  providers: [PublicationService],
  exports: [PublicationService],
  controllers: [
    ExamPublicationController,
    WordPublicationController,
    LessonPublicationController,
    DictationPublicationController,
  ],
})
export class PublicationModule {}
