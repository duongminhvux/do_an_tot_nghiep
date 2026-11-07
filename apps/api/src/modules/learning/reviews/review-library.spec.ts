import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { databaseSuite } from '../../../../test/native-database.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { ReviewsService } from './reviews.service.js';
import { ProgressService } from '../progress/progress.service.js';
import {
  PracticeWordsDto,
  RecordWordReviewDto,
  ReviewLibraryDto,
} from './dto/review-library.dto.js';
const catalog = vi.hoisted(() => ({
  words: [] as any[],
  lessons: [] as any[],
  collections: [] as any[],
}));
vi.mock('../../vocabulary/content-reader.js', () => {
  const read = async (_db: unknown, kind: keyof typeof catalog, input: any) => {
    let list = structuredClone(catalog[kind] || []);
    if (input.ids) list = list.filter((row) => input.ids.includes(row._id));
    if (input.publishedOnly)
      list = list.filter((row) => row.published !== false);
    return list.slice(
      input.offset || 0,
      (input.offset || 0) + (input.limit || 2000),
    );
  };
  return { contentRows: read, allContentRows: read, contentBatches: read };
});
const suite = databaseSuite('learning');
beforeEach(() => {
  catalog.words = [];
  catalog.lessons = [];
  catalog.collections = [];
});
const reviews = () =>
  new ReviewsService(suite.db, new DomainOutboxService(suite.db));
describe('learned vocabulary library', () => {
  it('returns all owned published words beyond the old 100-word cap with correct pagination, stats and search', async () => {
    const user = randomUUID(),
      foreign = randomUUID();
    for (let i = 0; i < 124; i++) {
      const word = randomUUID();
      catalog.words.push({
        _id: word,
        word: `word-${i}`,
        parts: [
          {
            meanings: [
              {
                translation: [i === 2 ? 'mục tiêu' : 'nghĩa khác'],
                definition: 'definition',
              },
            ],
          },
        ],
        published: i !== 123,
      });
      await suite
        .records('userwordreviews')
        .insert({
          userId: user,
          wordId: word,
          status: i % 2 ? 'MASTERED' : 'LEARNING',
          reviewCount: 1,
          correctCount: 1,
          incorrectCount: 0,
          nextReviewAt: new Date(Date.now() + (i % 2 ? 86400000 : -86400000)),
        });
    }
    const secret = randomUUID();
    catalog.words.push({ _id: secret, word: 'foreign-word' });
    await suite
      .records('userwordreviews')
      .insert({
        userId: foreign,
        wordId: secret,
        status: 'LEARNING',
        nextReviewAt: new Date(0),
      });
    const first = await reviews().library(user, {
      page: 1,
      limit: 20,
      status: 'ALL',
    });
    const last = await reviews().library(user, {
      page: 7,
      limit: 20,
      status: 'ALL',
    });
    expect(first.total).toBe(123);
    expect(first.items).toHaveLength(20);
    expect(last.items).toHaveLength(3);
    expect(first.stats).toEqual({
      total: 123,
      due: 62,
      learning: 62,
      mastered: 61,
    });
    expect(
      (
        await reviews().library(user, {
          page: 1,
          limit: 20,
          status: 'ALL',
          search: 'mục tiêu',
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await reviews().library(user, {
          page: 1,
          limit: 20,
          status: 'ALL',
          search: 'translation',
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await reviews().library(user, {
          page: 1,
          limit: 20,
          status: 'ALL',
          search: 'foreign-word',
        })
      ).total,
    ).toBe(0);
    expect(
      (await reviews().library(user, { page: 1, limit: 20, status: 'DUE' }))
        .total,
    ).toBe(62);
  });
  it('only practises owned learned words, keeps review state intact and respects the selected list search', async () => {
    const user = randomUUID(),
      other = randomUUID(),
      word = randomUUID(),
      otherWord = randomUUID();
    catalog.words = [
      { _id: word, word: 'target' },
      { _id: otherWord, word: 'other' },
    ];
    await suite
      .records('userwordreviews')
      .insert({
        userId: user,
        wordId: word,
        status: 'MASTERED',
        reviewCount: 3,
        nextReviewAt: new Date(Date.now() + 86400000),
      });
    await suite
      .records('userwordreviews')
      .insert({
        userId: other,
        wordId: otherWord,
        status: 'LEARNING',
        reviewCount: 1,
      });
    expect(
      await reviews().practice(user, { wordId: otherWord, status: 'ALL' }),
    ).toEqual([]);
    expect(
      (await reviews().practice(user, { wordId: word, status: 'ALL' }))[0],
    ).toMatchObject({
      status: 'MASTERED',
      reviewCount: 3,
      wordId: { word: 'target' },
    });
    expect(
      await reviews().practice(user, { status: 'ALL', search: 'not-present' }),
    ).toEqual([]);
    expect(
      await reviews().practice(user, { status: 'MASTERED', search: 'target' }),
    ).toHaveLength(1);
    expect(
      (await reviews().library(user, { page: 1, limit: 20, status: 'ALL' }))
        .items[0].reviewCount,
    ).toBe(3);
  });
  it('validates library/practice/rating inputs and never treats an invalid rating as GOOD', async () => {
    expect(
      validateSync(
        plainToInstance(ReviewLibraryDto, {
          page: '2',
          limit: '18',
          status: 'DUE',
        }),
      ),
    ).toEqual([]);
    for (const body of [
      { page: 0 },
      { limit: 200 },
      { search: 'x'.repeat(101) },
      { status: 'OTHER' },
    ])
      expect(
        validateSync(plainToInstance(ReviewLibraryDto, body)).length,
      ).toBeGreaterThan(0);
    expect(
      validateSync(plainToInstance(PracticeWordsDto, { wordId: 'not-uuid' }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateSync(
        plainToInstance(RecordWordReviewDto, {
          wordId: randomUUID(),
          rating: 'OTHER',
        }),
      ).length,
    ).toBeGreaterThan(0);
    await expect(
      reviews().recordReview(randomUUID(), randomUUID(), 'OTHER' as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});
describe('continue vocabulary card data', () => {
  it('prefers a real unfinished lesson and returns the collection slug rather than an ID', async () => {
    const user = randomUUID(),
      collection = randomUUID(),
      active = randomUUID(),
      completed = randomUUID();
    catalog.collections = [
      { _id: collection, name: 'Destination B1', slug: 'destination-b1' },
    ];
    catalog.lessons = [
      {
        _id: active,
        collectionId: collection,
        title: 'Active lesson',
        slug: 'unit-6-learning-and-doing',
      },
      {
        _id: completed,
        collectionId: collection,
        title: 'Done lesson',
        slug: 'unit-done',
      },
    ];
    await suite
      .records('userlessonprogresses')
      .insert({
        userId: user,
        lessonId: active,
        status: 'IN_PROGRESS',
        progress: 40,
        lastStudiedAt: new Date(Date.now() - 86400000),
      });
    await suite
      .records('userlessonprogresses')
      .insert({
        userId: user,
        lessonId: completed,
        status: 'COMPLETED',
        progress: 100,
        lastStudiedAt: new Date(),
      });
    const data = await new ProgressService(suite.db).getTodayTasks(user);
    expect(data.currentLesson).toMatchObject({
      title: 'Active lesson',
      slug: 'unit-6-learning-and-doing',
      collectionSlug: 'destination-b1',
      progress: 40,
    });
  });
  it('does not recommend a completed lesson as a new lesson', async () => {
    const user = randomUUID(),
      collection = randomUUID(),
      lesson = randomUUID();
    catalog.collections = [{ _id: collection, slug: 'destination-b1' }];
    catalog.lessons = [
      { _id: lesson, collectionId: collection, slug: 'done', title: 'Done' },
    ];
    await suite
      .records('userlessonprogresses')
      .insert({
        userId: user,
        lessonId: lesson,
        status: 'COMPLETED',
        progress: 100,
      });
    expect(
      (await new ProgressService(suite.db).getTodayTasks(user)).currentLesson,
    ).toBeNull();
  });
});
