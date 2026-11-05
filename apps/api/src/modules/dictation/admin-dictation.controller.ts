import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import {
Body,
Delete,
Get,
Param,
Patch,
Post,
Query,
Req,
UploadedFile,
UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AsrService } from '../asr/asr.service.js';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { TtsService } from '../tts/tts.service.js';
import { DictationService } from './dictation.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import {
CreateDictationSectionDto,
CreateDictationTopicDto,
UpdateDictationSectionDto,
UpdateDictationTopicDto
} from './dto/dictation-hierarchy.dto.js';
import { PreviewSplitDto } from './dto/preview-split.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import { UpdateDictationSegmentsDto } from './dto/update-dictation-segments.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';

@AdminController('dictation')
export class AdminDictationController {
  constructor(
    private readonly dictationService: DictationService,
    private readonly ttsService: TtsService,
    private readonly asrService: AsrService,
  ) {}

  @RequirePermissions('audio.read')
  @Get('voices')
  voices() {
    return this.ttsService.voices();
  }

  @RequirePermissions('audio.read', 'asr.read')
  @Get('processors/health')
  async processorHealth() {
    const [tts, asr] = await Promise.allSettled([
      this.ttsService.health(),
      this.asrService.health(),
    ]);
    return {
      tts: tts.status === 'fulfilled' ? tts.value : { ready: false, error: String(tts.reason) },
      asr: asr.status === 'fulfilled' ? asr.value : { ready: false, error: String(asr.reason) } };
  }

  @RequirePermissions('dictation.read')
  @Get('hierarchy')
  hierarchy() {
    return this.dictationService.getAdminHierarchy();
  }

  @RequirePermissions('dictation.create')
  @Post('topics')
  createTopic(@Body() dto: CreateDictationTopicDto) {
    return this.dictationService.createTopic(dto);
  }

  @RequirePermissions('dictation.update')
  @Patch('topics/:id')
  updateTopic(@Param('id') id: string, @Body() dto: UpdateDictationTopicDto) {
    return this.dictationService.updateTopic(id, dto);
  }

  @RequirePermissions('dictation.delete')
  @Delete('topics/:id')
  removeTopic(@Param('id') id: string) {
    return this.dictationService.removeTopic(id);
  }

  @RequirePermissions('dictation.create')
  @Post('sections')
  createSection(@Body() dto: CreateDictationSectionDto) {
    return this.dictationService.createSection(dto);
  }

  @RequirePermissions('dictation.update')
  @Patch('sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: UpdateDictationSectionDto) {
    return this.dictationService.updateSection(id, dto);
  }

  @RequirePermissions('dictation.delete')
  @Delete('sections/:id')
  removeSection(@Param('id') id: string) {
    return this.dictationService.removeSection(id);
  }

  @RequirePermissions('dictation.read')
  @Post('preview-split')
  previewSplit(@Body() dto: PreviewSplitDto) {
    return this.dictationService.previewSplit(dto.sourceText);
  }

  @RequirePermissions('dictation.create')
  @Post()
  create(@Body() dto: CreateDictationDto) {
    return this.dictationService.create(dto);
  }

  @RequirePermissions('dictation.read')
  @Get()
  list(@Query() query: QueryDictationDto) {
    return this.dictationService.listAdmin(query);
  }

  @RequirePermissions('dictation.read')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.dictationService.getAdmin(id);
  }

  @RequirePermissions('dictation.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDictationDto) {
    return this.dictationService.update(id, dto);
  }

  @RequirePermissions('dictation.update')
  @Patch(':id/segments')
  updateSegments(
    @Param('id') id: string,
    @Body() dto: UpdateDictationSegmentsDto,
  ) {
    return this.dictationService.updateSegments(id, dto.segments);
  }

  @RequirePermissions('dictation.update', 'audio.generate')
  @Post(':id/generate-audio')
  generateAudio(@Param('id') id: string) {
    return this.dictationService.generateAudio(id);
  }

  @RequirePermissions('dictation.update', 'asr.create')
  @Post(':id/analyze-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 } }),
  )
  analyzeAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.dictationService.analyzeUploadedAudio(id, file);
  }

  @RequirePermissions('dictation.update', 'publication.publish')
  @Post(':id/publish')
  publish(@Param('id') id: string,@Req() req:{user:{_id:string}}) {
    return this.dictationService.publish(id,String(req.user._id));
  }

  @RequirePermissions('dictation.update', 'publication.unpublish')
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string,@Req() req:{user:{_id:string}}) {
    return this.dictationService.unpublish(id,String(req.user._id));
  }

  @RequirePermissions('dictation.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dictationService.remove(id);
  }
}
