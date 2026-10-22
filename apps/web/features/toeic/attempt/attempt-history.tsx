'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ToeicAttemptSummary } from '@/services/toeic.service';
import { Button } from '@/components/ui/button';

export function AttemptHistory({
  attempts,
  locale,
}: {
  attempts: ToeicAttemptSummary[];
  locale: string;
}) {
  const { t } = useTranslation('toeic');
  if (!attempts.length)
    return <p className="p-6 text-sm text-slate-500">{t('attempt.no_history')}</p>;
  return (
    <div className="divide-y divide-slate-100">
      {attempts.map((attempt) => {
        const exam = typeof attempt.examId === 'object' ? attempt.examId : null;
        const inProgress = attempt.status === 'IN_PROGRESS';
        const finished =
          attempt.status === 'FINISHED' || attempt.status === 'COMPLETED';
        return (
          <article
            key={attempt._id}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">{exam?.name || 'TOEIC'}</h3>
              <p className="text-sm text-slate-600">
                {attempt.mode || '—'} ·{' '}
                {attempt.selectedParts?.map((p) => `Part ${p}`).join(' + ') ||
                  '—'}
              </p>
              <p className="text-xs text-slate-500">
                {t(
                  inProgress
                    ? 'attempt.in_progress'
                    : finished
                      ? 'attempt.finished'
                      : 'attempt.abandoned',
                )}
                {attempt.createdAt &&
                  ` · ${new Date(attempt.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}`}
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {inProgress
                ? `${attempt.answeredQuestions || 0}/${attempt.totalQuestions || 0} ${t('attempt.completed')}`
                : finished
                  ? `${attempt.totalCorrect ?? attempt.correctAnswers ?? 0}/${attempt.totalQuestions || 0}`
                  : '—'}
            </p>
            {attempt.mode && (
              <Button asChild size="sm" variant={inProgress ? 'default' : 'outline'}>
              <Link
                href={
                  finished
                    ? `/${locale}/toeic/attempts/${attempt._id}/result`
                    : `/${locale}/toeic/attempts/${attempt._id}`
                }
              >
                {t(
                  inProgress
                    ? 'attempt.continue'
                    : finished
                      ? 'attempt.view_result'
                      : 'attempt.review',
                )}
              </Link>
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
