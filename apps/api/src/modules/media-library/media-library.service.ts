import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MediaCategory,
  MediaItemKind,
  MediaLibraryDetail,
  MediaLibraryItem,
  MediaLibraryList,
  MediaReference,
} from '@repo/shared-types';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';
import { first, literal, rows, sql, type Sql } from '../../postgres/sql.js';
import { serviceRole } from '../../postgres/ownership.js';

type ItemRow = MediaLibraryItem & {
  full_audio_url?: string;
  thumbnail_url?: string;
  cover_url?: string;
  image?: string;
  audio?: Record<string, string>;
  image_url?: string;
  settings?: Record<string, unknown>;
};
const owners = {
  dictation: 'content',
  vocab: 'content',
  toeic: 'assessment',
  games: 'learning',
};

/** Only explicit media fields of the selected business resource are exposed. No bucket scan or payload fallback. */
export function mediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? url
      : null;
  } catch {
    return null;
  }
}
export function addMedia(
  assets: MediaReference[],
  value: unknown,
  type: 'image' | 'audio',
  sourceId: string,
  label: string,
  labelEn: string,
) {
  const url = mediaUrl(value);
  if (!url) return;
  let asset = assets.find((item) => item.url === url && item.type === type);
  if (!asset) {
    asset = { url, type, usages: [] };
    assets.push(asset);
  }
  if (
    !asset.usages.some(
      (usage) => usage.sourceId === sourceId && usage.label === label,
    )
  )
    asset.usages.push({ sourceId, label, labelEn });
}
@Injectable()
export class MediaLibraryService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  private definition(
    category: MediaCategory,
    requested?: string,
  ): { kind: MediaItemKind; source: Sql; available: Sql } {
    if (owners[category] !== serviceRole()) throw new ForbiddenException();
    const kind =
      requested ||
      (
        {
          dictation: 'lesson',
          vocab: 'lesson',
          toeic: 'exam',
          games: 'game',
        } as const
      )[category];
    if (category === 'dictation' && kind === 'lesson')
      return {
        kind,
        available: literal('r.is_deleted IS NOT TRUE'),
        source:
          literal(`SELECT r.id,r.title,concat_ws(' / ',t.title,s.title) AS subtitle,r.publication_status AS status,
      r.full_audio_url,r.thumbnail_url FROM dictationlessons r LEFT JOIN dictationtopics t ON t.id=r.topic_id LEFT JOIN dictationsections s ON s.id=r.section_id`),
      };
    if (category === 'vocab' && kind === 'lesson')
      return {
        kind,
        available: literal('r.is_deleted IS NOT TRUE'),
        source:
          literal(`SELECT r.id,r.title,COALESCE(c.name,'') AS subtitle,r.publication_status AS status,r.cover_url
      FROM lessons r LEFT JOIN collections c ON c.id=r.collection_id`),
      };
    if (category === 'vocab' && kind === 'collection')
      return {
        kind,
        available: literal('r.is_deleted IS NOT TRUE'),
        source:
          literal(`SELECT r.id,r.name AS title,COALESCE(g.name,'') AS subtitle,CASE WHEN r.is_active IS FALSE THEN 'INACTIVE' ELSE 'ACTIVE' END AS status,r.cover_url
      FROM collections r LEFT JOIN vocabularygroups g ON g.id=r.group_id`),
      };
    if (category === 'vocab' && kind === 'word')
      return {
        kind,
        available: literal('r.is_deleted IS NOT TRUE'),
        source: literal(
          `SELECT r.id,r.word AS title,COALESCE(r.level,'') AS subtitle,r.publication_status AS status,r.image,r.audio FROM words r`,
        ),
      };
    if (category === 'toeic' && kind === 'exam')
      return {
        kind,
        available: literal("r.is_deleted IS NOT TRUE AND r.type='TOEIC'"),
        source: literal(
          `SELECT r.id,r.name AS title,COALESCE(g.name,'') AS subtitle,r.publication_status AS status FROM exams r LEFT JOIN examgroups g ON g.id=r.group_id`,
        ),
      };
    if (category === 'games' && kind === 'game')
      return {
        kind,
        available: literal('TRUE'),
        source: literal(
          `SELECT r.id,r.name AS title,r.code AS subtitle,CASE WHEN r.is_active IS FALSE THEN 'INACTIVE' ELSE 'ACTIVE' END AS status,r.image_url,r.settings FROM gamedefinitions r`,
        ),
      };
    throw new BadRequestException('Unsupported media resource');
  }
  private item(row: ItemRow, kind: MediaItemKind): MediaLibraryItem {
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      status: row.status,
      kind,
    };
  }
  async list(
    category: MediaCategory,
    query: { kind?: string; search?: string; page: number; pageSize: number },
  ): Promise<MediaLibraryList> {
    const { source, available, kind } = this.definition(category, query.kind);
    const search = query.search?.trim() || '';
    // Filter/search/count happen in PostgreSQL; only a bounded page leaves the owner.
    const base = sql`WITH resources AS (${source} WHERE ${available})`;
    const filter = sql`position(lower(${search}) in lower(title || ' ' || subtitle)) > 0`;
    const [items, count] = await Promise.all([
      rows<ItemRow>(
        this.db,
        sql`${base} SELECT id,title,subtitle,status FROM resources WHERE ${filter} ORDER BY lower(title),id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      ),
      first<{ total: number }>(
        this.db,
        sql`${base} SELECT count(*)::int AS total FROM resources WHERE ${filter}`,
      ),
    ]);
    return {
      items: items.map((row) => this.item(row, kind)),
      total: count?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async detail(
    category: MediaCategory,
    id: string,
    requested?: string,
  ): Promise<MediaLibraryDetail> {
    const { source, available, kind } = this.definition(category, requested);
    const row = await first<ItemRow>(
      this.db,
      sql`${source} WHERE ${available} AND r.id=${id}::uuid`,
    );
    if (!row) throw new NotFoundException('Media resource not found');
    const assets: MediaReference[] = [];
    const add = (
      url: unknown,
      type: 'image' | 'audio',
      sourceId: string,
      vi: string,
      en: string,
    ) => addMedia(assets, url, type, sourceId, vi, en);
    if (category === 'dictation') {
      add(row.thumbnail_url, 'image', id, 'Ảnh bài nghe', 'Lesson image');
      add(
        row.full_audio_url,
        'audio',
        id,
        'Audio toàn bài',
        'Full lesson audio',
      );
      const segments = await rows<{
        id: string;
        order: number;
        audio_url: string;
      }>(
        this.db,
        sql`SELECT id,"order",audio_url FROM dictationsegments WHERE lesson_id=${id}::uuid AND NULLIF(btrim(audio_url),'') IS NOT NULL ORDER BY "order",id`,
      );
      for (const segment of segments)
        add(
          segment.audio_url,
          'audio',
          segment.id,
          `Câu ${segment.order + 1}`,
          `Segment ${segment.order + 1}`,
        );
    } else if (category === 'vocab') {
      add(row.cover_url, 'image', id, 'Ảnh bìa', 'Cover image');
      if (kind === 'word')
        this.wordMedia(assets, {
          id,
          word: row.title,
          image: row.image,
          audio: row.audio,
        });
      else {
        const lessonScope =
          kind === 'lesson'
            ? sql`l.id=${id}::uuid`
            : sql`l.collection_id=${id}::uuid`;
        if (kind === 'collection') {
          const lessons = await rows<{
            id: string;
            title: string;
            cover_url: string;
          }>(
            this.db,
            sql`SELECT id,title,cover_url FROM lessons WHERE collection_id=${id}::uuid AND is_deleted IS NOT TRUE ORDER BY "order",id`,
          );
          for (const lesson of lessons)
            add(
              lesson.cover_url,
              'image',
              lesson.id,
              `Bài học: ${lesson.title}`,
              `Lesson: ${lesson.title}`,
            );
        }
        const words = await rows<any>(
          this.db,
          sql`SELECT w.id,w.word,w.image,w.audio,l.title AS lesson_title,l.id AS lesson_id FROM lessonwords lw
          JOIN lessons l ON l.id=lw.lesson_id JOIN words w ON w.id=lw.word_id
          WHERE ${lessonScope} AND l.is_deleted IS NOT TRUE AND w.is_deleted IS NOT TRUE ORDER BY l."order",lw."order",w.id`,
        );
        for (const word of words)
          this.wordMedia(
            assets,
            word,
            kind === 'collection' ? word.lesson_title : undefined,
          );
      }
    } else if (category === 'toeic') {
      const questions = await rows<any>(
        this.db,
        sql`SELECT id,part,"order",audio_url,image_url FROM questions WHERE exam_id=${id}::uuid ORDER BY part,"order",id`,
      );
      for (const q of questions) {
        const vi = `Part ${q.part} · Câu ${q.order}`,
          en = `Part ${q.part} · Question ${q.order}`;
        add(q.image_url, 'image', q.id, vi, en);
        add(q.audio_url, 'audio', q.id, vi, en);
      }
      const passages = await rows<any>(
        this.db,
        sql`SELECT p.id,p."order",g.part,g.title,p.audio_url,p.image_url FROM passages p JOIN passagegroups g ON g.id=p.passage_group_id WHERE g.exam_id=${id}::uuid ORDER BY g.part,g."order",p."order",p.id`,
      );
      for (const p of passages) {
        const vi = `Part ${p.part} · ${p.title || 'Đoạn'} · ${p.order}`,
          en = `Part ${p.part} · ${p.title || 'Passage'} · ${p.order}`;
        add(p.image_url, 'image', p.id, vi, en);
        add(p.audio_url, 'audio', p.id, vi, en);
      }
    } else {
      add(row.image_url, 'image', id, 'Ảnh trò chơi', 'Game image');
      for (const [key, vi, en] of [
        ['backgroundMusicUrl', 'Nhạc nền', 'Background music'],
        ['correctSoundUrl', 'Trả lời đúng', 'Correct answer'],
        ['wrongSoundUrl', 'Trả lời sai', 'Wrong answer'],
        ['loseSoundUrl', 'Kết thúc trò chơi', 'Game over'],
      ]) {
        add(row.settings?.[key], 'audio', id, vi, en);
      }
    }
    const normalized: MediaReference[] = [];
    for (const asset of assets) {
      let url = asset.url;
      if (url.startsWith('/')) {
        const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
        if (url.startsWith('/media/')) {
          const base = (
            process.env.MEDIA_PUBLIC_BASE_URL || 'http://localhost:5000/media'
          ).replace(/\/$/, '');
          url = new URL(base + url.slice('/media'.length), frontend).href;
        } else url = new URL(url, frontend).href;
      }
      for (const usage of asset.usages)
        addMedia(
          normalized,
          url,
          asset.type,
          usage.sourceId,
          usage.label,
          usage.labelEn,
        );
    }
    return { item: this.item(row, kind), assets: normalized };
  }
  private wordMedia(
    assets: MediaReference[],
    word: {
      id: string;
      word: string;
      image?: string;
      audio?: Record<string, string>;
    },
    lesson?: string,
  ) {
    const prefix = lesson ? `${lesson} / ${word.word}` : word.word;
    addMedia(
      assets,
      word.image,
      'image',
      word.id,
      `${prefix} · Ảnh`,
      `${prefix} · Image`,
    );
    addMedia(
      assets,
      word.audio?.us,
      'audio',
      word.id,
      `${prefix} · Phát âm US`,
      `${prefix} · US pronunciation`,
    );
    addMedia(
      assets,
      word.audio?.uk,
      'audio',
      word.id,
      `${prefix} · Phát âm UK`,
      `${prefix} · UK pronunciation`,
    );
  }
}
