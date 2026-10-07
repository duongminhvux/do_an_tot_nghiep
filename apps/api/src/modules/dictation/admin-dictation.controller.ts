import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { DictationService } from './dictation.service.js';
import { TtsService } from '../tts/tts.service.js';
import { AsrService } from '../asr/asr.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import { PreviewSplitDto } from './dto/preview-split.dto.js';
import { UpdateDictationSegmentsDto } from './dto/update-dictation-segments.dto.js';

@AdminController('dictation')
export class AdminDictationController {
  constructor(
    private readonly dictationService: DictationService,
    private readonly ttsService: TtsService,
    private readonly asrService: AsrService,
  ) {}

  @Get('voices')
  voices() {
    return this.ttsService.voices();
  }

  @Get('processors/health')
  async processorHealth() {
    const [tts, asr] = await Promise.allSettled([
      this.ttsService.health(),
      this.asrService.health(),
    ]);
    return {
      tts: tts.status === 'fulfilled' ? tts.value : { ready: false, error: String(tts.reason) },
      asr: asr.status === 'fulfilled' ? asr.value : { ready: false, error: String(asr.reason) },
    };
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

  @Patch(':id/segments')
  updateSegments(
    @Param('id') id: string,
    @Body() dto: UpdateDictationSegmentsDto,
  ) {
    return this.dictationService.updateSegments(id, dto.segments);
  }

  @Post(':id/generate-audio')
  generateAudio(@Param('id') id: string) {
    return this.dictationService.generateAudio(id);
  }

  @Post(':id/analyze-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  analyzeAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.dictationService.analyzeUploadedAudio(id, file);
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
