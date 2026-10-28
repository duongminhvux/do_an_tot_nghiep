import {
ConflictException,
Injectable,
NotFoundException,
} from '@nestjs/common';
import { I18nContext,I18nService } from 'nestjs-i18n';
import { sql } from '../../../postgres/sql.js';
import { publicationScope } from '../../publication/publication-scope.js';
import { ContentSqlRepository } from '../content-sql.repository.js';
import { CreateVocabularyGroupDto } from './dto/create-vocabulary-group.dto.js';
import { QueryVocabularyGroupDto } from './dto/query-vocabulary-group.dto.js';
import { UpdateVocabularyGroupDto } from './dto/update-vocabulary-group.dto.js';

@Injectable()
export class VocabularyGroupsService {
  constructor(
    private readonly repository: ContentSqlRepository,
    private readonly i18n: I18nService,
  ) {}
  private getLang() {
    return I18nContext.current()?.lang || 'vi';
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
  private async conflict() {
    throw new ConflictException(
      await this.i18n.t('vocabulary-group.GROUP_ALREADY_EXISTS', {
        lang: this.getLang(),
      }),
    );
  }
  private async missing(): Promise<never> {
    throw new NotFoundException(
      await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', {
        lang: this.getLang(),
      }),
    );
  }
  private async uniqueSlug(raw: string, id: string | null = null) {
    const base = this.generateSlug(raw) || 'group';
    let slug = base,
      counter = 1;
    while (
      await this.repository.one(
        'vocabularygroups',
        sql`slug = ${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      slug = `${base}-${counter++}`;
    return slug;
  }
  async create(input: CreateVocabularyGroupDto) {
    const name = input.name.trim();
    if (
      await this.repository.one(
        'vocabularygroups',
        sql`LOWER(name) = LOWER(${name}) AND is_deleted IS NOT TRUE`,
      )
    )
      await this.conflict();
    const slug = await this.uniqueSlug(input.slug?.trim() || name);
    const order =
      input.order && input.order > 0
        ? input.order
        : (await this.repository.count(
            'vocabularygroups',
            sql`is_deleted IS NOT TRUE`,
          )) + 1;
    return this.repository.insert('vocabularygroups', {
      ...input,
      name,
      slug,
      order,
      isActive: input.isActive ?? true,
      isDeleted: false,
    });
  }

  async findAll(
    query: QueryVocabularyGroupDto,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const { search, isActive, page = 1, limit = 10 } = query;
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(
      100,
      Math.max(1, Math.floor(Number(limit) || 10)),
    );
    const learner = publicationScope.getStore() === true;

    // SQL-native pagination and aggregation. Never materialize all lessons/words.
    const [groupsResult, countResult] = await Promise.all([
      this.repository.connection.query(
        `
        SELECT g.id AS "_id", g.name, g.slug, g.description,
               g."order", g.is_active AS "isActive", g.is_deleted AS "isDeleted",
               g.created_at AS "createdAt", g.updated_at AS "updatedAt"
        FROM public.vocabularygroups g
        WHERE g.is_deleted IS NOT TRUE
          AND ($1::text IS NULL OR g.name ILIKE '%' || $1 || '%'
               OR g.description ILIKE '%' || $1 || '%')
          AND ($2::boolean IS NULL OR g.is_active = $2)
        ORDER BY g."order" ASC NULLS LAST, g.created_at DESC, g.id
        LIMIT $3 OFFSET $4
      `,
        [
          search || null,
          isActive ?? null,
          safeLimit,
          (safePage - 1) * safeLimit,
        ],
      ),
      this.repository.connection.query(
        `
        SELECT COUNT(*)::integer AS total FROM public.vocabularygroups g
        WHERE g.is_deleted IS NOT TRUE
          AND ($1::text IS NULL OR g.name ILIKE '%' || $1 || '%'
               OR g.description ILIKE '%' || $1 || '%')
          AND ($2::boolean IS NULL OR g.is_active = $2)
      `,
        [search || null, isActive ?? null],
      ),
    ]);
    const rawGroups = groupsResult.rows;
    const total = Number(countResult.rows[0]?.total ?? 0);
    const groupIds = rawGroups.map((g) => String(g._id));
    const rawCollections: any[] = [];
    const collectionLessonsCountMap = new Map<string, number>();
    const collectionWordsCountMap = new Map<string, number>();
    if (groupIds.length) {
      const result = await this.repository.connection.query(
        `
        SELECT c.id AS "_id", c.group_id AS "groupId", c.name, c.slug,
               c.description, c.cover_url AS "coverUrl", c."order",
               c.is_active AS "isActive", c.is_deleted AS "isDeleted",
               c.created_at AS "createdAt", c.updated_at AS "updatedAt",
               COALESCE(stats.lessons_count, 0)::integer AS "_lessonsCount",
               COALESCE(stats.words_count, 0)::integer AS "_wordsCount"
        FROM public.collections c
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT l.id) AS lessons_count,
                 COUNT(lw.id) AS words_count
          FROM public.lessons l
          LEFT JOIN public.lessonwords lw ON lw.lesson_id = l.id
          WHERE l.collection_id = c.id AND l.is_deleted IS NOT TRUE
            ${learner ? "AND l.publication_status = 'PUBLISHED' AND l.is_active IS NOT FALSE" : ''}
        ) stats ON TRUE
        WHERE c.group_id = ANY($1::uuid[]) AND c.is_deleted IS NOT TRUE
        ORDER BY c."order" ASC NULLS LAST, c.created_at DESC, c.id
      `,
        [groupIds],
      );
      for (const { _lessonsCount, _wordsCount, ...collection } of result.rows) {
        rawCollections.push(collection);
        collectionLessonsCountMap.set(
          String(collection._id),
          Number(_lessonsCount),
        );
        collectionWordsCountMap.set(
          String(collection._id),
          Number(_wordsCount),
        );
      }
    }

    // Group collections by groupId
    const collectionsByGroup = new Map<string, any[]>();
    rawCollections.forEach((c) => {
      const gId = c.groupId?.toString();
      if (!gId) return;
      if (!collectionsByGroup.has(gId)) {
        collectionsByGroup.set(gId, []);
      }
      collectionsByGroup.get(gId)!.push({
        ...c,
        lessonsCount: collectionLessonsCountMap.get(c._id.toString()) || 0,
        wordsCount: collectionWordsCountMap.get(c._id.toString()) || 0,
      });
    });

    const data = rawGroups.map((g) => {
      const cols = collectionsByGroup.get(g._id.toString()) || [];
      const totalLessons = cols.reduce(
        (acc, cur) => acc + (cur.lessonsCount || 0),
        0,
      );
      const totalWords = cols.reduce(
        (acc, cur) => acc + (cur.wordsCount || 0),
        0,
      );
      return {
        ...g,
        collectionsCount: cols.length,
        lessonsCount: totalLessons,
        wordsCount: totalWords,
        collections: cols,
      };
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findOne(id: string) {
    const group = await this.repository.one(
      'vocabularygroups',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
    );
    if (!group) return this.missing();
    const collectionsCount = await this.repository.count(
      'collections',
      sql`group_id = ${id}::uuid AND is_deleted IS NOT TRUE`,
    );
    return { ...group, collectionsCount };
  }
  async update(id: string, input: UpdateVocabularyGroupDto) {
    const data = { ...input };
    if (input.name) {
      data.name = input.name.trim();
      if (
        await this.repository.one(
          'vocabularygroups',
          sql`id <> ${id}::uuid AND LOWER(name) = LOWER(${data.name}) AND is_deleted IS NOT TRUE`,
        )
      )
        await this.conflict();
    }
    if (input.slug || input.name)
      data.slug = await this.uniqueSlug(input.slug?.trim() || input.name!, id);
    const updated = await this.repository.patch(
      'vocabularygroups',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      data,
    );
    return updated ?? this.missing();
  }
  async toggleActive(id: string, isActive?: boolean) {
    const group = await this.findOne(id);
    const updated = await this.repository.patch(
      'vocabularygroups',
      sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      { isActive: isActive ?? !group.isActive },
    );
    return updated ?? this.missing();
  }
  async remove(id: string) {
    return this.repository.transaction(async (repository) => {
      const group = await repository.one(
        'vocabularygroups',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
      );
      if (!group) return this.missing();
      const timestamp = Date.now();
      const deleted = await repository.patch(
        'vocabularygroups',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        {
          isDeleted: true,
          name: `${group.name}_deleted_${timestamp}`,
          slug: `${group.slug}_deleted_${timestamp}`,
        },
      );
      if (!deleted) return this.missing();
      await repository.patch('collections', sql`group_id = ${id}::uuid`, {
        groupId: null,
      });
      return deleted;
    });
  }
  async restore(id: string) {
    return (
      (await this.repository.patch('vocabularygroups', sql`id = ${id}::uuid`, {
        isDeleted: false,
      })) ?? this.missing()
    );
  }
  reorderGroups(items: { id: string; order: number }[]) {
    return this.repository.reorder('vocabularygroups', items);
  }
}
