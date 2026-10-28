import {
BadRequestException,
Injectable,
NotFoundException
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { serviceUrl } from '../../../postgres/ownership.js';
import { rows,sql } from '../../../postgres/sql.js';
import { contentBatches,contentRows } from '../../vocabulary/content-reader.js';
import type { MiniGameSourceDto } from '../dto/start-typing-rush.dto.js';
import {
TYPING_RUSH_DEFAULT_SETTINGS,
type TypingRushSettings
} from '../game-registry.js';
import {
MiniGameSourceType,
type GameWord,
type VocabularySource
} from '../minigame.types.js';
export function uniqueGameWords(words: GameWord[]): GameWord[] {
  const seenIds = new Set<string>(),
    seenText = new Set<string>();
  return words.flatMap((item) => {
    const word = item.word.trim().toLowerCase();
    // Support short English words and phrases, including apostrophes and hyphens.
    if (
      !/^[a-z]+(?:[ '-][a-z]+)*$/.test(word) ||
      word.length > 48 ||
      seenIds.has(item.id) ||
      seenText.has(word)
    )
      return [];
    seenIds.add(item.id);
    seenText.add(word);
    return [{ id: item.id, word, meaning: item.meaning ?? "" }];
  });
}
@Injectable()
export class MiniGameWordSourceService {
  constructor(
    @InjectPgConnection() private readonly database: PgConnection,
  ) {}
  private async groups(
    userId: string,
    systemIds: string[],
    userIds: string[],
  ) {
    const lessons=await contentBatches(this.database,'lessons',{collectionIds:systemIds,publishedOnly:true,activeOnly:true},'collectionIds');
    const [links,saved]=await Promise.all([
      contentBatches(this.database,'lessonwords',{lessonIds:lessons.map(l=>l._id)},'lessonIds'),
      rows(this.database,sql`SELECT folder_id AS "folderId",word_id AS "wordId" FROM public.usersavedwords WHERE user_id=${userId}::uuid AND folder_id=ANY(${userIds}::uuid[])`),
    ]);
    const ids=[...new Set([...links,...saved].map(item=>String(item.wordId)))];
    const words=await contentBatches(this.database,'words',{ids,publishedOnly:true,activeOnly:true});
    const byId = new Map(
      words.map((w) => {
        const meanings = (w.parts ?? []).flatMap(
          (part:any) => part.meanings ?? [],
        );
        const firstVietnameseMeaning = meanings
          .flatMap((meaning:any) => meaning.translation ?? [])
          .map((value:string) => value.trim())
          .find(Boolean);
        const firstDefinition = meanings
          .map((meaning:any) => meaning.definition?.trim())
          .find((value:any): value is string => Boolean(value));
        const meaning = (firstVietnameseMeaning || firstDefinition || '')
          .split(/[;,]/, 1)[0]
          ?.trim();
        return [
          String(w._id),
          { id: String(w._id), word: w.word, meaning },
        ];
      }),
    );
    const collectionByLesson = new Map(
      lessons.map((l) => [String(l._id), String(l.collectionId)]),
    );
    const groups = new Map<string, GameWord[]>();
    const add = (key: string, wordId: string) => {
      const word = byId.get(wordId);
      if (word) {
        const group = groups.get(key);
        if (group) group.push(word);
        else groups.set(key, [word]);
      }
    };
    for (const link of links)
      add(
        'SYSTEM:' + collectionByLesson.get(String(link.lessonId)),
        String(link.wordId),
      );
    for (const item of saved)
      add('USER:' + String(item.folderId), String(item.wordId));
    return groups;
  }
  async list(userId: string) {
    // Run Content's aggregation in its own database. This endpoint must not load
    // whole Content tables into Learning's memory just to compute collection counts.
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token || token.length < 24) throw new Error('Internal read authentication not configured');
    const response = await fetch(`${serviceUrl('content')}/api/_internal/minigame-source-summary`, {
      headers: { 'x-internal-token': token },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Content source summary unavailable (${response.status})`);
    const payload = await response.json() as any;
    const summaries = (payload?.data ?? payload) as Array<{
      id: string; name: string; coverUrl?: string; wordCount: number;
    }>;
    if (!Array.isArray(summaries)) throw new Error('Invalid Content source summary');
    const { rows: personal } = await this.database.query(`
      SELECT f.id, f.name, COUNT(DISTINCT sw.word_id)::integer AS "wordCount"
      FROM public.vocabularyfolders f
      LEFT JOIN public.usersavedwords sw ON sw.folder_id = f.id AND sw.user_id = $1
      WHERE f.user_id = $1
      GROUP BY f.id, f.name
      ORDER BY f.name
      LIMIT 500
    `, [userId]);
    return {
      systemCollections: summaries.map(c => ({
        id: String(c.id), name: c.name, thumbnail: c.coverUrl,
        wordCount: Number(c.wordCount), type: MiniGameSourceType.SYSTEM,
      } satisfies VocabularySource)),
      userCollections: personal.map(c => ({
        id: String(c.id), name: c.name,
        wordCount: Number(c.wordCount), type: MiniGameSourceType.USER,
      } satisfies VocabularySource)),
    };
  }
  async pool(
    userId: string,
    sources: MiniGameSourceDto[],
    settings: Pick<TypingRushSettings, 'minWordCount'> = TYPING_RUSH_DEFAULT_SETTINGS,
  ) {
    if (
      !sources.length ||
      sources.length > 50 ||
      sources.some(
        (s) =>
          !isUuid(s.id) ||
          !Object.values(MiniGameSourceType).includes(s.type),
      )
    )
      throw new BadRequestException('MINIGAME_INVALID_SOURCE');
    const systemIds = [
      ...new Set(
        sources
          .filter((s) => s.type === 'SYSTEM')
          .map((s) => s.id.toLowerCase()),
      ),
    ];
    const userIds = [
      ...new Set(
        sources.filter((s) => s.type === 'USER').map((s) => s.id.toLowerCase()),
      ),
    ];
    const [system,personal]=await Promise.all([
      contentRows(this.database,'collections',{ids:systemIds,activeOnly:true,limit:50}),
      rows(this.database,sql`SELECT id AS "_id" FROM public.vocabularyfolders WHERE id=ANY(${userIds}::uuid[]) AND user_id=${userId}::uuid`),
    ]);
    if (
      system.length !== systemIds.length ||
      personal.length !== userIds.length
    )
      throw new NotFoundException('MINIGAME_SOURCE_UNAVAILABLE');
    const groups = await this.groups(userId, systemIds, userIds);
    const words = uniqueGameWords([...groups.values()].flat());
    if (words.length < settings.minWordCount)
      throw new BadRequestException('TYPING_RUSH_MIN_WORDS');
    for (let i = words.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [words[i], words[j]] = [words[j]!, words[i]!];
    }
    return words;
  }
}
