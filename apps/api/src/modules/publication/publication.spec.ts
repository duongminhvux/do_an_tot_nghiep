import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validatePublication } from '@repo/shared-types/publication';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicationFilterDto } from './publication.dto.js';
import {
  publicationScope,
  visiblePublicationRows,
} from './publication-scope.js';
import { readFileSync } from 'node:fs';

describe('F10 publication validation', () => {
  const q = {
    id: 'q',
    part: 5,
    content: 'Select a word.',
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key })),
    correctAnswer: 'A',
    isActive: true,
  };
  it('reuses TOEIC import rules for choices, answers and grouped exercises', () => {
    expect(
      validatePublication('exams', { questions: [q], groups: [] }),
    ).toEqual([]);
    for (const patch of [
      { options: [] },
      { correctAnswer: 'X' },
      { part: 3 },
      { content: '' },
    ])
      expect(
        validatePublication('exams', {
          questions: [{ ...q, ...patch }],
          groups: [],
        }).length,
      ).toBeGreaterThan(0);
    expect(
      validatePublication('exams', { questions: [], groups: [] })[0].code,
    ).toBe('EMPTY');
  });
  it('requires listening media and detects exact duplicates', () => {
    const listening = {
      ...q,
      part: 1,
      content: 'A spoken script.',
      imageUrl: '/media/image.png',
    };
    expect(
      validatePublication('exams', { questions: [listening], groups: [] }).some(
        (issue) => issue.code === 'AUDIO_REQUIRED',
      ),
    ).toBe(true);
    expect(
      validatePublication('exams', {
        questions: [{ ...listening, audioUrl: '/media/audio.mp3' }],
        groups: [],
      }),
    ).toEqual([]);
    expect(
      validatePublication('exams', {
        questions: [q, { ...q, id: 'q2' }],
        groups: [],
      }).some((issue) => issue.code === 'DUPLICATE'),
    ).toBe(true);
    expect(
      validatePublication('exams', {
        questions: [
          {
            ...listening,
            audioUrl: '/media/audio.mp3',
            audioMeta: { status: 'STALE' },
          },
        ],
        groups: [],
      }).some((issue) => issue.code === 'AUDIO_STALE'),
    ).toBe(true);
  });
  it('checks word meanings and lesson links without requiring the lesson to be published first', () => {
    const word = {
      word: 'test',
      slug: 'test',
      level: 'B1',
      parts: [
        { partOfSpeech: 'noun', meanings: [{ translation: ['thử nghiệm'] }] },
      ],
      linkedLessons: 1,
    };
    expect(validatePublication('words', word)).toEqual([]);
    expect(
      validatePublication('words', { ...word, linkedLessons: 0 })[0].code,
    ).toBe('LESSON_REQUIRED');
    expect(validatePublication('words', { ...word, parts: {} })[0].code).toBe(
      'MEANING_REQUIRED',
    );
    expect(
      validatePublication('lessons', {
        title: 'Lesson',
        slug: 'lesson',
        collectionAvailable: true,
        words: [{ id: 'w', available: true, publicationStatus: 'DRAFT' }],
      })[0].code,
    ).toBe('WORD_UNPUBLISHED');
  });
  it('requires ready audio and consistent Dictation timing/count metadata', () => {
    const lesson = {
      status: 'READY',
      fullAudioUrl: '/media/full.wav',
      totalDurationMs: 1000,
      sentenceCount: 1,
      segments: [
        {
          id: 's',
          order: 0,
          text: 'Sentence.',
          startMs: 0,
          endMs: 1000,
          durationMs: 1000,
        },
      ],
    };
    expect(validatePublication('dictation', lesson)).toEqual([]);
    for (const patch of [
      { status: 'DRAFT' },
      { sentenceCount: 2 },
      { fullAudioUrl: '' },
      { segments: [{ ...lesson.segments[0], endMs: 1200 }] },
      { segments: [{ ...lesson.segments[0], durationMs: undefined }] },
    ])
      expect(
        validatePublication('dictation', { ...lesson, ...patch }).length,
      ).toBeGreaterThan(0);
  });
  it('does not let learner filters select drafts, and validates status enum', async () => {
    const rows = [
      { publication_status: 'DRAFT' },
      { publication_status: 'PUBLISHED' },
      { publication_status: 'PUBLISHED', is_deleted: true },
    ];
    expect(
      publicationScope.run(true, () => visiblePublicationRows('words', rows)),
    ).toHaveLength(1);
    expect(
      publicationScope.run(false, () => visiblePublicationRows('words', rows)),
    ).toHaveLength(3);
    expect(
      (
        await validate(
          plainToInstance(PublicationFilterDto, {
            publicationStatus: 'ACTIVE',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('preserves Vietnamese review labels and matches English translation keys', () => {
    const read = (lang: string) =>
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../admin-web/locales/${lang}/common.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ).publication;
    expect(read('vi').title).toBe('Kiểm duyệt nội dung');
    expect(Object.keys(read('vi')).sort()).toEqual(
      Object.keys(read('en')).sort(),
    );
  });
});
