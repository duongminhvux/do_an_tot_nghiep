import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { DictationService } from './dictation.service.js';
import { TtsService } from '../tts/tts.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import { PreviewSplitDto } from './dto/preview-split.dto.js';

@AdminController('dictation')
export class AdminDictationController {
  constructor(
    private readonly dictationService: DictationService,
    private readonly ttsService: TtsService,
  ) {}

  @Get('voices')
  voices() {
    return this.ttsService.voices();
  }

  @Post('preview-split')
  previewSplit(@Body() dto: PreviewSplitDto) {
    return this.dictationService.previewSplit(dto.sourceText);
  }

  @Post()
  create(@Body() dto: CreateDictationDto) {
    return this.dictationService.create(dto);
  }

  @Get()
  list(@Query() query: QueryDictationDto) {
    return this.dictationService.listAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.dictationService.getAdmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDictationDto) {
    return this.dictationService.update(id, dto);
  }

  @Post(':id/generate-audio')
  generateAudio(@Param('id') id: string) {
    return this.dictationService.generateAudio(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.dictationService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.dictationService.unpublish(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dictationService.remove(id);
  }
}
