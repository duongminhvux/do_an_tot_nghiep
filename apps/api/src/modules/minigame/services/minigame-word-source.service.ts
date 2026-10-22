import {
  TYPING_RUSH_DEFAULT_SETTINGS,
  type TypingRushSettings,
} from '../game-registry.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { randomInt } from 'node:crypto';
import { Collection } from '../../vocabulary/collections/collection.schema.js';
import { Lesson } from '../../vocabulary/lessons/lesson.schema.js';
import { LessonWord } from '../../vocabulary/lessons/lesson-word.schema.js';
import { Word } from '../../vocabulary/words/word.schema.js';
import { VocabularyFolder } from '../../learning/saved-words/schema/vocabulary-folder.schema.js';
import { UserSavedWord } from '../../learning/saved-words/schema/saved-word.schema.js';
import {
  MiniGameSourceType,
  type GameWord,
  type VocabularySource,
} from '../minigame.types.js';
import type { MiniGameSourceDto } from '../dto/start-typing-rush.dto.js';
const available = { isActive: true, isDeleted: { $ne: true } };
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
    @InjectModel(Collection.name)
    private readonly collections: Model<Collection>,
    @InjectModel(Lesson.name) private readonly lessons: Model<Lesson>,
    @InjectModel(LessonWord.name) private readonly links: Model<LessonWord>,
    @InjectModel(Word.name) private readonly words: Model<Word>,
    @InjectModel(VocabularyFolder.name)
    private readonly folders: Model<VocabularyFolder>,
    @InjectModel(UserSavedWord.name)
    private readonly saved: Model<UserSavedWord>,
  ) {}
  private async groups(
    userId: string,
    systemIds: Types.ObjectId[],
    userIds: Types.ObjectId[],
  ) {
    const lessons = systemIds.length
      ? await this.lessons
          .find({ ...available, collectionId: { $in: systemIds } })
          .select('_id collectionId')
          .lean()
      : [];
    const [links, saved] = await Promise.all([
      lessons.length
        ? this.links
            .find({ lessonId: { $in: lessons.map((l) => l._id) } })
            .select('lessonId wordId')
            .lean()
        : [],
      userIds.length
        ? this.saved
            .find({
              userId: new Types.ObjectId(userId),
              folderId: { $in: userIds },
            })
            .select('folderId wordId')
            .lean()
        : [],
    ]);
    const ids = [
      ...new Set([...links, ...saved].map((item) => String(item.wordId))),
    ];
    const words = ids.length
      ? await this.words
          .find({
            ...available,
            _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
          })
          .select('_id word parts')
          .lean()
      : [];
    const byId = new Map(
      words.map((w) => {
        const meanings = (w.parts ?? []).flatMap(
          (part) => part.meanings ?? [],
        );
        const firstVietnameseMeaning = meanings
          .flatMap((meaning) => meaning.translation ?? [])
          .map((value) => value.trim())
          .find(Boolean);
        const firstDefinition = meanings
          .map((meaning) => meaning.definition?.trim())
          .find((value): value is string => Boolean(value));
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
    const [system, personal] = await Promise.all([
      this.collections
        .find(available)
        .select('_id name coverUrl')
        .sort({ order: 1, name: 1 })
        .lean(),
      this.folders
        .find({ userId: new Types.ObjectId(userId) })
        .select('_id name')
        .sort({ name: 1 })
        .lean(),
    ]);
    const groups = await this.groups(
      userId,
      system.map((c) => c._id),
      personal.map((c) => c._id),
    );
    const count = (type: string, id: unknown) =>
      uniqueGameWords(groups.get(type + ':' + String(id)) || []).length;
    return {
      systemCollections: system.map(
        (c) =>
          ({
            id: String(c._id),
            name: c.name,
            thumbnail: c.coverUrl,
            wordCount: count('SYSTEM', c._id),
            type: MiniGameSourceType.SYSTEM,
          }) satisfies VocabularySource,
      ),
      userCollections: personal.map(
        (c) =>
          ({
            id: String(c._id),
            name: c.name,
            wordCount: count('USER', c._id),
            type: MiniGameSourceType.USER,
          }) satisfies VocabularySource,
      ),
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
          !Types.ObjectId.isValid(s.id) ||
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
    ].map((id) => new Types.ObjectId(id));
    const userIds = [
      ...new Set(
        sources.filter((s) => s.type === 'USER').map((s) => s.id.toLowerCase()),
      ),
    ].map((id) => new Types.ObjectId(id));
    const [system, personal] = await Promise.all([
      this.collections
        .find({ ...available, _id: { $in: systemIds } })
        .select('_id')
        .lean(),
      this.folders
        .find({ _id: { $in: userIds }, userId: new Types.ObjectId(userId) })
        .select('_id')
        .lean(),
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
