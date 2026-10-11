import type { ActivityLogItem } from '@/types/activity-log';

export type TimeRangeDays = 7 | 30 | 90;

export interface PopularExamItem {
  id: string;
  name: string;
  attempts: number;
}

export interface NewUserItem {
  id: string;
  name: string;
  email: string;
  minutesAgo: number;
}

export type ActivityTemplateKey =
  | 'completed_exam'
  | 'registered'
  | 'created_exam'
  | 'achieved_score'
  | 'started_exam'
  | 'learned_words'
  | 'submitted_dictation'
  | 'generic';

export interface ActivityViewItem {
  id: string;
  userName: string;
  template: ActivityTemplateKey;
  target: string;
  score?: number;
  minutesAgo: number;
}

export interface AttemptSeriesData {
  labels: string[];
  listening: number[];
  reading: number[];
  fullTest: number[];
}

export function formatNumber(n: number, locale: string): string {
  return n.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN');
}

export function toMinutesAgo(iso?: string): number {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export function mapLogToActivity(log: ActivityLogItem): ActivityViewItem {
  const metadata = log.metadata || {};
  const target =
    (metadata.examName as string) ||
    (metadata.exam as string) ||
    (metadata.name as string) ||
    '';
  const score = typeof metadata.score === 'number' ? metadata.score : undefined;
  const userName =
    log.userName ||
    (log.userEmail ? log.userEmail.split('@')[0] : '') ||
    '—';

  let template: ActivityTemplateKey = 'generic';
  if (log.action === 'AUTH_REGISTER') template = 'registered';
  else if (log.action === 'TOEIC_SUBMIT') {
    template = score ? 'achieved_score' : target ? 'completed_exam' : 'generic';
  } else if (log.action === 'TOEIC_START' || log.action === 'DICTATION_START') {
    template = target ? 'started_exam' : 'generic';
  } else if (log.action === 'VOCABULARY_LEARN') template = 'learned_words';
  else if (log.action === 'DICTATION_SUBMIT') template = 'submitted_dictation';

  return {
    id: log._id,
    userName,
    template,
    target: target || log.description || log.actionLabel || log.action,
    score,
    minutesAgo: toMinutesAgo(log.createdAt),
  };
}
