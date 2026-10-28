import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { serviceRole } from '../../postgres/ownership.js';
import { identifier,joinSql,literal,rowData,rows,sql,type Sql } from '../../postgres/sql.js';

export type ContentKind = 'words' | 'lessons' | 'lessonwords' | 'sections' | 'collections';
export type ContentRead = {
  ids?: string[]; lessonIds?: string[]; collectionIds?: string[]; wordIds?: string[]; sectionIds?: string[];
  search?: string; word?:string; level?: string; publishedOnly?: boolean; activeOnly?: boolean; includeDeleted?: boolean;
  slug?: string; orderBy?: 'word' | 'createdAt' | 'order'; descending?: boolean; limit?: number; offset?: number;
};
const tables: Record<ContentKind, readonly string[]> = {
  words: ['id'], lessons: ['id', 'collection_id'], lessonwords: ['id', 'lesson_id', 'word_id', 'section_id'],
  sections: ['id', 'lesson_id'], collections: ['id'],
};
export async function readContentRows(db: PgConnection, kind: ContentKind, input: ContentRead) {
  if (!Object.hasOwn(tables, kind) || !input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid content projection');
  const conditions: Sql[] = [literal('TRUE')];
  for (const [key, column] of [['ids', 'id'], ['lessonIds', 'lesson_id'], ['collectionIds', 'collection_id'], ['wordIds', 'word_id'], ['sectionIds', 'section_id']] as const) {
    const value = input[key];
    if (value !== undefined) {
      if (!tables[kind].includes(column) || !Array.isArray(value) || value.length > 2000 || value.some(id => !isUuid(id))) throw new BadRequestException('Invalid projection IDs');
      conditions.push(sql`${identifier(column)}=ANY(${value}::uuid[])`);
    }
  }
  if (['words', 'lessons', 'collections'].includes(kind)) {
    if (!input.includeDeleted) conditions.push(literal('is_deleted IS NOT TRUE'));
    if (input.activeOnly) conditions.push(literal('is_active IS NOT FALSE'));
  }
  if (input.publishedOnly && ['words', 'lessons'].includes(kind)) conditions.push(literal("publication_status='PUBLISHED' AND is_deleted IS NOT TRUE AND is_active IS NOT FALSE"));
  if (input.slug !== undefined) {
    if (!['words', 'lessons', 'collections', 'sections'].includes(kind) || typeof input.slug !== 'string' || input.slug.length > 200) throw new BadRequestException('Invalid slug');
    conditions.push(sql`slug=${input.slug}`);
  }
  if (input.level !== undefined) {
    if (kind !== 'words' || typeof input.level !== 'string' || input.level.length > 20) throw new BadRequestException('Invalid level');
    conditions.push(sql`level=${input.level}`);
  }
  if(input.word!==undefined){if(kind!=='words'||typeof input.word!=='string'||input.word.length>200)throw new BadRequestException('Invalid word');conditions.push(sql`LOWER(word)=LOWER(${input.word})`);}
  if (input.search) {
    if (kind !== 'words' || typeof input.search !== 'string' || input.search.length > 100) throw new BadRequestException('Invalid search');
    conditions.push(sql`(word ILIKE '%'||${input.search}||'%' OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(COALESCE(parts,'[]'::jsonb)) part
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(part->'meanings','[]'::jsonb)) meaning
      WHERE meaning->>'definition' ILIKE '%'||${input.search}||'%' OR (meaning->'translation')::text ILIKE '%'||${input.search}||'%'))`);
  }
  const limit = input.limit ?? 500, offset = input.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2000 || !Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException('Invalid content page');
  const order = input.orderBy === 'word' && kind === 'words' ? identifier('word')
    : input.orderBy === 'order' && ['lessons', 'lessonwords', 'sections', 'collections'].includes(kind) ? identifier('order') : identifier('created_at');
  return (await rows(db, sql`SELECT * FROM public.${identifier(kind)} WHERE ${joinSql(conditions, ' AND ')}
    ORDER BY ${order} ${literal(input.descending ? 'DESC' : 'ASC')} NULLS LAST,id LIMIT ${limit} OFFSET ${offset}`)).map(row => rowData<any>(row));
}
export function contentRows(db: PgConnection, kind: ContentKind, input: ContentRead) {
  return serviceRole() === 'content' ? readContentRows(db, kind, input) : ownerRequest<any[]>('content', `content/${kind}`, input);
}
export async function allContentRows(db: PgConnection, kind: ContentKind, input: ContentRead) {
  const result: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await contentRows(db, kind, { ...input, limit: 500, offset }); result.push(...page);
    if (page.length < 500) return result;
  }
}
export async function contentBatches(db: PgConnection, kind: ContentKind, input: ContentRead, key: 'ids' | 'lessonIds' | 'collectionIds' | 'wordIds' | 'sectionIds' = 'ids') {
  const ids = input[key];
  if (!ids) return allContentRows(db, kind, input);
  const result: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 2000) result.push(...await allContentRows(db, kind, { ...input, [key]: ids.slice(offset, offset + 2000) }));
  return result;
}
export type WordSample = {count:number;requireMeaning?:boolean;fiveLettersOnly?:boolean};
export async function readWordSample(db:PgConnection,input:WordSample){
  if(!input||!Number.isInteger(input.count)||input.count<1||input.count>100)throw new BadRequestException('Invalid word sample');
  return rows(db,sql`SELECT w.id AS "_id",w.word,w.image,meaning.value AS meaning,meaning.definition,meaning.example,meaning.part_of_speech AS "partOfSpeech"
    FROM public.words w LEFT JOIN LATERAL (
      SELECT translation.value,definition->>'definition' AS definition,definition->'examples'->0 AS example,part->>'partOfSpeech' AS part_of_speech
      FROM jsonb_array_elements(COALESCE(w.parts,'[]'::jsonb)) WITH ORDINALITY p(part,part_order)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(part->'meanings','[]'::jsonb)) WITH ORDINALITY m(definition,meaning_order)
      CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(definition->'translation')='array' THEN definition->'translation' ELSE '[]'::jsonb END)
        WITH ORDINALITY translation(value,translation_order)
      WHERE BTRIM(translation.value)<>'' ORDER BY part_order,meaning_order,translation_order LIMIT 1
    ) meaning ON true WHERE w.publication_status='PUBLISHED' AND w.is_active IS TRUE AND w.is_deleted IS NOT TRUE AND BTRIM(w.word)<>''
      AND (NOT ${!!input.requireMeaning}::boolean OR meaning.value IS NOT NULL) AND (NOT ${!!input.fiveLettersOnly}::boolean OR w.word ~ '^[a-zA-Z]{5}$')
    ORDER BY random() LIMIT ${input.count}`);
}
export function sampleContentWords(db:PgConnection,input:WordSample){
  return serviceRole()==='content'?readWordSample(db,input):ownerRequest<any[]>('content','content/sample-words',input);
}
