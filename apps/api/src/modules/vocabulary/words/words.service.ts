import {
BadRequestException,
Injectable,
NotFoundException,
} from '@nestjs/common';
import { I18nContext,I18nService } from 'nestjs-i18n';
import { AudioGenerationStatus } from '../../../common/media/audio.types.js';
import {
identifier,
joinSql,
literal,
rows,
sql,
type Sql,
} from '../../../postgres/sql.js';
import { ContentSqlRepository } from '../content-sql.repository.js';
import { CreateWordDto } from './dto/create-word.dto.js';
import { QueryWordDto } from './dto/query-word.dto.js';
import { UpdateWordDto } from './dto/update-word.dto.js';

const SORT_COLUMNS: Record<string, string> = {
  _id: 'id',
  id: 'id',
  word: 'word',
  slug: 'slug',
  level: 'level',
  isActive: 'is_active',
  isDeleted: 'is_deleted',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  publicationStatus: 'publication_status',
};
// Shape the public list without returning image/variations or internal payload fields.
function summary(word: any, withMetadata = true) {
  const result: any = {
    _id: word._id,
    word: word.word,
    ipa: word.ipa,
    audio: word.audio,
    parts: (word.parts ?? []).map((part: any) => ({
      partOfSpeech: part.partOfSpeech,
      meanings: (part.meanings ?? []).map((meaning: any) => ({
        definition: meaning.definition,
        translation: meaning.translation,
      })),
    })),
    level: word.level,
    isActive: word.isActive,
  };
  if (withMetadata)
    Object.assign(result, {
      audioMeta: word.audioMeta,
      createdAt: word.createdAt,
      publicationStatus: word.publicationStatus,
      publicationRevision: word.publicationRevision,
      publicationValidation: word.publicationValidation,
    });
  return result;
}

@Injectable()
export class WordsService {
  constructor(
    private readonly repository: ContentSqlRepository,
    private readonly i18n: I18nService,
  ) {}
  private getLang() {
    return I18nContext.current()?.lang || 'vi';
  }
  private message(key: string) {
    return this.i18n.t(`word.${key}`, { lang: this.getLang() });
  }
  private async missing(key = 'WORD_NOT_FOUND'): Promise<never> {
    throw new NotFoundException(await this.message(key));
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
  private async uniqueSlug(raw: string, id: string | null = null) {
    const base = this.generateSlug(raw) || 'word';
    let slug = base,
      counter = 1;
    while (
      await this.repository.one(
        'words',
        sql`slug = ${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      slug = `${base}-${counter++}`;
    return slug;
  }
  private async checkWord(word: string, id: string | null = null) {
    if (
      await this.repository.one(
        'words',
        sql`word = ${word} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      throw new BadRequestException(await this.message('WORD_ALREADY_EXISTS'));
  }
  async create(input: CreateWordDto) {
    const word = input.word.trim();
    await this.checkWord(word);
    const slug = await this.uniqueSlug(word);
    const data = await this.repository.insert('words', {
      ...input,
      word,
      slug,
      ipa: input.ipa ?? {},
      audio: input.audio ?? {},
      audioMeta: {},
      variations: input.variations ?? [],
      relatedWords: input.relatedWords ?? [],
      parts: input.parts ?? [],
      isActive: input.isActive ?? true,
      isDeleted: input.isDeleted ?? false,
    });
    return { message: await this.message('WORD_CREATED_SUCCESSFULLY'), data };
  }
  async findAll(query: QueryWordDto) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.limit) || 10)),
    );
    const conditions: Sql[] = [
      typeof query.isDeleted === 'boolean'
        ? sql`is_deleted = ${query.isDeleted}`
        : literal('is_deleted IS NOT TRUE'),
    ];
    if (typeof query.isActive === 'boolean')
      conditions.push(sql`is_active = ${query.isActive}`);
    if (query.publicationStatus)
      conditions.push(sql`publication_status = ${query.publicationStatus}`);
    if (query.search)
      conditions.push(sql`word ILIKE '%' || ${query.search.trim()} || '%'`);
    if (query.level) conditions.push(sql`level = ${query.level}`);
    if (query.partOfSpeech)
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(parts, '[]'::jsonb)) AS part WHERE part->>'partOfSpeech' = ${query.partOfSpeech})`,
      );
    const where = joinSql(conditions, ' AND ');
    const direction = literal(query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    const column = identifier(
      SORT_COLUMNS[query.sortBy || 'createdAt'] || 'created_at',
    );
    const [words, total] = await Promise.all([
      this.repository.list(
        'words',
        where,
        sql`ORDER BY ${column} ${direction} NULLS LAST, id ${direction} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      this.repository.count('words', where),
    ]);
    return {
      message: await this.message('WORD_LIST_FETCHED_SUCCESSFULLY'),
      data: words.map((word) => summary(word)),
      total,
      page,
      limit,
    };
  }
  async findOne(id: string) {
    const data = await this.repository.one(
      'words',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
    );
    if (!data) return this.missing();
    return { message: await this.message('WORD_FETCHED_SUCCESSFULLY'), data };
  }
  async update(id: string, input: UpdateWordDto) {
    await this.findOne(id);
    const changes: Record<string, any> = { ...input };
    if (input.word) {
      changes.word = input.word.trim();
      await this.checkWord(changes.word, id);
      changes.slug = await this.uniqueSlug(changes.word, id);
    }
    // Read each accent from the row being updated. Renaming and staling audio
    // are atomic and invalidate the publication revision exactly once.
    const expressions: Record<string, Sql> = {};
    if (typeof input.word === 'string')
      expressions.audioMeta = sql`CASE WHEN word IS DISTINCT FROM ${input.word.trim()} THEN (
      SELECT COALESCE(jsonb_object_agg(entry.key, CASE WHEN entry.value->>'status' = ${AudioGenerationStatus.READY}
        THEN jsonb_set(entry.value, '{status}', to_jsonb(${AudioGenerationStatus.STALE}::text)) ELSE entry.value END), '{}'::jsonb)
      FROM jsonb_each(COALESCE(audio_meta, '{}'::jsonb)) entry) ELSE audio_meta END`;
    const data = await this.repository.patch(
      'words',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      changes,
      expressions,
    );
    if (!data) return this.missing();
    return { message: await this.message('WORD_UPDATED_SUCCESSFULLY'), data };
  }
  async remove(id: string) {
    const data = await this.repository.patch(
      'words',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      { isDeleted: true },
    );
    if (!data) return this.missing();
    return { message: await this.message('WORD_DELETED_SUCCESSFULLY'), data };
  }
  async restore(id: string) {
    const data = await this.repository.patch(
      'words',
      sql`id = ${id}::uuid AND is_deleted = TRUE`,
      { isDeleted: false },
    );
    if (!data) return this.missing('WORD_NOT_FOUND_OR_NOT_DELETED');
    return { message: await this.message('WORD_RESTORED_SUCCESSFULLY'), data };
  }
  async toggleActive(id: string, isActive?: boolean) {
    const { data: current } = await this.findOne(id);
    const next = isActive ?? !current.isActive;
    const data = await this.repository.patch(
      'words',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      { isActive: next },
    );
    if (!data) return this.missing();
    return {
      message: await this.message(
        next ? 'WORD_ACTIVATED_SUCCESSFULLY' : 'WORD_DEACTIVATED_SUCCESSFULLY',
      ),
      data,
    };
  }
  async bulkToggleActive(ids: string[], isActive: boolean) {
    if (!Array.isArray(ids) || !ids.length)
      throw new BadRequestException(await this.message('NO_WORDS_PROVIDED'));
    const result = await rows(
      this.repository.connection,
      sql`UPDATE public.words SET is_active = ${isActive}, payload = payload - 'isActive'
      WHERE id = ANY(${ids}::uuid[]) AND is_deleted IS NOT TRUE RETURNING id`,
    );
    return {
      message: await this.message(
        isActive
          ? 'WORDS_ACTIVATED_SUCCESSFULLY'
          : 'WORDS_DEACTIVATED_SUCCESSFULLY',
      ),
      modifiedCount: result.length,
    };
  }
  async bulkLookup(words: string[]) {
    if (!Array.isArray(words) || !words.length)
      throw new BadRequestException(await this.message('NO_WORDS_PROVIDED'));
    const unique = [
      ...new Set(
        words.map((word) => word.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    const data = await this.repository.list(
      'words',
      sql`LOWER(word) = ANY(${unique}::text[]) AND is_deleted IS NOT TRUE`,
    );
    const found = data.map((word) => summary(word, false));
    const foundSet = new Set(found.map((word) => word.word.toLowerCase()));
    const notFound = unique.filter((word) => !foundSet.has(word));
    return {
      message: await this.message('BULK_LOOKUP_COMPLETED'),
      found,
      notFound,
      totalInput: unique.length,
      totalFound: found.length,
      totalNotFound: notFound.length,
    };
  }
}
