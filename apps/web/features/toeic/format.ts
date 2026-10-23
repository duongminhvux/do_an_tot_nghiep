import type { TFunction } from 'i18next';

export function formatDuration(seconds: number | undefined, t: TFunction) {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return t('duration.hours_minutes', { h, m });
  if (m) return t('duration.minutes', { m });
  return t('duration.seconds', { s: total });
}

export function dateLocale(locale: string) {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}

export function formatPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(dateLocale(locale), { maximumFractionDigits: 1 }).format(value)}%`;
}
