import { Injectable,NotFoundException } from '@nestjs/common';
import { I18nContext,I18nService } from 'nestjs-i18n';
import {
first,
literal,
rowData,
rows,
sql,
type Sql
} from '../../../postgres/sql.js';
import { publicationScope } from '../../publication/publication-scope.js';
import { ContentSqlRepository } from '../content-sql.repository.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateLessonWordDto } from './dto/update-lesson-word.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';

const validUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
@Injectable()
export class LessonsService {
  constructor(
    private readonly repository: ContentSqlRepository,
    private readonly i18n: I18nService,
  ) {}
  private async missing(key = 'LESSON_NOT_FOUND'): Promise<never> {
    throw new NotFoundException(
      await this.i18n.t(`lesson.${key}`, {
        lang: I18nContext.current()?.lang || 'vi',
      }),
    );
  }
  private generateSlug(text: string) {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  private async uniqueSlug(
    table: 'lessons' | 'sections',
    raw: string,
    parent: Sql,
    id: string | null = null,
  ) {
    const base =
      this.generateSlug(raw) || (table === 'lessons' ? 'lesson' : 'section');
    let slug = base,
      counter = 1;
    // PostgreSQL's (collection_id,slug)/(lesson_id,slug) indexes include deleted rows.
    while (
      await this.repository.one(
        table,
        sql`(${parent}) AND slug = ${slug} AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      slug = `${base}-${counter++}`;
    return slug;
  }
  async createLesson(input: CreateLessonDto) {
    const slug = await this.uniqueSlug(
      'lessons',
      input.slug?.trim() || input.title,
      sql`collection_id = ${input.collectionId}::uuid`,
    );
    const order =
      input.order && input.order > 0
        ? input.order
        : (await this.repository.count(
            'lessons',
            sql`collection_id = ${input.collectionId}::uuid AND is_deleted IS NOT TRUE`,
          )) + 1;
    return this.repository.insert('lessons', {
      ...input,
      slug,
      order,
      isActive: input.isActive ?? true,
      isDeleted: false,
    });
  }
  private async lessons(where: Sql, tail = literal('')) {
    const learner = publicationScope.getStore() === true;
    const gate = learner
      ? literal(
          "AND l.publication_status = 'PUBLISHED' AND l.is_active IS NOT FALSE",
        )
      : literal('');
    const result = await rows(
      this.repository.connection,
      sql`SELECT l.*,
      (SELECT COUNT(*)::integer FROM public.lessonwords lw WHERE lw.lesson_id = l.id) AS words_count,
      (SELECT COUNT(*)::integer FROM public.sections s WHERE s.lesson_id = l.id) AS sections_count
      FROM public.lessons l WHERE l.is_deleted IS NOT TRUE AND (${where}) ${gate} ${tail}`,
    );
    return result.map(({ words_count, sections_count, ...row }) => ({
      ...rowData(row),
      wordsCount: Number(words_count),
      sectionsCount: Number(sections_count),
    }));
  }
  findAllLessons(collectionId?: string, publicationStatus?: string) {
    return this.lessons(
      sql`(${collectionId || null}::uuid IS NULL OR l.collection_id = ${collectionId || null}::uuid)
      AND (${publicationStatus || null}::text IS NULL OR l.publication_status = ${publicationStatus || null})`,
      literal('ORDER BY l."order" ASC NULLS LAST, l.created_at DESC, l.id'),
    );
  }
  async findBySlug(slug: string, collectionId?: string) {
    const parent =
      collectionId && validUuid(collectionId)
        ? sql`l.collection_id = ${collectionId}::uuid`
        : literal('TRUE');
    const lesson = (
      await this.lessons(
        sql`l.slug = ${slug} AND (${parent})`,
        literal('LIMIT 1'),
      )
    )[0];
    if (lesson) return lesson;
    return validUuid(slug) ? this.findOneLesson(slug) : this.missing();
  }
  async findOneLesson(id: string) {
    return (
      (await this.lessons(sql`l.id = ${id}::uuid`, literal('LIMIT 1')))[0] ??
      this.missing()
    );
  }
  async updateLesson(id: string, input: UpdateLessonDto) {
    const data = { ...input };
    if (input.slug || input.title) {
      const existing = await this.findOneLesson(id);
      data.slug = await this.uniqueSlug(
        'lessons',
        input.slug?.trim() || input.title!,
        sql`collection_id = ${input.collectionId || existing.collectionId}::uuid`,
        id,
      );
    }
    return (
      (await this.repository.patch(
        'lessons',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        data,
      )) ?? this.missing()
    );
  }
  async toggleActive(id: string, isActive?: boolean) {
    const lesson = await this.findOneLesson(id);
    return (
      (await this.repository.patch(
        'lessons',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        { isActive: isActive ?? !lesson.isActive },
      )) ?? this.missing()
    );
  }
  async removeLesson(id: string) {
    return (
      (await this.repository.patch(
        'lessons',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        { isDeleted: true },
      )) ?? this.missing()
    );
  }
  async restore(id: string) {
    return (
      (await this.repository.patch('lessons', sql`id = ${id}::uuid`, {
        isDeleted: false,
      })) ?? this.missing()
    );
  }
  reorderLessons(items: { id: string; order: number }[]) {
    return this.repository.reorder('lessons', items);
  }

  async createSection(lessonId: string, input: CreateSectionDto) {
    await this.findOneLesson(lessonId);
    const slug = await this.uniqueSlug(
      'sections',
      input.slug?.trim() || input.name,
      sql`lesson_id = ${lessonId}::uuid`,
    );
    const order =
      input.order && input.order > 0
        ? input.order
        : (await this.repository.count(
            'sections',
            sql`lesson_id = ${lessonId}::uuid`,
          )) + 1;
    return this.repository.insert('sections', {
      ...input,
      lessonId,
      slug,
      order,
    });
  }
  async getSections(lessonId: string) {
    await this.findOneLesson(lessonId);
    const result = await rows(
      this.repository.connection,
      sql`SELECT s.*,
      (SELECT COUNT(*)::integer FROM public.lessonwords lw WHERE lw.section_id = s.id) AS words_count
      FROM public.sections s WHERE s.lesson_id = ${lessonId}::uuid ORDER BY s."order" ASC NULLS LAST, s.created_at ASC, s.id`,
    );
    return result.map(({ words_count, ...row }) => ({
      ...rowData(row),
      wordsCount: Number(words_count),
    }));
  }
  async getSectionById(sectionId: string) {
    const section = await this.repository.one(
      'sections',
      sql`id = ${sectionId}::uuid`,
    );
    if (!section) return this.missing('SECTION_NOT_FOUND');
    return {
      ...section,
      wordsCount: await this.repository.count(
        'lessonwords',
        sql`section_id = ${sectionId}::uuid`,
      ),
    };
  }
  async updateSection(sectionId: string, input: UpdateSectionDto) {
    const existing = await this.getSectionById(sectionId);
    const data = { ...input };
    if (input.name || input.slug)
      data.slug = await this.uniqueSlug(
        'sections',
        input.slug?.trim() || input.name || existing.name,
        sql`lesson_id = ${existing.lessonId}::uuid`,
        sectionId,
      );
    return (
      (await this.repository.patch(
        'sections',
        sql`id = ${sectionId}::uuid`,
        data,
      )) ?? this.missing('SECTION_NOT_FOUND')
    );
  }
  async deleteSection(sectionId: string): Promise<void> {
    await this.repository.transaction(async (repository) => {
      const section = await first(
        repository.connection,
        sql`SELECT id FROM public.sections WHERE id = ${sectionId}::uuid FOR UPDATE`,
      );
      if (!section) return this.missing('SECTION_NOT_FOUND');
      await repository.patch(
        'lessonwords',
        sql`section_id = ${sectionId}::uuid`,
        { sectionId: null },
      );
      await rows(repository.connection,sql`DELETE FROM public.sections WHERE id = ${sectionId}::uuid`);
    });
  }
  reorderSections(lessonId: string, items: { id: string; order: number }[]) {
    return this.repository.reorder(
      'sections',
      items,
      sql`target.lesson_id = ${lessonId}::uuid`,
    );
  }
  async addWordsToLesson(
    lessonId: string,
    wordIds: string[],
    sectionId?: string,
  ) {
    await this.findOneLesson(lessonId);
    await this.repository.transaction(async (repository) => {
      // Serialize the count/order assignment for this lesson with concurrent additions.
      await rows(
        repository.connection,
        sql`SELECT id FROM public.lessons WHERE id = ${lessonId}::uuid FOR UPDATE`,
      );
      if (sectionId) {
        const section = await repository.one(
          'sections',
          sql`id = ${sectionId}::uuid AND lesson_id = ${lessonId}::uuid`,
        );
        if (!section) return this.missing('SECTION_NOT_FOUND');
      }
      const count = await repository.count(
        'lessonwords',
        sql`lesson_id = ${lessonId}::uuid AND (${sectionId || null}::uuid IS NULL OR section_id = ${sectionId || null}::uuid)`,
      );
      const unique = [...new Set(wordIds)];
      if (!unique.length) return;
      await rows(
        repository.connection,
        sql`INSERT INTO public.lessonwords (lesson_id, word_id, section_id, "order")
        SELECT ${lessonId}::uuid, input.word_id, ${sectionId || null}::uuid, ${count}::double precision + input.ordinality
        FROM unnest(${unique}::uuid[]) WITH ORDINALITY AS input(word_id, ordinality)
        ON CONFLICT (lesson_id, word_id) DO UPDATE SET
          section_id = CASE WHEN ${sectionId || null}::uuid IS NULL THEN lessonwords.section_id ELSE EXCLUDED.section_id END,
          payload = lessonwords.payload - 'sectionId'`,
      );
    });
    return this.getWordsInLesson(lessonId, sectionId);
  }
  private async populatedWords(where: Sql) {
    const gate =
      publicationScope.getStore() === true
        ? literal(
            "AND w.publication_status = 'PUBLISHED' AND w.is_deleted IS NOT TRUE AND w.is_active IS NOT FALSE",
          )
        : literal('');
    const result = await rows(
      this.repository.connection,
      sql`SELECT lw.*, to_jsonb(w) AS joined_word, to_jsonb(s) AS joined_section
      FROM public.lessonwords lw LEFT JOIN public.words w ON w.id = lw.word_id ${gate}
      LEFT JOIN public.sections s ON s.id = lw.section_id WHERE ${where}
      ORDER BY lw.created_at DESC, lw.id DESC`,
    );
    return result.map(({ joined_word, joined_section, ...row }) => ({
      ...rowData(row),
      wordId: joined_word ? rowData(joined_word) : null,
      sectionId: joined_section ? rowData(joined_section) : null,
    }));
  }
  async getWordsInLesson(lessonId: string, sectionId?: string) {
    await this.findOneLesson(lessonId);
    return this.populatedWords(
      sql`lw.lesson_id = ${lessonId}::uuid AND (${sectionId || null}::uuid IS NULL OR lw.section_id = ${sectionId || null}::uuid)`,
    );
  }
  async updateLessonWord(
    lessonId: string,
    wordId: string,
    input: UpdateLessonWordDto,
  ) {
    const data = { ...input };
    if (input.sectionId !== undefined) data.sectionId = input.sectionId || null;
    const updated = await this.repository.patch(
      'lessonwords',
      sql`lesson_id = ${lessonId}::uuid AND word_id = ${wordId}::uuid`,
      data,
    );
    if (!updated) return this.missing('WORD_NOT_IN_LESSON');
    return (
      await this.populatedWords(
        sql`lw.lesson_id = ${lessonId}::uuid AND lw.word_id = ${wordId}::uuid`,
      )
    )[0];
  }
  async reorderLessonWords(
    lessonId: string,
    items: { wordId: string; order: number; sectionId?: string | null }[],
  ): Promise<void> {
    if (!items.length) return;
    const unique = [
      ...new Map(items.map((item) => [item.wordId, item])).values(),
    ].map((item) => ({
      word_id: item.wordId,
      order: item.order,
      section_id: item.sectionId || null,
      change_section: item.sectionId !== undefined,
    }));
    await rows(
      this.repository.connection,
      sql`UPDATE public.lessonwords lw SET "order" = input."order",
      section_id = CASE WHEN input.change_section THEN input.section_id ELSE lw.section_id END,
      payload = lw.payload - 'order' - CASE WHEN input.change_section THEN 'sectionId' ELSE 'order' END
      FROM jsonb_to_recordset(${JSON.stringify(unique)}::jsonb) AS input(word_id uuid, "order" double precision, section_id uuid, change_section boolean)
      WHERE lw.lesson_id = ${lessonId}::uuid AND lw.word_id = input.word_id`,
    );
  }
  async removeWordFromLesson(lessonId: string, wordId: string): Promise<void> {
    const removed = await first(
      this.repository.connection,
      sql`DELETE FROM public.lessonwords WHERE lesson_id = ${lessonId}::uuid AND word_id = ${wordId}::uuid RETURNING id`,
    );
    if (!removed) return this.missing('WORD_NOT_IN_LESSON');
  }
}
