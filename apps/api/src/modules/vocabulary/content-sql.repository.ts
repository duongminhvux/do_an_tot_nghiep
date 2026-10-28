import { Injectable } from '@nestjs/common';
import {
  InjectPgConnection,
  withPgTransaction,
  type PgConnection,
} from '../../postgres/connection.js';
import {
  first,
  identifier,
  literal,
  rowData,
  rows,
  sql,
  SqlTable,
  type Sql,
} from '../../postgres/sql.js';
import { publicationScope } from '../publication/publication-scope.js';

const common = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  order: 'order',
  isActive: 'is_active',
  isDeleted: 'is_deleted',
};
const fields = {
  vocabularygroups: common,
  collections: { ...common, groupId: 'group_id', coverUrl: 'cover_url' },
  lessons: {
    collectionId: 'collection_id',
    title: 'title',
    slug: 'slug',
    description: 'description',
    coverUrl: 'cover_url',
    order: 'order',
    isActive: 'is_active',
    isDeleted: 'is_deleted',
  },
  sections: {
    lessonId: 'lesson_id',
    name: 'name',
    slug: 'slug',
    order: 'order',
  },
  lessonwords: {
    lessonId: 'lesson_id',
    wordId: 'word_id',
    sectionId: 'section_id',
    order: 'order',
    customNote: 'custom_note',
  },
  words: {
    word: 'word',
    slug: 'slug',
    level: 'level',
    ipa: 'ipa',
    audio: 'audio',
    audioMeta: 'audio_meta',
    image: 'image',
    variations: 'variations',
    relatedWords: 'related_words',
    parts: 'parts',
    isActive: 'is_active',
    isDeleted: 'is_deleted',
  },
} as const;
export type ContentTable = keyof typeof fields;

export function contentRow(row: Record<string, any>) {
  return rowData<Record<string, any>>(row);
}

@Injectable()
export class ContentSqlRepository {
  constructor(@InjectPgConnection() readonly connection: PgConnection) {}

  /** Learner reads always honor the same publication gate as owner read APIs. */
  gate(table: ContentTable): Sql {
    return publicationScope.getStore() === true &&
      (table === 'words' || table === 'lessons')
      ? literal(
          "publication_status = 'PUBLISHED' AND is_deleted IS NOT TRUE AND is_active IS NOT FALSE",
        )
      : literal('TRUE');
  }
  async list(
    table: ContentTable,
    where: Sql,
    tail: Sql = literal(''),
  ): Promise<any[]> {
    return (
      await rows(
        this.connection,
        sql`SELECT * FROM public.${identifier(table)} WHERE (${where}) AND ${this.gate(table)} ${tail}`,
      )
    ).map(contentRow);
  }
  async one(table: ContentTable, where: Sql): Promise<any | null> {
    return (await this.list(table, where, literal('LIMIT 1')))[0] ?? null;
  }
  async count(table: ContentTable, where: Sql): Promise<number> {
    return Number(
      (await first(
        this.connection,
        sql`SELECT COUNT(*)::integer AS count FROM public.${identifier(table)}
      WHERE (${where}) AND ${this.gate(table)}`,
      ))!.count,
    );
  }
  private writer(table: ContentTable) {
    return new SqlTable(
      this.connection,
      table,
      fields[table],
      table === 'words'
        ? ['ipa', 'audio', 'audioMeta', 'variations', 'relatedWords', 'parts']
        : [],
    );
  }
  async insert(table: ContentTable, values: Record<string, any>) {
    return this.writer(table).insert(values);
  }
  async patch(
    table: ContentTable,
    where: Sql,
    values: Record<string, any>,
    expressions: Readonly<Record<string, Sql>> = {},
  ) {
    const data = await this.writer(table).patch(where, values, expressions);
    return data;
  }
  async reorder(
    table: ContentTable,
    items: { id: string; order: number }[],
    parent: Sql = literal('TRUE'),
  ) {
    if (!items.length) return;
    // Last occurrence wins for duplicate ids, as in the previous sequential writes.
    const unique = [...new Map(items.map((item) => [item.id, item])).values()];
    await rows(
      this.connection,
      sql`UPDATE public.${identifier(table)} AS target SET "order" = changes."order",
      payload = target.payload - 'order'
      FROM jsonb_to_recordset(${JSON.stringify(unique)}::jsonb) AS changes(id uuid, "order" double precision)
      WHERE target.id = changes.id AND (${parent})`,
    );
  }
  transaction<T>(
    work: (repository: ContentSqlRepository) => Promise<T>,
  ): Promise<T> {
    return withPgTransaction(this.connection, (transaction) =>
      work(new ContentSqlRepository(transaction)),
    );
  }
}
