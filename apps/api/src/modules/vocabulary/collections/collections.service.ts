import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ContentSqlRepository } from '../content-sql.repository.js';
import {
  first,
  rows,
  rowData,
  sql,
  literal,
  type Sql,
} from '../../../postgres/sql.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';
import { publicationScope } from '../../publication/publication-scope.js';

@Injectable()
export class CollectionsService {
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
  private async missing(): Promise<never> {
    throw new NotFoundException(
      await this.i18n.t('collection.COLLECTION_NOT_FOUND', {
        lang: this.getLang(),
      }),
    );
  }
  private async checkName(name: string, id: string | null = null) {
    if (
      await this.repository.one(
        'collections',
        sql`LOWER(name) = LOWER(${name}) AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      throw new ConflictException(
        await this.i18n.t('collection.COLLECTION_ALREADY_EXISTS', {
          lang: this.getLang(),
        }),
      );
  }
  private async uniqueSlug(raw: string, id: string | null = null) {
    const base = this.generateSlug(raw) || 'collection';
    let slug = base,
      counter = 1;
    while (
      await this.repository.one(
        'collections',
        sql`slug = ${slug} AND is_deleted IS NOT TRUE AND id IS DISTINCT FROM ${id}::uuid`,
      )
    )
      slug = `${base}-${counter++}`;
    return slug;
  }
  async create(input: CreateCollectionDto) {
    const name = input.name.trim();
    await this.checkName(name);
    const slug = await this.uniqueSlug(input.slug?.trim() || name);
    const order =
      input.order && input.order > 0
        ? input.order
        : (await this.repository.count(
            'collections',
            sql`is_deleted IS NOT TRUE`,
          )) + 1;
    return this.repository.insert('collections', {
      ...input,
      name,
      slug,
      order,
      groupId: input.groupId || null,
      isActive: input.isActive ?? true,
      isDeleted: false,
    });
  }
  private lessonGate() {
    return publicationScope.getStore() === true
      ? literal(
          "AND l.publication_status = 'PUBLISHED' AND l.is_active IS NOT FALSE",
        )
      : literal('');
  }
  private async select(where: Sql, tail = literal('')) {
    const result = await rows(
      this.repository.connection,
      sql`
      SELECT c.*, to_jsonb(g) AS joined_group,
        (SELECT COUNT(*)::integer FROM public.lessons l WHERE l.collection_id = c.id AND l.is_deleted IS NOT TRUE ${this.lessonGate()}) AS lessons_count
      FROM public.collections c LEFT JOIN public.vocabularygroups g ON g.id = c.group_id
      WHERE c.is_deleted IS NOT TRUE AND (${where}) ${tail}`,
    );
    return result.map(({ joined_group, lessons_count, ...row }) => ({
      ...rowData(row),
      groupId: joined_group
        ? {
            _id: joined_group.id,
            name: joined_group.name,
            slug: joined_group.slug,
            order: joined_group.order,
            isActive: joined_group.is_active,
          }
        : row.group_id,
      lessonsCount: Number(lessons_count),
    }));
  }
  async findAll(query: QueryCollectionDto) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.limit) || 10)),
    );
    const where = sql`(${query.groupId || null}::uuid IS NULL OR c.group_id = ${query.groupId || null}::uuid)
      AND (${query.search || null}::text IS NULL OR c.name ILIKE '%' || ${query.search || null} || '%'
           OR c.description ILIKE '%' || ${query.search || null} || '%')
      AND (${query.isActive ?? null}::boolean IS NULL OR c.is_active = ${query.isActive ?? null})`;
    const [data, count] = await Promise.all([
      this.select(
        where,
        sql`ORDER BY c."order" ASC NULLS LAST, c.created_at DESC, c.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      first(
        this.repository.connection,
        sql`SELECT COUNT(*)::integer AS total FROM public.collections c WHERE c.is_deleted IS NOT TRUE AND (${where})`,
      ),
    ]);
    return { data, total: Number(count?.total ?? 0), page, limit };
  }
  async findOne(id: string) {
    return (await this.select(sql`c.id = ${id}::uuid`))[0] ?? this.missing();
  }
  async findBySlug(slug: string) {
    return (await this.select(sql`c.slug = ${slug}`))[0] ?? this.missing();
  }
  async update(id: string, input: UpdateCollectionDto) {
    const data = { ...input };
    if (input.name) {
      data.name = input.name.trim();
      await this.checkName(data.name, id);
    }
    if (input.slug || input.name)
      data.slug = await this.uniqueSlug(input.slug?.trim() || input.name!, id);
    if (input.groupId !== undefined)
      data.groupId = (input.groupId || null) as any;
    return (
      (await this.repository.patch(
        'collections',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        data,
      )) ?? this.missing()
    );
  }
  async toggleActive(id: string, isActive?: boolean) {
    const collection = await this.findOne(id);
    return (
      (await this.repository.patch(
        'collections',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        { isActive: isActive ?? !collection.isActive },
      )) ?? this.missing()
    );
  }
  async remove(id: string) {
    const collection = await this.findOne(id);
    const timestamp = Date.now();
    return (
      (await this.repository.patch(
        'collections',
        sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`,
        {
          isDeleted: true,
          name: `${collection.name}_deleted_${timestamp}`,
          slug: `${collection.slug}_deleted_${timestamp}`,
        },
      )) ?? this.missing()
    );
  }
  async restore(id: string) {
    return (
      (await this.repository.patch('collections', sql`id = ${id}::uuid`, {
        isDeleted: false,
      })) ?? this.missing()
    );
  }
  reorderCollections(items: { id: string; order: number }[]) {
    return this.repository.reorder('collections', items);
  }
  async assignGroup(collectionIds: string[], groupId: string | null) {
    if (collectionIds.length)
      await this.repository.patch(
        'collections',
        sql`id = ANY(${collectionIds}::uuid[])`,
        { groupId },
      );
  }
}
