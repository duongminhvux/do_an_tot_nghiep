import {
  Get,
  Header,
  Module,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { MediaLibraryService } from './media-library.service.js';

export class MediaLibraryQuery {
  @IsOptional()
  @IsIn(['lesson', 'collection', 'word', 'exam', 'game'])
  kind?: string;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 12;
}
@AdminController('media-library/dictation')
export class DictationMediaController {
  constructor(private readonly media: MediaLibraryService) {}
  @Get('items')
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: MediaLibraryQuery) {
    return this.media.list('dictation', query);
  }
  @Get('items/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MediaLibraryQuery,
  ) {
    return this.media.detail('dictation', id, query.kind);
  }
}
@AdminController('media-library/vocab')
export class VocabMediaController {
  constructor(private readonly media: MediaLibraryService) {}
  @Get('items')
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: MediaLibraryQuery) {
    return this.media.list('vocab', query);
  }
  @Get('items/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MediaLibraryQuery,
  ) {
    return this.media.detail('vocab', id, query.kind);
  }
}
@AdminController('media-library/toeic')
export class ToeicMediaController {
  constructor(private readonly media: MediaLibraryService) {}
  @Get('items')
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: MediaLibraryQuery) {
    return this.media.list('toeic', query);
  }
  @Get('items/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MediaLibraryQuery,
  ) {
    return this.media.detail('toeic', id, query.kind);
  }
}
@AdminController('media-library/games')
export class GamesMediaController {
  constructor(private readonly media: MediaLibraryService) {}
  @Get('items')
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: MediaLibraryQuery) {
    return this.media.list('games', query);
  }
  @Get('items/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MediaLibraryQuery,
  ) {
    return this.media.detail('games', id, query.kind);
  }
}
@Module({
  controllers: [DictationMediaController, VocabMediaController],
  providers: [MediaLibraryService],
})
export class ContentMediaLibraryModule {}
@Module({
  controllers: [ToeicMediaController],
  providers: [MediaLibraryService],
})
export class AssessmentMediaLibraryModule {}
@Module({
  controllers: [GamesMediaController],
  providers: [MediaLibraryService],
})
export class LearningMediaLibraryModule {}
