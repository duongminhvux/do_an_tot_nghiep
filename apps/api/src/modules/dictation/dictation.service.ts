import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AsrService } from '../asr/asr.service.js';
import { CloudinaryService } from '../upload/cloudinary.service.js';
import { TtsService } from '../tts/tts.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import {
  DictationAudioSource,
  DictationLesson,
  DictationLessonDocument,
  DictationStatus,
} from './schemas/dictation-lesson.schema.js';
import {
  DictationSegment,
  DictationSegmentDocument,
} from './schemas/dictation-segment.schema.js';
import {
  DictationProgress,
  DictationProgressDocument,
} from './schemas/dictation-progress.schema.js';

interface EditableSegmentInput {
  order: number;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
}

@Injectable()
export class DictationService {
  private readonly asrStartPaddingMs: number;
  private readonly asrEndPaddingMs: number;

  constructor(
    @InjectModel(DictationLesson.name)
    private readonly lessonModel: Model<DictationLessonDocument>,
    @InjectModel(DictationSegment.name)
    private readonly segmentModel: Model<DictationSegmentDocument>,
    @InjectModel(DictationProgress.name)
    private readonly progressModel: Model<DictationProgressDocument>,
    private readonly ttsService: TtsService,
    private readonly asrService: AsrService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {
    this.asrStartPaddingMs = this.readNonNegativeInt('DICTATION_SEGMENT_START_PADDING_MS', 100);
    this.asrEndPaddingMs = this.readNonNegativeInt('DICTATION_SEGMENT_END_PADDING_MS', 150);
  }

  private readNonNegativeInt(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key) ?? fallback);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
  }

  splitIntoSentences(sourceText: string): string[] {
    const cleaned = sourceText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleaned) return [];

    const explicitLines = cleaned
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (explicitLines.length > 1) return explicitLines;

    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(cleaned), ({ segment }) =>
      segment.replace(/\s+/g, ' ').trim(),
    ).filter(Boolean);
  }

  previewSplit(sourceText: string) {
    const sentences = this.splitIntoSentences(sourceText);
    return {
      count: sentences.length,
      sentences: sentences.map((text, order) => ({ order, text })),
    };
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async uniqueSlug(raw: string, excludeId?: string): Promise<string> {
    const base = this.slugify(raw) || 'dictation';
    let slug = base;
    let counter = 1;

    while (
      await this.lessonModel.exists({
        slug,
        isDeleted: { $ne: true },
        ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      })
    ) {
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  private ensureVoiceIds(voiceIds?: string[]): string[] {
    const normalized = (voiceIds || [])
      .map((voice) => voice.trim())
      .filter(Boolean);
    return normalized.length ? normalized : ['af_heart'];
  }

  async create(dto: CreateDictationDto) {
    const audioSource = dto.audioSource ?? DictationAudioSource.TTS;
    const sourceText = (dto.sourceText || '').trim();
    const sentences = this.splitIntoSentences(sourceText);

    if (audioSource === DictationAudioSource.TTS && !sentences.length) {
      throw new BadRequestException('TTS dictation requires source text.');
    }

    const slug = await this.uniqueSlug(dto.slug || dto.title);
    const lesson = new this.lessonModel({
      ...dto,
      audioSource,
      title: dto.title.trim(),
      slug,
      topic: dto.topic?.trim() || 'General',
      description: dto.description?.trim() || '',
      sourceText,
      voiceIds: this.ensureVoiceIds(dto.voiceIds),
      sentenceCount: sentences.length,
      status: DictationStatus.DRAFT,
    });

    return lesson.save();
  }

  async listAdmin(query: QueryDictationDto) {
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { topic: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.level) filter.level = query.level;
    if (query.topic) filter.topic = query.topic;
    if (query.status) filter.status = query.status;

    return this.lessonModel.find(filter).sort({ createdAt: -1 }).lean().exec();
  }

  async getAdmin(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    const segments = await this.segmentModel.find({ lessonId: lesson._id }).sort({ order: 1 }).lean();
    return { ...lesson, segments };
  }

  async update(id: string, dto: UpdateDictationDto) {
    const current = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!current) throw new NotFoundException('Dictation lesson not found.');

    const update: Record<string, unknown> = { ...dto };
    if (dto.title) update.title = dto.title.trim();
    if (dto.topic !== undefined) update.topic = dto.topic.trim() || 'General';
    if (dto.description !== undefined) update.description = dto.description.trim();
    if (dto.sourceText !== undefined) update.sourceText = dto.sourceText.trim();
    if (dto.voiceIds !== undefined) update.voiceIds = this.ensureVoiceIds(dto.voiceIds);
    if (dto.slug || dto.title) update.slug = await this.uniqueSlug(dto.slug || dto.title || current.title, id);

    const nextAudioSource = dto.audioSource ?? current.audioSource ?? DictationAudioSource.TTS;
    const nextVoiceIds = dto.voiceIds !== undefined ? this.ensureVoiceIds(dto.voiceIds) : current.voiceIds;
    const ttsInputsChanged =
      nextAudioSource === DictationAudioSource.TTS &&
      ((dto.sourceText !== undefined && dto.sourceText.trim() !== current.sourceText) ||
        (dto.voiceIds !== undefined && JSON.stringify(nextVoiceIds) !== JSON.stringify(current.voiceIds)) ||
        (dto.language !== undefined && dto.language !== current.language) ||
        (dto.speed !== undefined && dto.speed !== current.speed) ||
        (dto.pauseAfterMs !== undefined && dto.pauseAfterMs !== current.pauseAfterMs));
    const sourceChanged = dto.audioSource !== undefined && dto.audioSource !== current.audioSource;

    if (dto.sourceText !== undefined && nextAudioSource === DictationAudioSource.TTS) {
      const sentences = this.splitIntoSentences(dto.sourceText);
      if (!sentences.length) throw new BadRequestException('The dictation text is empty.');
      update.sentenceCount = sentences.length;
    }

    if (ttsInputsChanged || sourceChanged) {
      update.status = DictationStatus.DRAFT;
      update.processingError = '';
    }

    return this.lessonModel.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  async publish(id: string) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (lesson.status === DictationStatus.PUBLISHED) return lesson;
    if (lesson.status !== DictationStatus.READY || !lesson.fullAudioUrl || lesson.sentenceCount <= 0) {
      throw new ConflictException('Process dictation audio after the latest content changes before publishing this lesson.');
    }
    const segmentCount = await this.segmentModel.countDocuments({ lessonId: lesson._id });
    if (segmentCount !== lesson.sentenceCount) {
      throw new ConflictException('Segment metadata is incomplete. Reprocess audio before publishing.');
    }

    lesson.status = DictationStatus.PUBLISHED;
    lesson.publishedAt = new Date();
    lesson.processingError = '';
    return lesson.save();
  }

  async unpublish(id: string) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    lesson.status = lesson.fullAudioUrl ? DictationStatus.READY : DictationStatus.DRAFT;
    return lesson.save();
  }

  /**
   * TTS flow: Kokoro synthesizes each sentence independently in memory, appends
   * them into one final WAV, and returns exact start/end offsets for each segment.
   * Only the final lesson WAV is uploaded; sentence WAVs are never persisted.
   */
  async generateAudio(id: string) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if ((lesson.audioSource ?? DictationAudioSource.TTS) !== DictationAudioSource.TTS) {
      throw new BadRequestException('This lesson uses uploaded audio. Analyze a new upload instead of generating TTS.');
    }

    const sentences = this.splitIntoSentences(lesson.sourceText);
    if (!sentences.length) throw new BadRequestException('The dictation text is empty.');
    if (sentences.length > 200) {
      throw new BadRequestException('A dictation lesson can contain at most 200 sentences.');
    }
    const tooLongIndex = sentences.findIndex((sentence) => sentence.length > 20_000);
    if (tooLongIndex >= 0) {
      throw new BadRequestException(`Segment ${tooLongIndex + 1} is longer than the 20,000 character TTS limit.`);
    }

    const voices = this.ensureVoiceIds(lesson.voiceIds);
    lesson.status = DictationStatus.PROCESSING_AUDIO;
    lesson.processingError = '';
    lesson.sentenceCount = sentences.length;
    await lesson.save();

    let newPublicId = '';
    try {
      const sequence = sentences.map((text, order) => ({
        text,
        voiceId: voices[order % voices.length],
        language: lesson.language,
        speed: lesson.speed,
        pauseAfterMs: order === sentences.length - 1 ? 0 : lesson.pauseAfterMs,
      }));

      const fullResult = await this.ttsService.synthesizeSequence({
        segments: sequence,
        defaultVoiceId: voices[0],
        defaultLanguage: lesson.language,
        defaultSpeed: lesson.speed,
      });

      const timings = fullResult.segmentTimingsMs || [];
      if (timings.length !== sentences.length) {
        throw new Error(
          `Kokoro returned ${timings.length} segment timings for ${sentences.length} segments.`,
        );
      }

      const fullUpload = await this.cloudinaryService.uploadBuffer(fullResult.audio, {
        folder: `english-platform/dictation/${lesson._id.toString()}`,
        resourceType: 'video',
        format: 'wav',
        publicId: `full-${Date.now()}`,
      });
      newPublicId = fullUpload.public_id;

      const generatedSegments = sentences.map((text, order) => ({
        lessonId: lesson._id as Types.ObjectId,
        order,
        text,
        normalizedText: this.normalizeText(text),
        source: 'TTS' as const,
        speaker: '',
        voiceId: sequence[order].voiceId,
        language: lesson.language,
        speed: lesson.speed,
        startMs: timings[order].startMs,
        endMs: timings[order].endMs,
        durationMs: timings[order].durationMs,
        confidence: 1,
        words: [],
      }));

      await this.replaceProcessedAudio(lesson, generatedSegments, {
        url: fullUpload.url,
        publicId: fullUpload.public_id,
        durationMs: Number(fullResult.durationMs || 0),
        processor: fullResult.provider || 'kokoro',
        device: fullResult.device || '',
      });

      return this.getAdmin(id);
    } catch (error) {
      if (newPublicId) {
        await this.cloudinaryService.deleteFile(newPublicId, 'video');
      }
      lesson.status = DictationStatus.AUDIO_FAILED;
      lesson.processingError = error instanceof Error ? error.message : String(error);
      await lesson.save();
      throw error;
    }
  }

  /**
   * Upload flow: Faster Whisper returns transcript + word/sentence timestamps.
   * The original uploaded audio becomes the single lesson audio file and ASR
   * timings are stored in the same startMs/endMs schema used by Kokoro.
   */
  async analyzeUploadedAudio(id: string, file: Express.Multer.File) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required.');

    const supportedMime =
      !file.mimetype ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/mp4' ||
      file.mimetype === 'application/ogg';
    if (!supportedMime) {
      throw new BadRequestException(`Unsupported audio type: ${file.mimetype}`);
    }

    lesson.audioSource = DictationAudioSource.UPLOAD;
    lesson.status = DictationStatus.PROCESSING_AUDIO;
    lesson.processingError = '';
    await lesson.save();

    let newPublicId = '';
    try {
      const transcription = await this.asrService.transcribe(
        file.buffer,
        file.originalname || 'dictation-audio',
        file.mimetype || 'application/octet-stream',
        'en',
      );
      if (!transcription.segments?.length) {
        throw new BadRequestException('Faster Whisper could not detect any speech segments.');
      }
      if (transcription.segments.length > 200) {
        throw new BadRequestException('Uploaded audio produced more than 200 dictation segments.');
      }

      const upload = await this.cloudinaryService.uploadBuffer(file.buffer, {
        folder: `english-platform/dictation/${lesson._id.toString()}`,
        resourceType: 'video',
        publicId: `uploaded-${Date.now()}`,
      });
      newPublicId = upload.public_id;

      const totalDurationMs = Math.max(
        Number(transcription.durationMs || 0),
        ...transcription.segments.map((segment) => segment.endMs),
      );
      const segments = transcription.segments.map((segment, order) => {
        const startMs = Math.max(0, segment.startMs - this.asrStartPaddingMs);
        const endMs = Math.min(
          totalDurationMs || segment.endMs + this.asrEndPaddingMs,
          segment.endMs + this.asrEndPaddingMs,
        );
        return {
          lessonId: lesson._id as Types.ObjectId,
          order,
          text: segment.text.trim(),
          normalizedText: this.normalizeText(segment.text),
          source: 'ASR' as const,
          speaker: '',
          voiceId: '',
          language: lesson.language,
          speed: 1,
          startMs,
          endMs,
          durationMs: Math.max(0, endMs - startMs),
          confidence: Number(segment.confidence || 0),
          words: segment.words || [],
        };
      });

      lesson.sourceText = segments.map((segment) => segment.text).join('\n');
      lesson.audioSource = DictationAudioSource.UPLOAD;

      await this.replaceProcessedAudio(lesson, segments, {
        url: upload.url,
        publicId: upload.public_id,
        durationMs: totalDurationMs,
        processor: `faster-whisper:${transcription.model}`,
        device: transcription.device || '',
      });

      return this.getAdmin(id);
    } catch (error) {
      if (newPublicId) {
        await this.cloudinaryService.deleteFile(newPublicId, 'video');
      }
      lesson.status = DictationStatus.AUDIO_FAILED;
      lesson.processingError = error instanceof Error ? error.message : String(error);
      await lesson.save();
      throw error;
    }
  }

  async updateSegments(id: string, inputs: EditableSegmentInput[]) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (!lesson.fullAudioUrl) throw new ConflictException('Process lesson audio before editing segment metadata.');
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 200) {
      throw new BadRequestException('Provide between 1 and 200 segments.');
    }

    const sorted = [...inputs].sort((a, b) => a.order - b.order);
    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index];
      if (!item.text?.trim()) throw new BadRequestException(`Segment ${index + 1} text is empty.`);
      if (!Number.isFinite(item.startMs) || !Number.isFinite(item.endMs) || item.startMs < 0 || item.endMs <= item.startMs) {
        throw new BadRequestException(`Segment ${index + 1} has invalid timestamps.`);
      }
      if (lesson.totalDurationMs && item.endMs > lesson.totalDurationMs + 1000) {
        throw new BadRequestException(`Segment ${index + 1} ends after the audio duration.`);
      }
    }

    const existing = await this.segmentModel.find({ lessonId: lesson._id }).sort({ order: 1 }).lean();
    const byOrder = new Map(existing.map((segment) => [segment.order, segment]));
    const replacement = sorted.map((item, order) => {
      const previous = byOrder.get(item.order);
      return {
        lessonId: lesson._id,
        order,
        text: item.text.trim(),
        normalizedText: this.normalizeText(item.text),
        source: previous?.source || (lesson.audioSource === DictationAudioSource.UPLOAD ? 'ASR' : 'TTS'),
        speaker: item.speaker?.trim() || previous?.speaker || '',
        voiceId: previous?.voiceId || '',
        language: previous?.language || lesson.language,
        speed: previous?.speed || lesson.speed,
        startMs: Math.round(item.startMs),
        endMs: Math.round(item.endMs),
        durationMs: Math.max(0, Math.round(item.endMs - item.startMs)),
        confidence: previous?.confidence || 0,
        words: previous?.words || [],
      };
    });

    await this.segmentModel.deleteMany({ lessonId: lesson._id });
    await this.segmentModel.insertMany(replacement);
    lesson.sourceText = replacement.map((segment) => segment.text).join('\n');
    lesson.sentenceCount = replacement.length;
    lesson.status = DictationStatus.READY;
    lesson.processingError = '';
    await lesson.save();
    return this.getAdmin(id);
  }

  private async replaceProcessedAudio(
    lesson: DictationLessonDocument,
    segments: Array<Record<string, unknown>>,
    audio: {
      url: string;
      publicId: string;
      durationMs: number;
      processor: string;
      device: string;
    },
  ) {
    const oldSegments = await this.segmentModel.find({ lessonId: lesson._id }).lean();
    const oldFullPublicId = lesson.fullAudioPublicId;

    await this.segmentModel.deleteMany({ lessonId: lesson._id });
    await this.segmentModel.insertMany(segments);

    lesson.fullAudioUrl = audio.url;
    lesson.fullAudioPublicId = audio.publicId;
    lesson.totalDurationMs = Math.max(0, Math.round(audio.durationMs));
    lesson.sentenceCount = segments.length;
    lesson.audioProcessor = audio.processor;
    lesson.audioProcessorDevice = audio.device;
    lesson.status = DictationStatus.READY;
    lesson.processingError = '';
    await lesson.save();

    // Delete old media only after the replacement is safely persisted. Legacy
    // sentence assets are removed here as old lessons are regenerated/analyzed.
    await Promise.allSettled([
      ...oldSegments
        .filter((segment) => Boolean(segment.audioPublicId))
        .map((segment) => this.cloudinaryService.deleteFile(segment.audioPublicId!, 'video')),
      ...(oldFullPublicId && oldFullPublicId !== audio.publicId
        ? [this.cloudinaryService.deleteFile(oldFullPublicId, 'video')]
        : []),
    ]);
  }

  async remove(id: string) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    lesson.isDeleted = true;
    lesson.status = DictationStatus.ARCHIVED;
    await lesson.save();
    return lesson;
  }

  async listPublished(userId: string, query: QueryDictationDto) {
    const filter: Record<string, unknown> = {
      isDeleted: { $ne: true },
      status: DictationStatus.PUBLISHED,
    };
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { topic: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.level) filter.level = query.level;
    if (query.topic) filter.topic = query.topic;

    const lessons = await this.lessonModel
      .find(filter)
      .select('-sourceText -processingError -fullAudioPublicId')
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    if (!lessons.length) return [];

    const progresses = await this.progressModel
      .find({ userId: new Types.ObjectId(userId), lessonId: { $in: lessons.map((l) => l._id) } })
      .lean();
    const progressMap = new Map(progresses.map((progress) => [progress.lessonId.toString(), progress]));

    return lessons.map((lesson) => ({
      ...lesson,
      progress: progressMap.get(lesson._id.toString()) || null,
    }));
  }

  async getPublishedBySlug(slug: string, userId: string) {
    const lesson = await this.lessonModel
      .findOne({ slug, status: DictationStatus.PUBLISHED, isDeleted: { $ne: true } })
      .lean();
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    const [segments, progress] = await Promise.all([
      this.segmentModel.find({ lessonId: lesson._id }).sort({ order: 1 }).lean(),
      this.progressModel.findOne({
        userId: new Types.ObjectId(userId),
        lessonId: lesson._id,
      }).lean(),
    ]);

    return {
      ...lesson,
      fullAudioPublicId: undefined,
      processingError: undefined,
      segments: segments.map(({ audioPublicId: _audioPublicId, ...segment }) => {
        const hasUnifiedTiming =
          Number.isFinite(segment.startMs) &&
          Number.isFinite(segment.endMs) &&
          segment.endMs > segment.startMs;
        if (hasUnifiedTiming) {
          const { audioUrl: _legacyAudioUrl, ...unifiedSegment } = segment;
          return unifiedSegment;
        }
        return segment;
      }),
      progress: progress || null,
    };
  }

  async getProgress(userId: string, lessonId: string) {
    if (!Types.ObjectId.isValid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.findOne({
      _id: lessonId,
      status: DictationStatus.PUBLISHED,
      isDeleted: { $ne: true },
    }).lean();
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    const progress = await this.progressModel.findOne({
      userId: new Types.ObjectId(userId),
      lessonId: lesson._id,
    }).lean();

    return progress || {
      userId,
      lessonId,
      currentSegment: 0,
      completedSegments: [],
      correctCount: 0,
      wrongCount: 0,
      attempts: 0,
      completed: false,
    };
  }

  async recordAttempt(userId: string, lessonId: string, segmentIndex: number, isCorrect: boolean) {
    if (!Types.ObjectId.isValid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.findOne({
      _id: lessonId,
      status: DictationStatus.PUBLISHED,
      isDeleted: { $ne: true },
    });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (segmentIndex < 0 || segmentIndex >= lesson.sentenceCount) {
      throw new BadRequestException('Invalid dictation sentence index.');
    }

    let progress = await this.progressModel.findOne({
      userId: new Types.ObjectId(userId),
      lessonId: lesson._id,
    });

    if (!progress) {
      progress = new this.progressModel({
        userId: new Types.ObjectId(userId),
        lessonId: lesson._id,
      });
    }

    progress.attempts += 1;
    if (isCorrect) {
      progress.correctCount += 1;
      if (!progress.completedSegments.includes(segmentIndex)) {
        progress.completedSegments.push(segmentIndex);
        progress.completedSegments.sort((a, b) => a - b);
      }
      const firstIncomplete = Array.from({ length: lesson.sentenceCount }, (_, index) => index)
        .find((index) => !progress!.completedSegments.includes(index));
      progress.currentSegment = firstIncomplete ?? Math.max(lesson.sentenceCount - 1, 0);
    } else {
      progress.wrongCount += 1;
      progress.currentSegment = segmentIndex;
    }

    progress.completed = progress.completedSegments.length >= lesson.sentenceCount;
    progress.lastPracticedAt = new Date();
    return progress.save();
  }

  async resetProgress(userId: string, lessonId: string) {
    await this.progressModel.deleteOne({
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
    });
    return { success: true };
  }

  async progressOverview(userId: string) {
    const progresses = await this.progressModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'lessonId',
        match: { status: DictationStatus.PUBLISHED, isDeleted: { $ne: true } },
        select: 'title slug level topic sentenceCount totalDurationMs',
      })
      .sort({ lastPracticedAt: -1 })
      .lean();

    const items = progresses.filter((progress) => progress.lessonId);
    return {
      totalStarted: items.length,
      completed: items.filter((item) => item.completed).length,
      totalCorrect: items.reduce((sum, item) => sum + item.correctCount, 0),
      totalAttempts: items.reduce((sum, item) => sum + item.attempts, 0),
      items,
    };
  }
}
