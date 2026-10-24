import type { I18nService } from 'nestjs-i18n';

export function formatVietnamDate(
  dateInput: Date | string | null | undefined,
): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date); // DD/MM/YYYY
}

export function formatVietnamTime(
  dateInput: Date | string | null | undefined,
): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date); // HH:mm
}

export function formatVietnamLastActive(
  dateInput: Date | string | null | undefined,
  isBanned: boolean,
  i18n: I18nService,
): string {
  if (isBanned) return i18n.t('user.STATUS_INACTIVE');
  if (!dateInput) return i18n.t('user.NO_ACTIVITY_YET');
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return i18n.t('user.NO_ACTIVITY_YET');

  const vnFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = vnFormatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || '';

  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const nowVNParts = vnFormatter.formatToParts(new Date());
  const getNowPart = (type: string) =>
    nowVNParts.find((p) => p.type === type)?.value || '';
  const nowDay = getNowPart('day');
  const nowMonth = getNowPart('month');
  const nowYear = getNowPart('year');

  const formattedTime = `${hour}:${minute}`;

  // Check if today in VN (UTC+7)
  if (day === nowDay && month === nowMonth && year === nowYear) {
    return `${i18n.t('user.TODAY')}, ${formattedTime}`;
  }

  // Check if yesterday in VN (UTC+7)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yParts = vnFormatter.formatToParts(yesterday);
  const getYPart = (type: string) =>
    yParts.find((p) => p.type === type)?.value || '';
  if (
    day === getYPart('day') &&
    month === getYPart('month') &&
    year === getYPart('year')
  ) {
    return `${i18n.t('user.YESTERDAY')}, ${formattedTime}`;
  }

  return `${day}/${month}/${year} ${formattedTime}`;
}

export function formatRelativeTime(
  dateInput: Date | string | null | undefined,
  i18n: I18nService,
): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return i18n.t('user.JUST_NOW');

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0)
    return i18n.t('user.AGO_YEARS', { args: { count: diffYears } });
  if (diffMonths > 0)
    return i18n.t('user.AGO_MONTHS', { args: { count: diffMonths } });
  if (diffDays > 0)
    return i18n.t('user.AGO_DAYS', { args: { count: diffDays } });
  if (diffHours > 0)
    return i18n.t('user.AGO_HOURS', { args: { count: diffHours } });
  if (diffMinutes > 0)
    return i18n.t('user.AGO_MINUTES', { args: { count: diffMinutes } });
  return i18n.t('user.JUST_NOW');
}
