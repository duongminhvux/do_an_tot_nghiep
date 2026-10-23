'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FileCheck2,
  Layers,
  Loader2,
  NotebookPen,
  Square,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  Segmented,
  StatCard,
  Tabs,
  surface,
} from '@/components/ui/page';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toeicAttemptService } from '@/services/toeic-attempt.service';
import { toeicService, ToeicAttemptSummary } from '@/services/toeic.service';
import { dateLocale, formatDuration, formatPercent } from '@/features/toeic/format';
import { estimateToeicScore } from '@/features/toeic/score';

const PAGE_SIZE = 10;
type Tab = 'all' | 'test' | 'practice' | 'in_progress';
const TAB_QUERY: Record<Tab, Record<string, string>> = {
  all: {},
  test: { mode: 'TEST' },
  practice: { mode: 'PRACTICE' },
  in_progress: { status: 'IN_PROGRESS' },
};

export default function ToeicHistoryPage() {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation('toeic');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const { data: statsResponse } = useQuery({
    queryKey: ['toeic-stats', 'all'],
    queryFn: () => toeicService.getStats(),
    staleTime: 30_000,
  });
  const stats = statsResponse?.data;

  const history = useInfiniteQuery({
    queryKey: ['toeic-attempts', tab, sort],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await toeicService.getAttempts({
        ...TAB_QUERY[tab],
        sort,
        page: pageParam,
        limit: PAGE_SIZE,
      });
      return Array.isArray(res?.data) ? res.data : [];
    },
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length + 1 : undefined,
  });
  const attempts = history.data?.pages.flat() ?? [];

  const cards = [
    { key: 'total', value: stats?.totalAttempts, icon: ClipboardList, tone: 'violet' as const },
    { key: 'test', value: stats?.testAttempts, icon: FileCheck2, tone: 'blue' as const },
    { key: 'practice', value: stats?.practiceAttempts, icon: NotebookPen, tone: 'emerald' as const },
    { key: 'in_progress', value: stats?.inProgress, icon: Timer, tone: 'orange' as const },
  ];

  return (
    <PageShell>
      <PageHeader
        back={{ href: `/${locale}/toeic`, label: t('history.back') }}
        title={t('history.title')}
        description={t('history.description')}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ key, value, icon, tone }) => (
          <StatCard key={key} icon={icon} tone={tone} label={t(`history.card_${key}`)} value={value ?? '—'} />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          className="min-w-0 flex-1"
          value={tab}
          onChange={setTab}
          items={(Object.keys(TAB_QUERY) as Tab[]).map((key) => ({ value: key, label: t(`history.tab_${key}`) }))}
        />
        <div className="mb-1.5" role="group" aria-label={t('history.sort_label')}>
          <Segmented
            value={sort}
            onChange={setSort}
            items={[
              { value: 'newest' as const, label: t('history.sort_newest') },
              { value: 'oldest' as const, label: t('history.sort_oldest') },
            ]}
          />
        </div>
      </div>

      {history.isLoading ? (
        <LoadingState label={t('history.loading')} />
      ) : history.isError ? (
        <ErrorState message={t('history.error')} />
      ) : attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('history.empty')}
          description={t('history.empty_description')}
          action={
            <Button asChild>
              <Link href={`/${locale}/toeic`}>{t('history.start')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <AttemptCard key={attempt._id} attempt={attempt} locale={locale} />
          ))}
          {history.hasNextPage && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => history.fetchNextPage()}
                disabled={history.isFetchingNextPage}
              >
                {history.isFetchingNextPage && <Loader2 className="animate-spin" />}
                {t('history.load_more')}
              </Button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function AttemptCard({ attempt, locale }: { attempt: ToeicAttemptSummary; locale: string }) {
  const { t } = useTranslation('toeic');
  const queryClient = useQueryClient();
  const [confirmStop, setConfirmStop] = useState(false);
  const stop = useMutation({
    mutationFn: () => toeicAttemptService.abandon(attempt._id),
    onSuccess: () => {
      setConfirmStop(false);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('toeic-'),
      });
    },
  });
  const exam = typeof attempt.examId === 'object' && attempt.examId ? attempt.examId : null;
  // A timed test past its deadline is graded by the API when it is opened.
  const timedOut =
    attempt.status === 'IN_PROGRESS' &&
    Boolean(attempt.expiresAt) &&
    new Date(attempt.expiresAt!).getTime() < Date.now();
  const inProgress = attempt.status === 'IN_PROGRESS' && !timedOut;
  const finished = attempt.status === 'FINISHED' || attempt.status === 'COMPLETED';
  const total = attempt.totalQuestions ?? 0;
  const answered = attempt.answeredQuestions ?? 0;
  const correct = attempt.totalCorrect ?? attempt.correctAnswers ?? 0;
  const accuracy = attempt.accuracy ?? (total ? (correct / total) * 100 : 0);
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const score =
    finished && attempt.mode === 'TEST'
      ? estimateToeicScore(attempt.listeningResult, attempt.readingResult)
      : null;
  const href = finished || timedOut
    ? `/${locale}/toeic/attempts/${attempt._id}/result`
    : `/${locale}/toeic/attempts/${attempt._id}`;

  const badge: { label: string; tone: 'red' | 'orange' | 'slate' | 'blue' | 'emerald' } = timedOut
    ? { label: t('history.badge_time_up'), tone: 'red' }
    : inProgress
    ? { label: t('history.badge_in_progress'), tone: 'orange' }
    : !finished
      ? { label: t('history.badge_abandoned'), tone: 'slate' }
      : attempt.mode === 'TEST'
        ? { label: t('history.badge_test'), tone: 'blue' }
        : { label: t('history.badge_practice'), tone: 'emerald' };

  const breakdown: { label: string; correct: number; total: number }[] =
    attempt.mode === 'TEST' || (attempt.partResults?.length ?? 0) > 3
      ? [
          { label: t('history.listening'), result: attempt.listeningResult },
          { label: t('history.reading'), result: attempt.readingResult },
        ]
          .filter((row) => row.result?.total)
          .map((row) => ({ label: row.label, correct: row.result!.correct, total: row.result!.total }))
      : (attempt.partResults ?? []).map((p) => ({ label: `Part ${p.part}`, correct: p.correct, total: p.total }));

  const date = attempt.createdAt
    ? new Date(attempt.createdAt).toLocaleString(dateLocale(locale), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <article className={cn(surface, 'grid gap-4 p-5 transition hover:border-blue-200 lg:grid-cols-[1fr_220px_auto]')}>
      <div className="min-w-0 space-y-2.5">
        <h2 className="truncate text-base font-semibold text-slate-900">{exam?.name || 'TOEIC'}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <Badge>
            <Layers className="h-3.5 w-3.5" />
            {t('history.parts', { parts: attempt.selectedParts?.join(', ') || '—' })}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {date}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {inProgress
              ? t('history.answered_progress', { answered, total })
              : formatDuration(attempt.durationSpent, t)}
          </span>
        </div>
      </div>

      <div className="border-slate-100 lg:border-l lg:pl-5">
        {inProgress ? (
          <div className="flex h-full flex-col justify-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-xs font-semibold text-slate-600">{progress}%</p>
          </div>
        ) : score ? (
          <div className="space-y-1" title={t('history.estimated_hint')}>
            <p className="text-xs text-slate-500">{t('history.total_score')}</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {score.total}
              <span className="ml-1 text-xs font-medium text-slate-400">/ {score.max}</span>
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-xs text-slate-600">
              {[
                { label: t('history.listening'), value: score.listening },
                { label: t('history.reading'), value: score.reading },
              ]
                .filter((row) => row.value != null)
                .map((row) => (
                  <div key={row.label} className="contents">
                    <dt>{row.label}</dt>
                    <dd className="text-right font-semibold text-slate-800">{row.value}</dd>
                  </div>
                ))}
            </dl>
            <p className="text-xs text-slate-400">
              {correct} / {total} · {formatPercent(accuracy, locale)}
            </p>
          </div>
        ) : finished ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{t('history.correct_answers')}</p>
            <p className="text-xl font-bold text-slate-900">
              <span className="text-emerald-600">{correct}</span>
              <span className="text-slate-400"> / {total}</span>
              <span className="ml-2 text-xs font-semibold text-slate-500">({formatPercent(accuracy, locale)})</span>
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-xs text-slate-600">
              {breakdown.map((row) => (
                <div key={row.label} className="contents">
                  <dt>{row.label}</dt>
                  <dd className="text-right font-semibold text-slate-800">
                    {row.correct} / {row.total}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {inProgress && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stop.reset();
              setConfirmStop(true);
            }}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Square className="fill-current" />
            {t('history.stop')}
          </Button>
        )}
        <Button asChild variant={inProgress ? 'default' : 'secondary'}>
          <Link href={href}>
            {t(inProgress ? 'history.continue' : 'history.view_detail')}
            <ChevronRight />
          </Link>
        </Button>
      </div>

      <Dialog
        open={confirmStop}
        onOpenChange={(open) => {
          if (!stop.isPending) setConfirmStop(open);
        }}
      >
        <DialogContent className="rounded-2xl border-slate-200">
          <DialogTitle>{t('history.stop_title')}</DialogTitle>
          <DialogDescription>
            {t('history.stop_desc', { name: exam?.name || 'TOEIC', answered, total })}
          </DialogDescription>
          {stop.isError && (
            <p role="alert" className="text-sm text-red-600">
              {t('history.stop_error')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={stop.isPending}
              onClick={() => setConfirmStop(false)}
            >
              {t('history.stop_cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={stop.isPending}
              onClick={() => stop.mutate()}
            >
              {stop.isPending && <Loader2 className="animate-spin" />}
              {t('history.stop_confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
