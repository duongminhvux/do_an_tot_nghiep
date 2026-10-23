'use client';

import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ToeicAttemptSummary } from '@/services/toeic.service';
import { surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { AttemptHistory } from '@/features/toeic/attempt/attempt-history';

export function ExamLeaderboard({ rawAttempts }: { rawAttempts: ToeicAttemptSummary[] }) {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation('toeic');
  return <section className={cn(surface, 'overflow-hidden')}>
    <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">{t('attempt.history')}</h2>
    <AttemptHistory attempts={rawAttempts} locale={locale} />
  </section>;
}
