'use client';

import { useTranslation } from 'react-i18next';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Headphones, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLessonSummary, DictationProgressOverview } from '@/types/dictation';
import { Card, EmptyState, LoadingState, PageHeader, PageShell, StatCard, type Tone } from '@/components/ui/page';
import { Button } from '@/components/ui/button';

function unwrap<T>(value: any): T { return (value?.data ?? value) as T; }

export default function DictationProgressPage() {
  const { t } = useTranslation('dictation');
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { data, isLoading } = useQuery({ queryKey: ['dictation-progress-overview'], queryFn: () => dictationService.getProgressOverview() });
  const overview = unwrap<DictationProgressOverview>(data) || { totalStarted: 0, completed: 0, totalCorrect: 0, totalAttempts: 0, items: [] };
  const accuracy = overview.totalAttempts ? Math.round((overview.totalCorrect / overview.totalAttempts) * 100) : 0;
  const statCards: Array<{ label: string; value: string | number; Icon: LucideIcon; tone: Tone }> = [
    { label: t('started'), value: overview.totalStarted, Icon: Headphones, tone: 'blue' },
    { label: t('completed'), value: overview.completed, Icon: CheckCircle2, tone: 'emerald' },
    { label: t('correct_sentences'), value: overview.totalCorrect, Icon: Target, tone: 'violet' },
    { label: t('accuracy'), value: `${accuracy}%`, Icon: BarChart3, tone: 'amber' },
  ];

  return (
    <PageShell>
      <PageHeader eyebrow="Dictation" title={t('progress_title')} description={t('progress_description')} />

      {isLoading ? (
        <LoadingState label={t('loading_progress')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ label, value, Icon, tone }) => (
              <StatCard key={label} icon={Icon} tone={tone} label={String(label)} value={String(value)} />
            ))}
          </div>

          {overview.items.length === 0 ? (
            <EmptyState
              icon={Headphones}
              title={t('empty_progress')}
              action={
                <Button asChild size="sm">
                  <Link href={`/${locale}/dictation`}>{t('start_lesson')}</Link>
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">{t('practiced_lessons')}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {overview.items.map((progress) => {
                  const lesson = progress.lessonId as DictationLessonSummary;
                  if (!lesson || typeof lesson === 'string') return null;
                  const handled = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]).size;
                  const percent = lesson.sentenceCount ? Math.round((handled / lesson.sentenceCount) * 100) : 0;
                  const rowAccuracy = progress.attempts ? Math.round((progress.correctCount / progress.attempts) * 100) : 0;
                  return (
                    <Link
                      key={progress._id || lesson._id}
                      href={`/${locale}/dictation/${lesson.slug}`}
                      className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_130px_130px] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{lesson.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{lesson.level} · {lesson.topic}</p>
                        <div className="mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t('completed')}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{handled}/{lesson.sentenceCount} {t('sentences')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t('accurate')}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{rowAccuracy}%</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
