import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  formatVietnamLastActive,
  formatRelativeTime,
} from './admin-user-time.js';

function translator(lang: string) {
  const dictionary = JSON.parse(
    readFileSync(
      new URL(`../../i18n/${lang}/user.json`, import.meta.url),
      'utf8',
    ),
  );
  return {
    t: (key: string, options?: { args: { count: number } }) =>
      String(dictionary[key.replace(/^user\./, '')]).replace(
        '{count}',
        String(options?.args.count ?? ''),
      ),
  } as never;
}
afterEach(() => vi.useRealTimers());
describe('localized admin user timestamps', () => {
  it('translates today and yesterday using Vietnam calendar days at the UTC boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T17:10:00Z'));
    expect(
      formatVietnamLastActive('2026-10-24T17:05:00Z', false, translator('en')),
    ).toBe('Today, 00:05');
    expect(
      formatVietnamLastActive('2026-10-24T16:55:00Z', false, translator('en')),
    ).toBe('Yesterday, 23:55');
    expect(
      formatVietnamLastActive('2026-10-24T17:05:00Z', false, translator('vi')),
    ).not.toContain('Today');
  });
  it('uses configured labels for banned users, no activity and relative registration time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    const en = translator('en');
    expect(formatVietnamLastActive(null, false, en)).toBe('No activity yet');
    expect(formatVietnamLastActive('invalid', false, en)).toBe(
      'No activity yet',
    );
    expect(formatVietnamLastActive(null, true, en)).toBe('Inactive');
    expect(formatRelativeTime('2026-10-24T10:00:00Z', en)).toBe('2 hours ago');
    expect(formatRelativeTime('2026-10-24T11:59:50Z', en)).toBe('Just now');
  });
});
