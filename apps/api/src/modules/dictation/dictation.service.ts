import {
BadRequestException,
ConflictException,
Inject,
Injectable,
NotFoundException,
Optional
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dictationLessonXp } from '@repo/shared-types/learning-xp';
import { dictationOutcomes } from '@repo/shared-types/mistakes';
import { randomUUID } from 'node:crypto';
import { LearningActivityClient } from '../../common/clients/learning-activity-client.js';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { InjectPgConnection,createConnection,withPgTransaction,type PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { SqlRecords,newSqlRow } from '../../postgres/records.js';
import { rowData,rows,sql } from '../../postgres/sql.js';
import type { LearningActivityWriter } from '../learning-activity/learning-activity.service.js';
import { PublicationService } from '../publication/publication.service.js';


import { MediaStorageService } from '../../common/media/media-storage.service.js';
import { AsrService } from '../asr/asr.service.js';
import { TtsService } from '../tts/tts.service.js';
import { ManagedMediaService } from '../upload/managed-media.service.js';
import { CreateDictationDto } from './dto/create-dictation.dto.js';
import {
CreateDictationSectionDto,
CreateDictationTopicDto,
UpdateDictationSectionDto,
UpdateDictationTopicDto
} from './dto/dictation-hierarchy.dto.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import { UpdateDictationDto } from './dto/update-dictation.dto.js';
import {
DictationAudioSource,
DictationLessonRow,
DictationStatus
} from './rows/dictation-lesson.row.js';
import {
DictationProgressRow
} from './rows/dictation-progress.row.js';

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

  private get lessonModel(){return new SqlRecords(this.nativeDb,'dictationlessons');}
private get segmentModel(){return new SqlRecords(this.nativeDb,'dictationsegments');}
private get progressModel(){return new SqlRecords(this.nativeDb,'dictationprogresses');}
private get topicModel(){return new SqlRecords(this.nativeDb,'dictationtopics');}
private get sectionModel(){return new SqlRecords(this.nativeDb,'dictationsections');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly ttsService: TtsService,
private readonly asrService: AsrService,
private readonly mediaUploadService: ManagedMediaService,
private readonly mediaStorage: MediaStorageService,
private readonly configService: ConfigService,
@Optional() @Inject(LearningActivityClient) private readonly learningActivity?: LearningActivityWriter,
@Optional() @Inject(DomainOutboxService) private readonly domainOutbox?: DomainOutboxService,
@Optional() @Inject(PublicationService) private readonly publication?: PublicationService
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
      .replace(/\n{3 }/g, '\n\n')
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
      sentences: sentences.map((text, order) => ({ order, text })) };
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
      await this.topicModel.one(sql`slug=${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${excludeId ?? null}::uuid`)
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private async uniqueSectionSlug(topicId: string, raw: string, excludeId?: string) {
    const base = this.slugify(raw) || 'section';
    let slug = base;
    let counter = 1;
    while (
      await this.sectionModel.one(sql`slug=${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${excludeId ?? null}::uuid AND topic_id=${topicId}::uuid`)
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private async resolveHierarchy(topicId?: string, sectionId?: string) {
    if (!topicId && !sectionId) return null;
    if (!topicId || !sectionId || !isUuid(topicId) || !isUuid(sectionId)) {
      throw new BadRequestException('Choose both a valid Dictation topic and section.');
    }
    const [topic, section] = await Promise.all([
      this.topicModel.one(sql`("id" = ${topicId}) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("is_active" = ${true})`),
      this.sectionModel.one(sql`("id" = ${sectionId}) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("is_active" = ${true})`),
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
    let topic = await this.topicModel.one(sql`("title" = ${label}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!topic) {
      topic = await this.topicModel.insert({
        title: label,
        slug: await this.uniqueTopicSlug(label),
        description: '',
        order: 0,
        isActive: true });
    }
    if (!topic) throw new Error('Cannot create Dictation topic');
    let section = await this.sectionModel.one(sql`("topic_id" = ${topic._id}) AND ("title" = ${'Section 1'}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!section) {
      section = await this.sectionModel.insert({
        topicId: topic._id,
        title: 'Section 1',
        slug: await this.uniqueSectionSlug(topic._id as string, 'Section 1'),
        description: '',
        order: 0,
        isActive: true });
    }
    if (!section) throw new Error('Cannot create Dictation section');
    return { topic, section };
  }

  /**
   * Existing projects stored a free-text `topic` directly on lessons. Migrate
   * those records lazily to Topic -> Section 1 so existing Dictation data keeps
   * working after the hierarchy upgrade.
   */
  private async ensureLegacyHierarchy() {
    const legacy = await this.lessonModel.select(sql`is_deleted IS NOT TRUE AND (topic_id IS NULL OR section_id IS NULL)`);
    if (!legacy.length) return;

    const labels = [...new Set(legacy.map((item) => (item.topic || 'General').trim() || 'General'))];
    for (const label of labels) {
      let topic = await this.topicModel.one(sql`("title" = ${label}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
      if (!topic) {
        topic = await this.topicModel.insert({
          title: label,
          slug: await this.uniqueTopicSlug(label),
          description: '',
          order: 0,
          isActive: true });
      }
      if (!topic) throw new Error('Cannot create legacy Dictation topic');
      let section = await this.sectionModel.one(sql`("topic_id" = ${topic._id}) AND ("title" = ${'Section 1'}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
      if (!section) {
        section = await this.sectionModel.insert({
          topicId: topic._id,
          title: 'Section 1',
          slug: await this.uniqueSectionSlug(topic._id as string, 'Section 1'),
          description: '',
          order: 0,
          isActive: true });
      }
      if (!section) throw new Error('Cannot create legacy Dictation section');
      await this.lessonModel.patch(sql`("is_deleted" IS DISTINCT FROM ${true}) AND ("topic" = ${label}) AND ((("topic_id" IS NULL) OR ("section_id" IS NULL)))`,{ topicId: topic._id, sectionId: section._id, topic: topic.title });
    }
  }

  async getAdminHierarchy() {
    await this.ensureLegacyHierarchy();
    const [topics, sections, lessonCounts] = await Promise.all([
      this.topicModel.select(sql`("is_deleted" IS DISTINCT FROM ${true})`, sql`ORDER BY "order" ASC NULLS FIRST,"title" ASC NULLS FIRST`),
      this.sectionModel.select(sql`("is_deleted" IS DISTINCT FROM ${true})`, sql`ORDER BY "order" ASC NULLS FIRST,"title" ASC NULLS FIRST`),
      rows(this.nativeDb,sql`SELECT section_id AS "_id",COUNT(*)::int AS count FROM dictationlessons WHERE is_deleted IS NOT TRUE AND section_id IS NOT NULL GROUP BY section_id`),
    ]);
    const countMap = new Map(lessonCounts.map((item) => [String(item._id), Number(item.count || 0)]));
    return topics.map((topic) => ({
      ...topic,
      sections: sections
        .filter((section) => String(section.topicId) === String(topic._id))
        .map((section) => ({ ...section, lessonCount: countMap.get(String(section._id)) || 0 })) }));
  }

  async createTopic(dto: CreateDictationTopicDto) {
    const title = dto.title.trim();
    return this.topicModel.insert({
      ...dto,
      title,
      slug: await this.uniqueTopicSlug(dto.slug || title),
      description: dto.description?.trim() || '',
      thumbnailUrl: dto.thumbnailUrl?.trim() || '',
      thumbnailPublicId: dto.thumbnailPublicId?.trim() || '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true });
  }

  async updateTopic(id: string, dto: UpdateDictationTopicDto) {
    if (!isUuid(id)) throw new NotFoundException('Dictation topic not found.');
    const topic = await this.topicModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
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
    await this.topicModel.upsert(topic);
    await this.lessonModel.patch(sql`("topic_id" = ${topic._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`,{ topic: topic.title });
    if (
      oldThumbnailPublicId &&
      dto.thumbnailPublicId !== undefined &&
      oldThumbnailPublicId !== topic.thumbnailPublicId
    ) {
      await this.mediaUploadService.deleteFile(oldThumbnailPublicId, 'image');
    }
    return topic;
  }

  async removeTopic(id: string) {
    if (!isUuid(id)) throw new NotFoundException('Dictation topic not found.');
    const topic = await this.topicModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const lessonCount = await this.lessonModel.count(sql`("topic_id" = ${topic._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (lessonCount) throw new ConflictException('Move or delete lessons in this topic before deleting it.');
    topic.isDeleted = true;
    topic.isActive = false;
    await this.topicModel.upsert(topic);
    await this.sectionModel.patch(sql`("topic_id" = ${topic._id})`,{ isDeleted: true, isActive: false });
    if (topic.thumbnailPublicId) await this.mediaUploadService.deleteFile(topic.thumbnailPublicId, 'image');
    return topic;
  }

  async createSection(dto: CreateDictationSectionDto) {
    if (!isUuid(dto.topicId)) throw new BadRequestException('Invalid Dictation topic.');
    const topic = await this.topicModel.one(sql`("id" = ${dto.topicId}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const title = dto.title.trim();
    const topicId = topic._id as string;
    return this.sectionModel.insert({
      ...dto,
      topicId,
      title,
      slug: await this.uniqueSectionSlug(topicId, dto.slug || title),
      description: dto.description?.trim() || '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true });
  }

  async updateSection(id: string, dto: UpdateDictationSectionDto) {
    if (!isUuid(id)) throw new NotFoundException('Dictation section not found.');
    const section = await this.sectionModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!section) throw new NotFoundException('Dictation section not found.');
    let topicId = section.topicId as string;
    if (dto.topicId !== undefined) {
      const topic = await this.topicModel.one(sql`("id" = ${dto.topicId}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
      if (!topic) throw new NotFoundException('Dictation topic not found.');
      topicId = topic._id as string;
      section.topicId = topicId;
    }
    if (dto.title !== undefined) section.title = dto.title.trim();
    if (dto.description !== undefined) section.description = dto.description.trim();
    if (dto.order !== undefined) section.order = dto.order;
    if (dto.isActive !== undefined) section.isActive = dto.isActive;
    if (dto.slug !== undefined || dto.title !== undefined || dto.topicId !== undefined) {
      section.slug = await this.uniqueSectionSlug(topicId, dto.slug || dto.title || section.title, id);
    }
    await this.sectionModel.upsert(section);
    if (dto.topicId !== undefined) {
      const topic = await this.topicModel.one(sql`id=${topicId}::uuid`);
      await this.lessonModel.patch(sql`("section_id" = ${section._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`,{ topicId, topic: topic?.title || 'General' });
    }
    return section;
  }

  async removeSection(id: string) {
    if (!isUuid(id)) throw new NotFoundException('Dictation section not found.');
    const section = await this.sectionModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!section) throw new NotFoundException('Dictation section not found.');
    const lessonCount = await this.lessonModel.count(sql`("section_id" = ${section._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (lessonCount) throw new ConflictException('Move or delete lessons in this section before deleting it.');
    section.isDeleted = true;
    section.isActive = false;
    return this.sectionModel.upsert(section);
  }

  async listPublishedTopics(userId: string) {
    await this.ensureLegacyHierarchy();
    const topics = (await this.topicModel.select(sql`is_deleted IS NOT TRUE AND is_active IS TRUE`,sql`ORDER BY "order",title`)).map(({thumbnailPublicId,...topic})=>topic);
    if (!topics.length) return [];
    const topicIds = topics.map((topic) => topic._id);
    const [sections, lessons] = await Promise.all([
      this.sectionModel.select(sql`("topic_id"=ANY(${topicIds}::uuid[])) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("is_active" = ${true})`),
      this.lessonModel.select(sql`topic_id=ANY(${topicIds}::uuid[]) AND status='PUBLISHED' AND publication_status='PUBLISHED' AND is_deleted IS NOT TRUE`),
    ]);
    const progresses = lessons.length
      ? await this.progressModel.select(sql`("user_id" = ${String(userId)}) AND ("lesson_id"=ANY(${lessons.map((l) => l._id)}::uuid[]))`)
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
          completedLessons };
      })
      .filter((topic) => topic.lessonCount > 0);
  }

  async getPublishedTopicBySlug(slug: string, userId: string) {
    await this.ensureLegacyHierarchy();
    const topic = await this.topicModel.one(sql`slug=${slug} AND is_deleted IS NOT TRUE AND is_active IS TRUE`);
    if(topic)delete topic.thumbnailPublicId;
    if (!topic) throw new NotFoundException('Dictation topic not found.');
    const sections = await this.sectionModel.select(sql`("topic_id" = ${topic._id}) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("is_active" = ${true})`, sql`ORDER BY "order" ASC NULLS FIRST,"title" ASC NULLS FIRST`);
    const lessons = (await this.lessonModel.select(sql`topic_id=${topic._id}::uuid AND section_id=ANY(${sections.map(s=>s._id)}::uuid[]) AND status='PUBLISHED' AND publication_status='PUBLISHED' AND is_deleted IS NOT TRUE`,sql`ORDER BY "order",title`)).map(({sourceText,processingError,fullAudioPublicId,...lesson})=>lesson);
    const progresses = lessons.length
      ? await this.progressModel.select(sql`("user_id" = ${String(userId)}) AND ("lesson_id"=ANY(${lessons.map((l) => l._id)}::uuid[]))`)
      : [];
    const progressMap = new Map(progresses.map((progress) => [String(progress.lessonId), progress]));
    const hydratedSections = sections
      .map((section) => ({
        ...section,
        lessons: lessons
          .filter((lesson) => String(lesson.sectionId) === String(section._id))
          .map((lesson) => ({ ...lesson, progress: progressMap.get(String(lesson._id)) || null })) }))
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
      sections: hydratedSections };
  }

  private async uniqueSlug(raw: string, excludeId?: string): Promise<string> {
    const base = this.slugify(raw) || 'dictation';
    let slug = base;
    let counter = 1;

    while (
      await this.lessonModel.one(sql`slug=${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${excludeId ?? null}::uuid`)
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
    const lesson = newSqlRow('dictationlessons',{
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
      order: dto.order ?? 0 });

    return this.lessonModel.upsert(lesson);
  }

  private lessonFilter(query:QueryDictationDto){
    return sql`is_deleted IS NOT TRUE
      AND (${query.search ?? ''}='' OR position(lower(${query.search ?? ''}) in lower(title))>0 OR position(lower(${query.search ?? ''}) in lower(topic))>0)
      AND (${query.level ?? null}::text IS NULL OR level=to_jsonb(${query.level ?? null}::text))
      AND (${query.topic ?? null}::text IS NULL OR topic=${query.topic ?? null})
      AND (${query.status ?? null}::text IS NULL OR status=${query.status ?? null})
      AND (${query.publicationStatus ?? null}::text IS NULL OR publication_status=${query.publicationStatus ?? null})`;
  }
  async listAdmin(query: QueryDictationDto) {
    await this.ensureLegacyHierarchy();
    return this.lessonModel.select(this.lessonFilter(query),sql`ORDER BY created_at DESC`);
  }

  async getAdmin(id: string) {
    await this.ensureLegacyHierarchy();
    if (!isUuid(id)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    const segments = await this.segmentModel.select(sql`("lesson_id" = ${lesson._id})`, sql`ORDER BY "order" ASC NULLS FIRST`);
    return { ...lesson, segments };
  }

  async update(id: string, dto: UpdateDictationDto) {
    const current = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
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

    return this.lessonModel.patch(sql`id=${id}::uuid`,update);
  }

  async publish(id: string,actorId?:string) {
    if(!this.publication)throw new ConflictException('Publication workflow is not configured');
    await this.publication.publish('dictation',id,actorId??'');
    return this.getAdmin(id);
  }

  async unpublish(id: string,actorId?:string) {
    if(!this.publication)throw new ConflictException('Publication workflow is not configured');
    await this.publication.unpublish('dictation',id,actorId??'');
    return this.getAdmin(id);
  }

  /**
   * TTS flow: Kokoro synthesizes each sentence independently in memory, appends
   * them into one final WAV, and returns exact start/end offsets for each segment.
   * Only the final lesson WAV is uploaded; sentence WAVs are never persisted.
   */
  async generateAudio(id: string) {
    const lesson = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
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
    await this.lessonModel.upsert(lesson);

    try {
      const sequence = sentences.map((text, order) => ({
        text,
        voiceId: voices[order % voices.length],
        language: lesson.language,
        speed: lesson.speed,
        pauseAfterMs: order === sentences.length - 1 ? 0 : lesson.pauseAfterMs }));

      const fullResult = await this.ttsService.synthesizeSequence({
        segments: sequence,
        defaultVoiceId: voices[0],
        defaultLanguage: lesson.language,
        defaultSpeed: lesson.speed });

      const timings = fullResult.segmentTimingsMs || [];
      if (timings.length !== sentences.length) {
        throw new Error(
          `Kokoro returned ${timings.length} segment timings for ${sentences.length} segments.`,
        );
      }

      const storageKey = `dictation/${lesson._id.toString()}/full-${randomUUID()}.wav`;
      const fullUpload = await this.mediaStorage.saveBuffer(storageKey, fullResult.audio);

      const generatedSegments = sentences.map((text, order) => ({
        lessonId: lesson._id as string,
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
        words: [] }));

      await this.replaceProcessedAudio(lesson, generatedSegments, {
        url: fullUpload.url,
        storageKey: fullUpload.storageKey,
        durationMs: Number(fullResult.durationMs || 0),
        processor: fullResult.provider || 'kokoro',
        device: fullResult.device || '' });

      return this.getAdmin(id);
    } catch (error) {
      lesson.status = DictationStatus.AUDIO_FAILED;
      lesson.processingError = error instanceof Error ? error.message : String(error);
      await this.lessonModel.upsert(lesson);
      throw error;
    }
  }

  /**
   * Upload flow: Faster Whisper returns transcript + word/sentence timestamps.
   * The original uploaded audio becomes the single lesson audio file and ASR
   * timings are stored in the same startMs/endMs schema used by Kokoro.
   */
  async analyzeUploadedAudio(id: string, file: Express.Multer.File) {
    const lesson = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
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
    await this.lessonModel.upsert(lesson);

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

      const ext = (file.originalname?.split('.').pop() || 'audio').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'audio';
      const storageKey = `dictation/${lesson._id.toString()}/uploaded-${randomUUID()}.${ext}`;
      const upload = await this.mediaStorage.saveBuffer(storageKey, file.buffer);

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
          lessonId: lesson._id as string,
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
          words: segment.words || [] };
      });

      lesson.sourceText = segments.map((segment) => segment.text).join('\n');
      lesson.audioSource = DictationAudioSource.UPLOAD;

      await this.replaceProcessedAudio(lesson, segments, {
        url: upload.url,
        storageKey: upload.storageKey,
        durationMs: totalDurationMs,
        processor: `faster-whisper:${transcription.model}`,
        device: transcription.device || '' });

      return this.getAdmin(id);
    } catch (error) {
      lesson.status = DictationStatus.AUDIO_FAILED;
      lesson.processingError = error instanceof Error ? error.message : String(error);
      await this.lessonModel.upsert(lesson);
      throw error;
    }
  }

  async updateSegments(id: string, inputs: EditableSegmentInput[]) {
    const lesson = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
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

    const existing = await this.segmentModel.select(sql`("lesson_id" = ${lesson._id})`, sql`ORDER BY "order" ASC NULLS FIRST`);
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
        words: previous?.words || [] };
    });

    await withPgTransaction(this.nativeDb,async()=>{
    await this.segmentModel.remove(sql`("lesson_id" = ${lesson._id})`);
    for(const segment of replacement)await this.segmentModel.insert(segment);
    lesson.sourceText = replacement.map((segment) => segment.text).join('\n');
    lesson.sentenceCount = replacement.length;
    lesson.status = DictationStatus.READY;
    lesson.processingError = '';
    await this.lessonModel.upsert(lesson);
    });
    return this.getAdmin(id);
  }

  private async replaceProcessedAudio(
    lesson: DictationLessonRow,
    segments: Array<Record<string, unknown>>,
    audio: {
      url: string;
      storageKey: string;
      durationMs: number;
      processor: string;
      device: string;
    },
  ) {
    const oldSegments = await this.segmentModel.select(sql`("lesson_id" = ${lesson._id})`);
    const oldFullPublicId = lesson.fullAudioPublicId;
    const oldStorageKey = lesson.fullAudioStorageKey;

    await withPgTransaction(this.nativeDb,async()=>{
    await this.segmentModel.remove(sql`("lesson_id" = ${lesson._id})`);
    for(const segment of segments)await this.segmentModel.insert(segment);

    lesson.fullAudioUrl = audio.url;
    lesson.fullAudioStorageKey = audio.storageKey;
    lesson.fullAudioPublicId = '';
    lesson.totalDurationMs = Math.max(0, Math.round(audio.durationMs));
    lesson.sentenceCount = segments.length;
    lesson.audioProcessor = audio.processor;
    lesson.audioProcessorDevice = audio.device;
    lesson.status = DictationStatus.READY;
    lesson.processingError = '';
    await this.lessonModel.upsert(lesson);
    });

    // Delete old media only after the replacement is safely persisted. Legacy
    // sentence assets are removed here as old lessons are regenerated/analyzed.
    await Promise.allSettled([
      ...oldSegments
        .filter((segment) => Boolean(segment.audioPublicId))
        .map((segment) => this.mediaUploadService.deleteFile(segment.audioPublicId!, 'video')),
      ...(oldFullPublicId
        ? [this.mediaUploadService.deleteFile(oldFullPublicId, 'video')]
        : []),
      ...(oldStorageKey && oldStorageKey !== audio.storageKey
        ? [this.mediaStorage.delete(oldStorageKey)]
        : []),
    ]);
  }

  async remove(id: string) {
    const lesson = await this.lessonModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    lesson.isDeleted = true;
    lesson.status = DictationStatus.ARCHIVED;
    await this.lessonModel.upsert(lesson);
    return lesson;
  }

  async listPublished(userId: string, query: QueryDictationDto) {
    await this.ensureLegacyHierarchy();
    const lessons = (await this.lessonModel.select(sql`${this.lessonFilter(query)} AND status='PUBLISHED' AND publication_status='PUBLISHED'`,sql`ORDER BY published_at DESC,created_at DESC`)).map(({sourceText,processingError,fullAudioPublicId,...lesson})=>lesson);

    if (!lessons.length) return [];

    const progresses = await this.progressModel.select(sql`("user_id" = ${String(userId)}) AND ("lesson_id"=ANY(${lessons.map((l) => l._id)}::uuid[]))`);
    const progressMap = new Map(progresses.map((progress) => [progress.lessonId.toString(), progress]));

    return lessons.map((lesson) => ({
      ...lesson,
      progress: progressMap.get(lesson._id.toString()) || null }));
  }

  async getPublishedBySlug(slug: string, userId: string) {
    await this.ensureLegacyHierarchy();
    const lesson = await this.lessonModel.one(sql`("slug" = ${slug}) AND ("status" = ${DictationStatus.PUBLISHED}) AND publication_status='PUBLISHED' AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    const [segments, progress, topic, section] = await Promise.all([
      this.segmentModel.select(sql`("lesson_id" = ${lesson._id})`, sql`ORDER BY "order" ASC NULLS FIRST`),
      this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${lesson._id})`),
      lesson.topicId ? this.topicModel.one(sql`id=${lesson.topicId}::uuid`) : null,
      lesson.sectionId ? this.sectionModel.one(sql`id=${lesson.sectionId}::uuid`) : null,
    ]);

    return {
      ...lesson,
      fullAudioPublicId: undefined,
      processingError: undefined,
      topicInfo: topic ? { _id: topic._id, title: topic.title, slug: topic.slug } : null,
      sectionInfo: section ? { _id: section._id, title: section.title, slug: section.slug } : null,
      practiceSettings: {
        maxAttemptsBeforeReveal: this.maxAttemptsBeforeReveal,
        autoNextDelayMs: this.autoNextDelayMs },
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
      progress: progress || null };
  }

  async getProgress(userId: string, lessonId: string) {
    if (!isUuid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`("id" = ${lessonId}) AND ("status" = ${DictationStatus.PUBLISHED}) AND publication_status='PUBLISHED' AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');

    const progress = await this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${lesson._id})`);

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
      completed: false };
  }

  private ensureProgressSegment(progress: DictationProgressRow, segmentIndex: number) {
    const existing = progress.segmentProgress.find((item) => item.segmentIndex === segmentIndex);
    if (existing) return existing;
    progress.segmentProgress.push({
      segmentIndex,
      attempts: 0,
      wrongAttempts: 0,
      replayCount: 0,
      correct: false,
      firstTryCorrect: false,
      revealed: false } as any);
    return progress.segmentProgress[progress.segmentProgress.length - 1];
  }

  async recordAttempt(userId: string, lessonId: string, segmentIndex: number, isCorrect: boolean) {
    if (!isUuid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`("id" = ${lessonId}) AND ("status" = ${DictationStatus.PUBLISHED}) AND publication_status='PUBLISHED' AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (segmentIndex < 0 || segmentIndex >= lesson.sentenceCount) {
      throw new BadRequestException('Invalid dictation sentence index.');
    }

    let progress = await this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${lesson._id})`);
    if (!progress) {
      progress = newSqlRow('dictationprogresses',{
        userId: String(userId),
        lessonId: lesson._id });
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
          progress.completedSegments.sort((a:number, b:number) => a - b);
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
          progress.revealedSegments.sort((a:number, b:number) => a - b);
        }
      }
    }

    return this.saveLessonProgress(progress, lesson);
  }

  // Credit is keyed by progress ID; completed retries refresh cumulative F02
  // outcomes under the same key without awarding completion XP twice.
  private async saveLessonProgress(
    progress: DictationProgressRow,
    lesson: DictationLessonRow,
  ) {
    const handledSegments = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]);
    progress.completed = handledSegments.size >= lesson.sentenceCount;
    progress.lastPracticedAt = new Date();
    if (progress.completed) {
      if (!this.domainOutbox) throw new Error('Transactional outbox not configured');
      return this.domainOutbox.withTransaction(async (session) => {
        // Persist the completed progress and durable Learning event together.
        const saved = await new SqlRecords(createConnection(session.client as any),'dictationprogresses').upsert(progress,['user_id','lesson_id']);
        const firstTry = (saved.segmentProgress || []).filter((s: {firstTryCorrect?: boolean}) => s.firstTryCorrect).length;
        const outcomeSegments = await this.segmentModel.select(sql`lesson_id=${lesson._id}::uuid`);
        await this.domainOutbox!.enqueue('learning.activity.recorded.v1', String(saved.userId), {
          userId: String(saved.userId),
          module: 'DICTATION',type: 'DICTATION_LESSON',
          sourceKey: `dictation:${saved._id}`,
          xp: dictationLessonXp(firstTry),
          occurredAt: saved.lastPracticedAt,
          title: lesson.title,refId: String(lesson._id),link: `/dictation/${lesson.slug}`,
          correct: saved.completedSegments?.length ?? 0,total: lesson.sentenceCount,
          durationSec: lesson.totalDurationMs ? Math.round(lesson.totalDurationMs / 1000) : undefined,
          metadata: {firstTryCorrect:firstTry,revealed:saved.revealedSegments?.length??0},
          sourceService: 'content',
          outcomes: dictationOutcomes(saved, outcomeSegments),
        },session);
        return saved;
      });
    }
    return this.progressModel.upsert(progress,['user_id','lesson_id']);
  }

  async revealSegment(userId: string, lessonId: string, segmentIndex: number) {
    if (!isUuid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`("id" = ${lessonId}) AND ("status" = ${DictationStatus.PUBLISHED}) AND publication_status='PUBLISHED' AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (segmentIndex < 0 || segmentIndex >= lesson.sentenceCount) {
      throw new BadRequestException('Invalid dictation sentence index.');
    }
    let progress = await this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${lesson._id})`);
    if (!progress) {
      progress = newSqlRow('dictationprogresses',{ userId: String(userId), lessonId: lesson._id });
    }
    progress.revealedSegments ||= [];
    progress.segmentProgress ||= [];
    const segmentProgress = this.ensureProgressSegment(progress, segmentIndex);
    segmentProgress.revealed = true;
    if (!progress.revealedSegments.includes(segmentIndex)) {
      progress.revealedSegments.push(segmentIndex);
      progress.revealedSegments.sort((a:number, b:number) => a - b);
    }
    progress.currentSegment = segmentIndex;
    return this.saveLessonProgress(progress, lesson);
  }

  async revealTranscript(userId: string, lessonId: string) {
    if (!isUuid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`("id" = ${lessonId}) AND ("status" = ${DictationStatus.PUBLISHED}) AND publication_status='PUBLISHED' AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    let progress = await this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${String(lessonId)})`);
    if (!progress) {
      progress = newSqlRow('dictationprogresses',{
        userId: String(userId),
        lessonId: String(lessonId) });
    }
    progress.transcriptRevealed = true;
    progress.transcriptRevealedAt ||= new Date();
    progress.lastPracticedAt = new Date();
    return this.progressModel.upsert(progress,['user_id','lesson_id']);
  }

  async recordReplay(userId: string, lessonId: string, segmentIndex: number) {
    if (!isUuid(lessonId)) throw new NotFoundException('Dictation lesson not found.');
    const lesson = await this.lessonModel.one(sql`id=${lessonId}::uuid AND status='PUBLISHED' AND publication_status='PUBLISHED' AND is_deleted IS NOT TRUE`);
    if (!lesson) throw new NotFoundException('Dictation lesson not found.');
    if (segmentIndex < 0 || segmentIndex >= lesson.sentenceCount) {
      throw new BadRequestException('Invalid dictation sentence index.');
    }
    let progress = await this.progressModel.one(sql`("user_id" = ${String(userId)}) AND ("lesson_id" = ${String(lessonId)})`);
    if (!progress) {
      progress = newSqlRow('dictationprogresses',{
        userId: String(userId),
        lessonId: String(lessonId) });
    }
    progress.segmentProgress ||= [];
    const segmentProgress = this.ensureProgressSegment(progress, segmentIndex);
    segmentProgress.replayCount += 1;
    progress.lastPracticedAt = new Date();
    return this.progressModel.upsert(progress,['user_id','lesson_id']);
  }

  async resetProgress(userId: string, lessonId: string) {
    await this.progressModel.remove(sql`user_id=${userId}::uuid AND lesson_id=${lessonId}::uuid`);
    return { success: true };
  }

  async progressOverview(userId: string) {
    const progresses = (await rows(this.nativeDb,sql`SELECT p.*,jsonb_build_object('_id',l.id,'title',l.title,'slug',l.slug,'level',l.level,'topic',l.topic,'sentenceCount',l.sentence_count,'totalDurationMs',l.total_duration_ms) AS lesson FROM dictationprogresses p JOIN dictationlessons l ON l.id=p.lesson_id WHERE p.user_id=${userId}::uuid AND l.status='PUBLISHED' AND l.publication_status='PUBLISHED' AND l.is_deleted IS NOT TRUE ORDER BY p.last_practiced_at DESC`)).map(row=>({...rowData<any>(row),lessonId:row.lesson}));

    const items = progresses.filter((progress) => progress.lessonId);
    return {
      totalStarted: items.length,
      completed: items.filter((item) => item.completed).length,
      totalCorrect: items.reduce((sum, item) => sum + item.correctCount, 0),
      totalAttempts: items.reduce((sum, item) => sum + item.attempts, 0),
      items };
  }
}
