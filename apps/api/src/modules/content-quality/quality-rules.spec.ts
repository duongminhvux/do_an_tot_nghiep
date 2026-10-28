import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { qualityItem } from './quality-rules.js';
import {
  qualityMediaTarget,
  QualityMediaService,
} from './quality-media.service.js';
describe('F11 quality rules and safe media probing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('finds missing word audio and reuses publication data errors without mutation', () => {
    const word = {
      id: 'word-id',
      word: 'test',
      slug: 'test',
      level: 'B1',
      parts: [],
      linkedLessons: 0,
    };
    const copy = structuredClone(word);
    const item = qualityItem('words', word);
    expect(
      item.issues.some(
        (i) => i.category === 'MEDIA' && i.code === 'AUDIO_REQUIRED',
      ),
    ).toBe(true);
    expect(item.issues.some((i) => i.category === 'DATA')).toBe(true);
    expect(item.editPath).toBe('/vocabulary/words?editWordId=word-id');
    expect(word).toEqual(copy);
  });
  it('links lesson/Dictation/TOEIC findings to the existing editors and categorizes duplicates', () => {
    expect(
      qualityItem('lessons', { id: 'lesson', collectionId: 'collection' })
        .editPath,
    ).toBe('/vocabulary/collections?collectionId=collection&lessonId=lesson');
    expect(
      qualityItem('dictation', { id: 'dictation', segments: [] }).issues.some(
        (i) => i.category === 'MEDIA',
      ),
    ).toBe(true);
    const question = {
      id: 'q1',
      part: 5,
      content: 'Same',
      options: [
        { key: 'A', text: 'One' },
        { key: 'B', text: 'Two' },
        { key: 'C', text: 'Three' },
        { key: 'D', text: 'Four' },
      ],
      correctAnswer: 'A',
    };
    const item = qualityItem('exams', {
      id: 'exam',
      questions: [question, { ...question, id: 'q2' }],
      groups: [],
    });
    expect(item.editPath).toBe('/assessment/exam');
    expect(item.issues.some((i) => i.category === 'DUPLICATE')).toBe(true);
  });
  it('returns a concrete malformed-data finding instead of crashing a scan', () => {
    expect(
      qualityItem('words', {
        id: 'word',
        word: 'test',
        parts: [null],
      }).issues.some((i) => i.code === 'MALFORMED'),
    ).toBe(true);
  });
  it('extracts audio and image references without exposing answer keys', () => {
    const item = qualityItem('exams', {
      id: 'exam',
      questions: [
        {
          id: 'q',
          part: 1,
          audioUrl: '/media/a.wav',
          imageUrl: '/media/a.jpg',
          correctAnswer: 'A',
          options: [],
        },
      ],
      groups: [],
    });
    expect(item.media).toEqual([
      { path: 'questions.q.audioUrl', url: '/media/a.wav' },
      { path: 'questions.q.imageUrl', url: '/media/a.jpg' },
    ]);
    expect(JSON.stringify(item)).not.toContain('correctAnswer');
  });
  it('only maps configured media paths to the trusted media service', () => {
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://media.example.test/media');
    vi.stubEnv('MEDIA_JOBS_INTERNAL_URL', 'http://trusted-media:5000');
    expect(qualityMediaTarget('/media/audio/a.wav')).toBe(
      'http://trusted-media:5000/media/audio/a.wav',
    );
    expect(qualityMediaTarget('https://media.example.test/media/a.wav')).toBe(
      'http://trusted-media:5000/media/a.wav',
    );
    for (const value of [
      'http://127.0.0.1/secrets',
      'http://169.254.169.254/latest',
      '//evil.test/media/a',
      'https://evil.test/media/a',
      '/api/admin/users',
      '/media/private/a',
      '/media/asr-jobs/a',
      '/media/%2fsecrets',
      '/media/a?x=1',
    ])
      expect(qualityMediaTarget(value)).toBeNull();
  });
  it('confirms only 404/410 as missing and leaves timeout/redirect/external URLs unverified', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init?: RequestInit) =>
        new Response(null, { status: 404 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const media = new QualityMediaService();
    expect(await media.probe('/media/missing.wav')).toBe('MISSING');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'HEAD',
      redirect: 'manual',
    });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 302 }));
    expect(await media.probe('/media/a')).toBe('UNVERIFIED');
    fetcher.mockRejectedValueOnce(new Error('timeout'));
    expect(await media.probe('/media/b')).toBe('UNVERIFIED');
    const calls = fetcher.mock.calls.length;
    expect(await media.probe('https://untrusted.test/a')).toBe('UNVERIFIED');
    expect(fetcher.mock.calls.length).toBe(calls);
  });
  it('keeps Vietnamese Unicode and translation keys aligned', () => {
    const read = (lang: string) =>
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../admin-web/locales/${lang}/common.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ).contentQuality;
    const viText = read('vi'),
      enText = read('en');
    const keys = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([key, value]) =>
        typeof value === 'object'
          ? keys(value as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    expect(keys(viText)).toEqual(keys(enText));
    expect(viText.title).toBe('Chất lượng dữ liệu');
  });
});
