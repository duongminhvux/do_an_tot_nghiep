import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivityLogsService } from './activity-logs.service.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { LEARNING_ACTIVITY_TYPES } from '../learning-activity/schemas/learning-activity.schema.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const dictionaries = Object.fromEntries(
  ['vi', 'en'].map((lang) => [
    lang,
    JSON.parse(
      readFileSync(
        new URL(`../../i18n/${lang}/activity-log.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const i18n = {
  translate: (key: string, { lang = 'vi', args = {} }: any = {}) => {
    const template = key
      .replace(/^activity-log\./, '')
      .split('.')
      .reduce((node: any, part: string) => node?.[part], dictionaries[lang]);
    return typeof template === 'string'
      ? template.replace(/\{(\w+)\}/g, (_match, name) =>
          String(args[name] ?? ''),
        )
      : key;
  },
};
const at = (row: any, key: string) =>
  key.split('.').reduce((node, part) => node?.[part], row);
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, expected]: [string, any]) => {
    if (key === '$and')
      return expected.every((part: any) => matches(row, part));
    if (key === '$or') return expected.some((part: any) => matches(row, part));
    const actual = at(row, key);
    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof Date) &&
      !(expected instanceof String)
    ) {
      if ('$exists' in expected)
        return (actual !== undefined) === expected.$exists;
      if ('$regex' in expected)
        return new RegExp(expected.$regex, expected.$options).test(
          String(actual ?? ''),
        );
      if ('$in' in expected)
        return expected.$in.some(
          (value: any) => String(actual) === String(value),
        );
      if ('$gte' in expected && !(new Date(actual) >= expected.$gte))
        return false;
      if ('$lte' in expected && !(new Date(actual) <= expected.$lte))
        return false;
      return true;
    }
    return expected == null
      ? actual == null
      : String(actual) === String(expected);
  });
}
function model(rows: any[]) {
  const find = vi.fn((filter: any) => {
    let selected = rows.filter((row) => matches(row, filter));
    const query: any = {
      sort(order: any) {
        selected.sort((a, b) => {
          for (const [key, direction] of Object.entries(order)) {
            if (at(a, key) > at(b, key)) return Number(direction);
            if (at(a, key) < at(b, key)) return -Number(direction);
          }
          return 0;
        });
        return query;
      },
      skip(value: number) {
        selected = selected.slice(value);
        return query;
      },
      limit(value: number) {
        selected = selected.slice(0, value);
        return query;
      },
      lean: async () => selected,
    };
    return query;
  });
  return {
    find,
    countDocuments: vi.fn(
      async (filter: any) => rows.filter((row) => matches(row, filter)).length,
    ),
    distinct: vi.fn(async (key: string) => [
      ...new Set(rows.map((row) => row[key])),
    ]),
    create: vi.fn(async (row) => row),
  };
}
function fixture() {
  const auditRows: any[] = [
    {
      _id: 'audit-a',
      userId,
      userEmail: 'learner@example.com',
      action: 'AUTH_LOGIN',
      category: 'AUTH',
      status: 'SUCCESS',
      description: 'Legacy login text',
      createdAt: new Date('2026-10-24T01:00:00Z'),
    },
    {
      _id: 'audit-email',
      userEmail: 'LEARNER@example.com',
      action: 'SESSION_START',
      category: 'SESSION',
      status: 'SUCCESS',
      description: 'User started a new browsing session',
      createdAt: new Date('2026-10-24T02:00:00Z'),
    },
    {
      _id: 'other-user',
      userId: otherId,
      userEmail: 'learner@example.com',
      action: 'AUTH_LOGIN',
      category: 'AUTH',
      status: 'SUCCESS',
      description: 'must not leak',
      createdAt: new Date('2026-10-24T05:00:00Z'),
    },
  ];
  const learningRows: any[] = LEARNING_ACTIVITY_TYPES.map((type, index) => ({
    _id: `learning-${index}`,
    userId,
    type,
    module:
      type.startsWith('WORD_') || type === 'VOCAB_SESSION'
        ? 'VOCABULARY'
        : type === 'TOEIC_ATTEMPT'
          ? 'TOEIC'
          : type === 'DICTATION_LESSON'
            ? 'DICTATION'
            : type === 'ARENA_MATCH'
              ? 'ARENA'
              : 'MINIGAME',
    xp: 5,
    score: 0,
    occurredAt: new Date(Date.UTC(2026, 9, 24, 3, index)),
    metadata: type === 'MINIGAME_PLAY' ? { gameType: 'TYPING_RUSH' } : {},
  }));
  learningRows.push({
    ...learningRows[0],
    _id: 'other-learning',
    userId: otherId,
  });
  const audit = model(auditRows),
    learning = model(learningRows);
  const users = {
    findById: vi.fn(() => ({
      select: () => ({
        lean: async () => ({ _id: userId, email: 'learner@example.com' }),
      }),
    })),
  };
  const service = new ActivityLogsService(
    audit as never,
    users as never,
    i18n as never,
    learning as never,
  );
  const query = (extra: Partial<QueryActivityLogsDto> = {}) =>
    service.findAll({
      page: 1,
      limit: 100,
      includeLearning: 'true',
      userId,
      ...extra,
    });
  return { service, query, auditRows, learningRows, audit, learning };
}

describe('admin user activity history', () => {
  it('includes every learning type and legacy email-only interactions while isolating users', async () => {
    const f = fixture();
    const result = await f.query();
    expect(result.total).toBe(9);
    expect(result.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        ...LEARNING_ACTIVITY_TYPES,
        'AUTH_LOGIN',
        'SESSION_START',
      ]),
    );
    expect(
      result.items.some((item) => String(item._id).includes('other')),
    ).toBe(false);
    expect(result.items[0]?.action).toBe('MINIGAME_PLAY');
    expect(result.items[0]?.metadata?.score).toBe(0);
  });
  it('paginates the combined history beyond the old source cutoffs', async () => {
    const f = fixture();
    for (let i = 0; i < 40; i++)
      f.learningRows.push({
        ...f.learningRows[0],
        _id: `extra-${i}`,
        occurredAt: new Date(Date.UTC(2026, 9, 24, 6, i)),
      });
    const pages = await Promise.all(
      [1, 2, 3, 4, 5].map((page) => f.query({ page, limit: 10 })),
    );
    const ids = pages.flatMap((page) => page.items.map((row) => row._id));
    expect(pages[0]?.total).toBe(49);
    expect(pages[0]?.totalPages).toBe(5);
    expect(ids).toHaveLength(49);
    expect(new Set(ids).size).toBe(49);
    const times = pages.flatMap((page) =>
      page.items.map((row) => new Date(row.createdAt!).getTime()),
    );
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
  it('filters category, action, status and translated searches before pagination', async () => {
    const f = fixture();
    expect(
      (await f.query({ category: 'ARENA' })).items.map((row) => row.action),
    ).toEqual(['ARENA_MATCH']);
    expect(
      (await f.query({ category: 'ASSESSMENT' })).items.map(
        (row) => row.action,
      ),
    ).toEqual(['TOEIC_ATTEMPT']);
    expect((await f.query({ action: 'WORD_REVIEWED' })).total).toBe(1);
    expect((await f.query({ status: 'FAILED' })).total).toBe(0);
    expect(
      (await f.query({ search: 'minigame', lang: 'en-US' })).items.map(
        (row) => row.action,
      ),
    ).toEqual(['MINIGAME_PLAY']);
    expect((await f.query({ search: 'Signed in', lang: 'en' })).total).toBe(1);
    expect((await f.query({ search: '[.*' })).total).toBe(0);
  });
  it('translates stored descriptions and titles on read, preserving unknown custom messages', async () => {
    const f = fixture();
    f.auditRows.push({
      ...f.auditRows[0],
      _id: 'page',
      action: 'PAGE_VIEW',
      metadata: { path: '/arena' },
    });
    f.auditRows.push({
      ...f.auditRows[0],
      _id: 'custom',
      action: 'MY_CUSTOM_EVENT',
      description: 'Original custom message',
    });
    const vi = await f.query({ lang: 'vi' }),
      en = await f.query({ lang: 'en' });
    expect(vi.items.find((row) => row._id === 'audit-email')?.description).toBe(
      dictionaries.vi.messages.SESSION_START,
    );
    expect(en.items.find((row) => row._id === 'audit-a')?.description).toBe(
      'Signed in to the account',
    );
    expect(en.items.find((row) => row._id === 'page')?.description).toBe(
      'Viewed a page: /arena',
    );
    expect(en.items.find((row) => row._id === 'custom')?.description).toBe(
      'Original custom message',
    );
  });
  it('stores configurable message keys and arguments without destroying original text', async () => {
    const f = fixture();
    const saved = await f.service.log({
      action: 'CUSTOM',
      description: 'Original',
      descriptionKey: 'activity-log.messages.WITH_TITLE',
      descriptionArgs: { message: 'Translated', title: 'Title' },
      userId,
      userEmail: 'learner@example.com',
      userName: 'Learner',
    });
    expect(saved?.description).toBe('Original');
    expect(saved?.descriptionKey).toBe('activity-log.messages.WITH_TITLE');
    f.auditRows.push({ ...f.auditRows[0], _id: 'configured', ...saved });
    expect(
      (await f.query({ lang: 'en' })).items.find(
        (row) => row._id === 'configured',
      )?.description,
    ).toBe('Translated: Title');
  });
  it('renders one key-only record in the selected language on each load without rewriting it', async () => {
    const f = fixture();
    const dto = plainToInstance(CreateActivityLogDto, {
      action: 'VOCABULARY_LEARN',
      descriptionKey: 'activity-log.messages.VOCABULARY_LEARN_WITH_TITLE',
      descriptionArgs: { title: 'Animals', count: 12 },
      userId,
      userEmail: 'learner@example.com',
      userName: 'Learner',
    });
    expect(await validate(dto)).toEqual([]);
    const saved = await f.service.log(dto);
    expect(saved?.description).toBe('');
    expect(saved?.descriptionKey).toBe(dto.descriptionKey);
    expect(saved?.descriptionArgs).toEqual({ title: 'Animals', count: 12 });
    f.auditRows.push({ ...f.auditRows[0], ...saved, _id: 'key-only' });
    const load = async (lang: string) =>
      (await f.query({ lang })).items.find((row) => row._id === 'key-only');
    expect((await load('en'))?.description).toBe('Studied vocabulary: Animals');
    expect((await load('vi'))?.description).toBe(
      dictionaries.vi.messages.VOCABULARY_LEARN_WITH_TITLE.replace(
        '{title}',
        'Animals',
      ),
    );
    expect((await load('en'))?.description).toBe('Studied vocabulary: Animals');
    expect(saved?.description).toBe('');
    expect(saved?.descriptionArgs).toEqual({ title: 'Animals', count: 12 });
    expect(f.audit.create).toHaveBeenCalledTimes(1);
  });
  it('normalizes standard events into keys and raw arguments, including nested action labels', async () => {
    const f = fixture();
    const page = await f.service.log({
      action: 'PAGE_VIEW',
      description: 'A sentence in the original language',
      metadata: { title: 'Localized page heading', path: '/arena' },
    });
    expect(page?.description).toBe('');
    expect(page?.descriptionKey).toBe(
      'activity-log.messages.PAGE_VIEW_WITH_TITLE',
    );
    expect(page?.descriptionArgs?.title).toBe('/arena');
    const failed = await f.service.log({
      action: 'AUTH_LOGIN',
      userId,
      userEmail: 'learner@example.com',
      userName: 'Learner',
      status: 'FAILED',
      description: 'Original failure sentence',
    });
    expect(failed?.descriptionKey).toBe('activity-log.messages.FAILED_ACTION');
    expect(failed?.descriptionArgs?.actionKey).toBe(
      'activity-log.actions.AUTH_LOGIN',
    );
    f.auditRows.push({ ...f.auditRows[0], ...failed, _id: 'failed-key' });
    expect(
      (await f.query({ lang: 'en' })).items.find(
        (row) => row._id === 'failed-key',
      )?.description,
    ).toBe('Login failed');
  });
  it('requires a message key or fallback text at the API boundary', async () => {
    const missing = plainToInstance(CreateActivityLogDto, { action: 'CUSTOM' });
    expect(
      (await validate(missing)).some((row) => row.property === 'description'),
    ).toBe(true);
    const keyed = plainToInstance(CreateActivityLogDto, {
      action: 'CUSTOM',
      descriptionKey: 'activity-log.messages.SESSION_START',
      descriptionArgs: {},
    });
    expect(await validate(keyed)).toEqual([]);
  });
  it('rejects unscoped/invalid queries and does not read learning data for the audit-only API', async () => {
    const f = fixture();
    await expect(f.query({ userId: undefined })).rejects.toThrow();
    await expect(f.query({ userId: 'invalid' })).rejects.toThrow();
    expect(f.audit.find).not.toHaveBeenCalled();
    expect(f.learning.find).not.toHaveBeenCalled();
    await f.query({ includeLearning: 'false' });
    expect(f.learning.find).not.toHaveBeenCalled();
  });
  it('uses Vietnam calendar days for range filtering', async () => {
    const f = fixture();
    f.learningRows.push({
      ...f.learningRows[0],
      _id: 'midnight',
      occurredAt: new Date('2026-10-23T17:00:00Z'),
    });
    f.learningRows.push({
      ...f.learningRows[0],
      _id: 'previous-day',
      occurredAt: new Date('2026-10-23T16:59:59Z'),
    });
    const result = await f.query({
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    });
    expect(result.items.some((row) => row._id === 'learning:midnight')).toBe(
      true,
    );
    expect(
      result.items.some((row) => row._id === 'learning:previous-day'),
    ).toBe(false);
  });
  it('provides translated learning filters and validates configured message keys', async () => {
    const f = fixture();
    const filters = await f.service.getFilterOptions('en');
    expect((await f.service.getI18n('en')).messages.ARENA_MATCH).toBe(
      dictionaries.en.messages.ARENA_MATCH,
    );
    expect(filters.actions.map((row) => row.value)).toEqual(
      expect.arrayContaining([...LEARNING_ACTIVITY_TYPES]),
    );
    expect(filters.categories.map((row) => row.value)).toEqual(
      expect.arrayContaining(['ARENA', 'MINIGAME']),
    );
    const dto = plainToInstance(CreateActivityLogDto, {
      action: 'CUSTOM',
      description: 'Fallback',
      descriptionKey: 'activity-log.messages.CUSTOM',
      descriptionArgs: {},
    });
    expect(await validate(dto)).toEqual([]);
    dto.descriptionKey = 'auth.SECRET';
    expect(
      (await validate(dto)).some((row) => row.property === 'descriptionKey'),
    ).toBe(true);
  });
});
