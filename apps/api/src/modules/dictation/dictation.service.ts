import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service.js';
import { TtsService } from '../tts/tts.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import {
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

@Injectable()
export class DictationService {
  constructor(
    @InjectModel(DictationLesson.name)
    private readonly lessonModel: Model<DictationLessonDocument>,
    @InjectModel(DictationSegment.name)
    private readonly segmentModel: Model<DictationSegmentDocument>,
    @InjectModel(DictationProgress.name)
    private readonly progressModel: Model<DictationProgressDocument>,
    private readonly ttsService: TtsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  splitIntoSentences(sourceText: string): string[] {
    const cleaned = sourceText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleaned) return [];

    // A newline is an explicit segment boundary. This is useful for dialogue:
    // one speaker turn may contain more than one grammatical sentence, just like
    // the reference dictation UI. If the admin pastes one normal paragraph,
    // Intl.Segmenter automatically splits it sentence by sentence.
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
    const sentences = this.splitIntoSentences(dto.sourceText);
    if (!sentences.length) {
      throw new BadRequestException('The dictation text does not contain any usable sentence.');
    }

    const slug = await this.uniqueSlug(dto.slug || dto.title);
    const lesson = new this.lessonModel({
      ...dto,
      title: dto.title.trim(),
      slug,
      topic: dto.topic?.trim() || 'General',
      description: dto.description?.trim() || '',
      sourceText: dto.sourceText.trim(),
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

    const nextVoiceIds = dto.voiceIds !== undefined ? this.ensureVoiceIds(dto.voiceIds) : current.voiceIds;
    const audioInputsChanged =
      (dto.sourceText !== undefined && dto.sourceText.trim() !== current.sourceText) ||
      (dto.voiceIds !== undefined && JSON.stringify(nextVoiceIds) !== JSON.stringify(current.voiceIds)) ||
      (dto.language !== undefined && dto.language !== current.language) ||
      (dto.speed !== undefined && dto.speed !== current.speed) ||
      (dto.pauseAfterMs !== undefined && dto.pauseAfterMs !== current.pauseAfterMs);

    if (dto.sourceText !== undefined) {
      const sentences = this.splitIntoSentences(dto.sourceText);
      if (!sentences.length) throw new BadRequestException('The dictation text is empty.');
      update.sentenceCount = sentences.length;
    }

    if (audioInputsChanged) {
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
      throw new ConflictException('Generate dictation audio after the latest content changes before publishing this lesson.');
    }
    const segmentCount = await this.segmentModel.countDocuments({ lessonId: lesson._id });
    if (segmentCount !== lesson.sentenceCount) {
      throw new ConflictException('Some sentence audio is missing. Regenerate audio before publishing.');
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

  async generateAudio(id: string) {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

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
    const uploadedAssets: Array<{ publicId: string; resourceType: string }> = [];

    lesson.status = DictationStatus.PROCESSING_AUDIO;
    lesson.processingError = '';
    lesson.sentenceCount = sentences.length;
    await lesson.save();

    try {
      const generatedSegments: Array<{
        lessonId: Types.ObjectId;
        order: number;
        text: string;
        voiceId: string;
        language: 'en-US' | 'en-GB';
        speed: number;
        audioUrl: string;
        audioPublicId: string;
        durationMs: number;
      }> = [];

      for (let order = 0; order < sentences.length; order += 1) {
        const text = sentences[order];
        const voiceId = voices[order % voices.length];
        const result = await this.ttsService.synthesize({
          text,
          voiceId,
          language: lesson.language,
          speed: lesson.speed,
        });

        const uploaded = await this.cloudinaryService.uploadBuffer(result.audio, {
          folder: `english-platform/dictation/${lesson._id.toString()}/segments`,
          resourceType: 'video',
          format: 'wav',
          publicId: `sentence-${String(order + 1).padStart(3, '0')}-${Date.now()}`,
        });
        uploadedAssets.push({ publicId: uploaded.public_id, resourceType: 'video' });

        generatedSegments.push({
          lessonId: lesson._id as Types.ObjectId,
          order,
          text,
          voiceId,
          language: lesson.language,
          speed: lesson.speed,
          audioUrl: uploaded.url,
          audioPublicId: uploaded.public_id,
          durationMs: Number(result.durationMs || 0),
        });
      }

      const fullResult = await this.ttsService.synthesizeSequence({
        segments: generatedSegments.map((segment, index) => ({
          text: segment.text,
          voiceId: segment.voiceId,
          language: segment.language,
          speed: segment.speed,
          pauseAfterMs: index === generatedSegments.length - 1 ? 0 : lesson.pauseAfterMs,
        })),
        defaultVoiceId: voices[0],
        defaultLanguage: lesson.language,
        defaultSpeed: lesson.speed,
      });

      const fullUpload = await this.cloudinaryService.uploadBuffer(fullResult.audio, {
        folder: `english-platform/dictation/${lesson._id.toString()}`,
        resourceType: 'video',
        format: 'wav',
        publicId: `full-${Date.now()}`,
      });
      uploadedAssets.push({ publicId: fullUpload.public_id, resourceType: 'video' });

      const oldSegments = await this.segmentModel.find({ lessonId: lesson._id }).lean();
      const oldFullPublicId = lesson.fullAudioPublicId;

      await this.segmentModel.deleteMany({ lessonId: lesson._id });
      await this.segmentModel.insertMany(generatedSegments);

      lesson.fullAudioUrl = fullUpload.url;
      lesson.fullAudioPublicId = fullUpload.public_id;
      lesson.totalDurationMs = Number(fullResult.durationMs || 0);
      lesson.sentenceCount = generatedSegments.length;
      lesson.status = DictationStatus.READY;
      lesson.processingError = '';
      await lesson.save();

      // Old media is deleted only after the new set is fully stored.
      await Promise.allSettled([
        ...oldSegments
          .filter((segment) => Boolean(segment.audioPublicId))
          .map((segment) => this.cloudinaryService.deleteFile(segment.audioPublicId, 'video')),
        ...(oldFullPublicId
          ? [this.cloudinaryService.deleteFile(oldFullPublicId, 'video')]
          : []),
      ]);

      return this.getAdmin(id);
    } catch (error) {
      await Promise.allSettled(
        uploadedAssets.map((asset) =>
          this.cloudinaryService.deleteFile(asset.publicId, asset.resourceType),
        ),
      );
      lesson.status = DictationStatus.AUDIO_FAILED;
      lesson.processingError = error instanceof Error ? error.message : String(error);
      await lesson.save();
      throw error;
    }
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
      segments: segments.map(({ audioPublicId: _audioPublicId, ...segment }) => segment),
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
