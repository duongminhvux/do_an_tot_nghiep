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
import { DictationTopic, DictationTopicDocument } from './schemas/dictation-topic.schema.js';
import { DictationSection, DictationSectionDocument } from './schemas/dictation-section.schema.js';
import {
  CreateDictationSectionDto,
  CreateDictationTopicDto,
  UpdateDictationSectionDto,
  UpdateDictationTopicDto,
} from './dto/dictation-hierarchy.dto.js';

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
  private readonly maxAttemptsBeforeReveal: number;
  private readonly autoNextDelayMs: number;

  constructor(
    @InjectModel(DictationLesson.name)
    private readonly lessonModel: Model<DictationLessonDocument>,
    @InjectModel(DictationSegment.name)
    private readonly segmentModel: Model<DictationSegmentDocument>,
    @InjectModel(DictationProgress.name)
    private readonly progressModel: Model<DictationProgressDocument>,
    @InjectModel(DictationTopic.name)
    private readonly topicModel: Model<DictationTopicDocument>,
    @InjectModel(DictationSection.name)
    private readonly sectionModel: Model<DictationSectionDocument>,
    private readonly ttsService: TtsService,
    private readonly asrService: AsrService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {
    this.asrStartPaddingMs = this.readNonNegativeInt('DICTATION_SEGMENT_START_PADDING_MS', 100);
    this.asrEndPaddingMs = this.readNonNegativeInt('DICTATION_SEGMENT_END_PADDING_MS', 150);
    this.maxAttemptsBeforeReveal = Math.max(1, this.readNonNegativeInt('DICTATION_MAX_ATTEMPTS_BEFORE_REVEAL', 3));
    this.autoNextDelayMs = this.readNonNegativeInt('DICTATION_AUTO_NEXT_DELAY_MS', 700);
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

  private async uniqueTopicSlug(raw: string, excludeId?: string): Promise<string> {
    const base = this.slugify(raw) || 'topic';
    let slug = base;
    let counter = 1;
    while (
      await this.topicModel.exists({
        slug,
        isDeleted: { $ne: true },
        ...(excludeId && Types.ObjectId.isValid(excludeId)
          ? { _id: { $ne: new Types.ObjectId(excludeId) } }
          : {}),
      })
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private async uniqueSectionSlug(topicId: Types.ObjectId, raw: string, excludeId?: string) {
    const base = this.slugify(raw) || 'section';
    let slug = base;
    let counter = 1;
    while (
      await this.sectionModel.exists({
        topicId,
        slug,
        isDeleted: { $ne: true },
        ...(excludeId && Types.ObjectId.isValid(excludeId)
          ? { _id: { $ne: new Types.ObjectId(excludeId) } }
          : {}),
      })
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private async resolveHierarchy(topicId?: string, sectionId?: string) {
    if (!topicId && !sectionId) return null;
    if (!topicId || !sectionId || !Types.ObjectId.isValid(topicId) || !Types.ObjectId.isValid(sectionId)) {
      throw new BadRequestException('Choose both a valid Dictation topic and section.');
    }
    const [topic, section] = await Promise.all([
      this.topicModel.findOne({ _id: topicId, isDeleted: { $ne: true }, isActive: true }),
      this.sectionModel.findOne({ _id: sectionId, isDeleted: { $ne: true }, isActive: true }),
    ]);
    if (!topic) throw new BadRequestException('Dictation topic does not exist or is disabled.');
    if (!section || section.topicId.toString() !== topic._id.toString()) {
      throw new BadRequestException('The selected section does not belong to the selected topic.');
    }
    return { topic, section };
  }

  private async resolveOrCreateDefaultHierarchy(topicId?: string, sectionId?: string, legacyLabel?: string) {
    if (topicId || sectionId) return this.resolveHierarchy(topicId, sectionId);
    const label = (legacyLabel || 'General').trim() || 'General';
    let topic = await this.topicModel.findOne({ title: label, isDeleted: { $ne: true } });
    if (!topic) {
      topic = await this.topicModel.create({
        title: label,
        slug: await this.uniqueTopicSlug(label),
        description: '',
        order: 0,
        isActive: true,
      });
    }
    let section = await this.sectionModel.findOne({
      topicId: topic._id,
      title: 'Section 1',
      isDeleted: { $ne: true },
    });
    if (!section) {
      section = await this.sectionModel.create({
        topicId: topic._id,
        title: 'Section 1',
        slug: await this.uniqueSectionSlug(topic._id as Types.ObjectId, 'Section 1'),
        description: '',
        order: 0,
        isActive: true,
      });
    }
    return { topic, section };
  }

  /**
   * Existing projects stored a free-text `topic` directly on lessons. Migrate
   * those records lazily to Topic -> Section 1 so existing Dictation data keeps
   * working after the hierarchy upgrade.
   */
  private async ensureLegacyHierarchy() {
    const legacy = await this.lessonModel
      .find({
        isDeleted: { $ne: true },
        $or: [{ topicId: { $exists: false } }, { sectionId: { $exists: false } }],
      })
      .select('_id topic')
      .lean();
    if (!legacy.length) return;

    const labels = [...new Set(legacy.map((item) => (item.topic || 'General').trim() || 'General'))];
    for (const label of labels) {
      let topic = await this.topicModel.findOne({ title: label, isDeleted: { $ne: true } });
      if (!topic) {
        topic = await this.topicModel.create({
          title: label,
          slug: await this.uniqueTopicSlug(label),
          description: '',
          order: 0,
          isActive: true,
        });
      }
      let section = await this.sectionModel.findOne({
        topicId: topic._id,
        title: 'Section 1',
        isDeleted: { $ne: true },
      });
      if (!section) {
        section = await this.sectionModel.create({
          topicId: topic._id,
          title: 'Section 1',
          slug: await this.uniqueSectionSlug(topic._id as Types.ObjectId, 'Section 1'),
          description: '',
          order: 0,
          isActive: true,
        });
      }
      await this.lessonModel.updateMany(
        {
          isDeleted: { $ne: true },
          topic: label,
          $or: [{ topicId: { $exists: false } }, { sectionId: { $exists: false } }],
        },
        { $set: { topicId: topic._id, sectionId: section._id, topic: topic.title } },
      );
    }
  }

  async getAdminHierarchy() {
    await this.ensureLegacyHierarchy();
    const [topics, sections, lessonCounts] = await Promise.all([
      this.topicModel.find({ isDeleted: { $ne: true } }).sort({ order: 1, title: 1 }).lean(),
      this.sectionModel.find({ isDeleted: { $ne: true } }).sort({ order: 1, title: 1 }).lean(),
      this.lessonModel.aggregate([
        { $match: { isDeleted: { $ne: true }, sectionId: { $exists: true } } },
        { $group: { _id: '$sectionId', count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(lessonCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    return topics.map((topic) => ({
      ...topic,
      sections: sections
        .filter((section) => String(section.topicId) === String(topic._id))
        .map((section) => ({ ...section, lessonCount: countMap.get(String(section._id)) || 0 })),
    }));
  }

  async createTopic(dto: CreateDictationTopicDto) {
    const title = dto.title.trim();
    return this.topicModel.create({
      ...dto,
      title,
      slug: await this.uniqueTopicSlug(dto.slug || title),
      description: dto.description?.trim() || '',
      thumbnailUrl: dto.thumbnailUrl?.trim() || '',
      thumbnailPublicId: dto.thumbnailPublicId?.trim() || '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async updateTopic(id: string, dto: UpdateDictationTopicDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Dictation topic not found.');
    const topic = await this.topicModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const oldThumbnailPublicId = topic.thumbnailPublicId;
    if (dto.title !== undefined) topic.title = dto.title.trim();
    if (dto.description !== undefined) topic.description = dto.description.trim();
    if (dto.thumbnailUrl !== undefined) topic.thumbnailUrl = dto.thumbnailUrl.trim();
    if (dto.thumbnailPublicId !== undefined) topic.thumbnailPublicId = dto.thumbnailPublicId.trim();
    if (dto.order !== undefined) topic.order = dto.order;
    if (dto.isActive !== undefined) topic.isActive = dto.isActive;
    if (dto.slug !== undefined || dto.title !== undefined) {
      topic.slug = await this.uniqueTopicSlug(dto.slug || dto.title || topic.title, id);
    }
    await topic.save();
    await this.lessonModel.updateMany(
      { topicId: topic._id, isDeleted: { $ne: true } },
      { $set: { topic: topic.title } },
    );
    if (
      oldThumbnailPublicId &&
      dto.thumbnailPublicId !== undefined &&
      oldThumbnailPublicId !== topic.thumbnailPublicId
    ) {
      await this.cloudinaryService.deleteFile(oldThumbnailPublicId, 'image');
    }
    return topic.toObject();
  }

  async removeTopic(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Dictation topic not found.');
    const topic = await this.topicModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const lessonCount = await this.lessonModel.countDocuments({ topicId: topic._id, isDeleted: { $ne: true } });
    if (lessonCount) throw new ConflictException('Move or delete lessons in this topic before deleting it.');
    topic.isDeleted = true;
    topic.isActive = false;
    await topic.save();
    await this.sectionModel.updateMany({ topicId: topic._id }, { $set: { isDeleted: true, isActive: false } });
    if (topic.thumbnailPublicId) await this.cloudinaryService.deleteFile(topic.thumbnailPublicId, 'image');
    return topic;
  }

  async createSection(dto: CreateDictationSectionDto) {
    if (!Types.ObjectId.isValid(dto.topicId)) throw new BadRequestException('Invalid Dictation topic.');
    const topic = await this.topicModel.findOne({ _id: dto.topicId, isDeleted: { $ne: true } });
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const title = dto.title.trim();
    const topicId = topic._id as Types.ObjectId;
    return this.sectionModel.create({
      ...dto,
      topicId,
      title,
      slug: await this.uniqueSectionSlug(topicId, dto.slug || title),
      description: dto.description?.trim() || '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async updateSection(id: string, dto: UpdateDictationSectionDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Dictation section not found.');
    const section = await this.sectionModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!section) throw new NotFoundException('Dictation section not found.');
    let topicId = section.topicId as Types.ObjectId;
    if (dto.topicId !== undefined) {
      const topic = await this.topicModel.findOne({ _id: dto.topicId, isDeleted: { $ne: true } });
      if (!topic) throw new NotFoundException('Dictation topic not found.');
      topicId = topic._id as Types.ObjectId;
      section.topicId = topicId;
    }
    if (dto.title !== undefined) section.title = dto.title.trim();
    if (dto.description !== undefined) section.description = dto.description.trim();
    if (dto.order !== undefined) section.order = dto.order;
    if (dto.isActive !== undefined) section.isActive = dto.isActive;
    if (dto.slug !== undefined || dto.title !== undefined || dto.topicId !== undefined) {
      section.slug = await this.uniqueSectionSlug(topicId, dto.slug || dto.title || section.title, id);
    }
    await section.save();
    if (dto.topicId !== undefined) {
      const topic = await this.topicModel.findById(topicId);
      await this.lessonModel.updateMany(
        { sectionId: section._id, isDeleted: { $ne: true } },
        { $set: { topicId, topic: topic?.title || 'General' } },
      );
    }
    return section.toObject();
  }

  async removeSection(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Dictation section not found.');
    const section = await this.sectionModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!section) throw new NotFoundException('Dictation section not found.');
    const lessonCount = await this.lessonModel.countDocuments({ sectionId: section._id, isDeleted: { $ne: true } });
    if (lessonCount) throw new ConflictException('Move or delete lessons in this section before deleting it.');
    section.isDeleted = true;
    section.isActive = false;
    return section.save();
  }

  async listPublishedTopics(userId: string) {
    await this.ensureLegacyHierarchy();
    const topics = await this.topicModel
      .find({ isDeleted: { $ne: true }, isActive: true })
      .select('-thumbnailPublicId')
      .sort({ order: 1, title: 1 })
      .lean();
    if (!topics.length) return [];
    const topicIds = topics.map((topic) => topic._id);
    const [sections, lessons] = await Promise.all([
      this.sectionModel.find({ topicId: { $in: topicIds }, isDeleted: { $ne: true }, isActive: true }).lean(),
      this.lessonModel.find({ topicId: { $in: topicIds }, status: DictationStatus.PUBLISHED, isDeleted: { $ne: true } })
        .select('_id topicId sectionId level sentenceCount totalDurationMs')
        .lean(),
    ]);
    const progresses = lessons.length
      ? await this.progressModel.find({ userId: new Types.ObjectId(userId), lessonId: { $in: lessons.map((l) => l._id) } }).lean()
      : [];
    const progressMap = new Map(progresses.map((progress) => [String(progress.lessonId), progress]));
    const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return topics
      .map((topic) => {
        const topicLessons = lessons.filter((lesson) => String(lesson.topicId) === String(topic._id));
        const levels = [...new Set(topicLessons.map((lesson) => lesson.level))].sort(
          (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b),
        );
        const completedLessons = topicLessons.filter((lesson) => progressMap.get(String(lesson._id))?.completed).length;
        return {
          ...topic,
          sectionCount: sections.filter((section) => String(section.topicId) === String(topic._id)).length,
          lessonCount: topicLessons.length,
          sentenceCount: topicLessons.reduce((sum, lesson) => sum + Number(lesson.sentenceCount || 0), 0),
          totalDurationMs: topicLessons.reduce((sum, lesson) => sum + Number(lesson.totalDurationMs || 0), 0),
          levels,
          completedLessons,
        };
      })
      .filter((topic) => topic.lessonCount > 0);
  }

  async getPublishedTopicBySlug(slug: string, userId: string) {
    await this.ensureLegacyHierarchy();
    const topic = await this.topicModel
      .findOne({ slug, isDeleted: { $ne: true }, isActive: true })
      .select('-thumbnailPublicId')
      .lean();
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const sections = await this.sectionModel
      .find({ topicId: topic._id, isDeleted: { $ne: true }, isActive: true })
      .sort({ order: 1, title: 1 })
      .lean();
    const lessons = await this.lessonModel
      .find({
        topicId: topic._id,
        sectionId: { $in: sections.map((section) => section._id) },
        status: DictationStatus.PUBLISHED,
        isDeleted: { $ne: true },
      })
      .select('-sourceText -processingError -fullAudioPublicId')
      .sort({ order: 1, title: 1 })
      .lean();
    const progresses = lessons.length
      ? await this.progressModel.find({ userId: new Types.ObjectId(userId), lessonId: { $in: lessons.map((l) => l._id) } }).lean()
      : [];
    const progressMap = new Map(progresses.map((progress) => [String(progress.lessonId), progress]));
    const hydratedSections = sections
      .map((section) => ({
        ...section,
        lessons: lessons
          .filter((lesson) => String(lesson.sectionId) === String(section._id))
          .map((lesson) => ({ ...lesson, progress: progressMap.get(String(lesson._id)) || null })),
      }))
      .filter((section) => section.lessons.length > 0);
    const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const levels = [...new Set(lessons.map((lesson) => String(lesson.level)))].sort(
      (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b),
    );
    return {
      ...topic,
      sectionCount: hydratedSections.length,
      lessonCount: lessons.length,
      sentenceCount: lessons.reduce((sum, lesson) => sum + Number(lesson.sentenceCount || 0), 0),
      totalDurationMs: lessons.reduce((sum, lesson) => sum + Number(lesson.totalDurationMs || 0), 0),
      levels,
      completedLessons: lessons.filter((lesson) => progressMap.get(String(lesson._id))?.completed).length,
      sections: hydratedSections,
    };
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

    const hierarchy = await this.resolveOrCreateDefaultHierarchy(dto.topicId, dto.sectionId, dto.topic);
    if (!hierarchy) throw new BadRequestException('Choose a Dictation topic and section.');
    const slug = await this.uniqueSlug(dto.slug || dto.title);
    const lesson = new this.lessonModel({
      ...dto,
      topicId: hierarchy.topic._id,
      sectionId: hierarchy.section._id,
      audioSource,
      title: dto.title.trim(),
      slug,
      topic: hierarchy.topic.title,
      description: dto.description?.trim() || '',
      sourceText,
      voiceIds: this.ensureVoiceIds(dto.voiceIds),
      sentenceCount: sentences.length,
      status: DictationStatus.DRAFT,
      order: dto.order ?? 0,
    });

    return lesson.save();
  }

  async listAdmin(query: QueryDictationDto) {
    await this.ensureLegacyHierarchy();
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
    await this.ensureLegacyHierarchy();
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
    if (dto.description !== undefined) update.description = dto.description.trim();
    if (dto.sourceText !== undefined) update.sourceText = dto.sourceText.trim();
    if (dto.voiceIds !== undefined) update.voiceIds = this.ensureVoiceIds(dto.voiceIds);
    if (dto.slug || dto.title) update.slug = await this.uniqueSlug(dto.slug || dto.title || current.title, id);

    if (dto.topicId !== undefined || dto.sectionId !== undefined) {
      const hierarchy = await this.resolveHierarchy(
        dto.topicId || current.topicId?.toString(),
        dto.sectionId || current.sectionId?.toString(),
      );
      if (!hierarchy) throw new BadRequestException('Choose a Dictation topic and section.');
      update.topicId = hierarchy.topic._id;
      update.sectionId = hierarchy.section._id;
      update.topic = hierarchy.topic.title;
    }

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
    await this.ensureLegacyHierarchy();
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
    await this.ensureLegacyHierarchy();
    const lesson = await this.lessonModel
      .findOne({ slug, status: DictationStatus.PUBLISHED, isDeleted: { $ne: true } })
      .lean();
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    const [segments, progress, topic, section] = await Promise.all([
      this.segmentModel.find({ lessonId: lesson._id }).sort({ order: 1 }).lean(),
      this.progressModel.findOne({
        userId: new Types.ObjectId(userId),
        lessonId: lesson._id,
      }).lean(),
      lesson.topicId ? this.topicModel.findById(lesson.topicId).lean() : null,
      lesson.sectionId ? this.sectionModel.findById(lesson.sectionId).lean() : null,
    ]);

    return {
      ...lesson,
      fullAudioPublicId: undefined,
      processingError: undefined,
      topicInfo: topic ? { _id: topic._id, title: topic.title, slug: topic.slug } : null,
      sectionInfo: section ? { _id: section._id, title: section.title, slug: section.slug } : null,
      practiceSettings: {
        maxAttemptsBeforeReveal: this.maxAttemptsBeforeReveal,
        autoNextDelayMs: this.autoNextDelayMs,
      },
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
      revealedSegments: [],
      segmentProgress: [],
      correctCount: 0,
      wrongCount: 0,
      attempts: 0,
      transcriptRevealed: false,
      completed: false,
    };
  }

  private ensureProgressSegment(progress: DictationProgressDocument, segmentIndex: number) {
    const existing = progress.segmentProgress.find((item) => item.segmentIndex === segmentIndex);
    if (existing) return existing;
    progress.segmentProgress.push({
      segmentIndex,
      attempts: 0,
      wrongAttempts: 0,
      replayCount: 0,
      correct: false,
      firstTryCorrect: false,
      revealed: false,
    } as any);
    return progress.segmentProgress[progress.segmentProgress.length - 1];
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

    progress.completedSegments ||= [];
    progress.revealedSegments ||= [];
    progress.segmentProgress ||= [];
    const segmentProgress = this.ensureProgressSegment(progress, segmentIndex);
    segmentProgress.attempts += 1;
    progress.attempts += 1;

    if (isCorrect) {
      if (!segmentProgress.correct) {
        segmentProgress.correct = true;
        segmentProgress.firstTryCorrect =
          segmentProgress.attempts === 1 &&
          segmentProgress.wrongAttempts === 0 &&
          !segmentProgress.revealed;
        segmentProgress.completedAt = new Date();
        progress.correctCount += 1;
        if (!progress.completedSegments.includes(segmentIndex)) {
          progress.completedSegments.push(segmentIndex);
          progress.completedSegments.sort((a, b) => a - b);
        }
      }
      const preferredNext = segmentIndex + 1 < lesson.sentenceCount ? segmentIndex + 1 : undefined;
      const handled = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]);
      const firstUnhandled = Array.from({ length: lesson.sentenceCount }, (_, index) => index)
        .find((index) => !handled.has(index));
      progress.currentSegment = preferredNext ?? firstUnhandled ?? Math.max(lesson.sentenceCount - 1, 0);
    } else {
      segmentProgress.wrongAttempts += 1;
      progress.wrongCount += 1;
      progress.currentSegment = segmentIndex;
      if (segmentProgress.wrongAttempts >= this.maxAttemptsBeforeReveal) {
        segmentProgress.revealed = true;
        if (!progress.revealedSegments.includes(segmentIndex)) {
          progress.revealedSegments.push(segmentIndex);
          progress.revealedSegments.sort((a, b) => a - b);
        }
      }
    }

    const handledSegments = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]);
    progress.completed = handledSegments.size >= lesson.sentenceCount;
    progress.lastPracticedAt = new Date();
    return progress.save();
  }

  async revealSegment(userId: string, lessonId: string, segmentIndex: number) {
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
      progress = new this.progressModel({ userId: new Types.ObjectId(userId), lessonId: lesson._id });
    }
    progress.revealedSegments ||= [];
    progress.segmentProgress ||= [];
    const segmentProgress = this.ensureProgressSegment(progress, segmentIndex);
    segmentProgress.revealed = true;
    if (!progress.revealedSegments.includes(segmentIndex)) {
      progress.revealedSegments.push(segmentIndex);
      progress.revealedSegments.sort((a, b) => a - b);
    }
    progress.currentSegment = segmentIndex;
    const handledSegments = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]);
    progress.completed = handledSegments.size >= lesson.sentenceCount;
    progress.lastPracticedAt = new Date();
    return progress.save();
  }

  async revealTranscript(userId: string, lessonId: string) {
    if (!Types.ObjectId.isValid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.exists({
      _id: lessonId,
      status: DictationStatus.PUBLISHED,
      isDeleted: { $ne: true },
    });
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    let progress = await this.progressModel.findOne({
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
    });
    if (!progress) {
      progress = new this.progressModel({
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      });
    }
    progress.transcriptRevealed = true;
    progress.transcriptRevealedAt ||= new Date();
    progress.lastPracticedAt = new Date();
    return progress.save();
  }

  async recordReplay(userId: string, lessonId: string, segmentIndex: number) {
    if (!Types.ObjectId.isValid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.findOne({
      _id: lessonId,
      status: DictationStatus.PUBLISHED,
      isDeleted: { $ne: true },
    }).select('sentenceCount');
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (segmentIndex < 0 || segmentIndex >= lesson.sentenceCount) {
      throw new BadRequestException('Invalid dictation sentence index.');
    }
    let progress = await this.progressModel.findOne({
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
    });
    if (!progress) {
      progress = new this.progressModel({
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      });
    }
    progress.segmentProgress ||= [];
    const segmentProgress = this.ensureProgressSegment(progress, segmentIndex);
    segmentProgress.replayCount += 1;
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
