'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, BarChart3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  Segmented,
  surface,
} from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { toeicService, ToeicStatsDay } from '@/services/toeic.service';
import { dateLocale, formatDuration, formatPercent } from '@/features/toeic/format';
import { BarChart, Legend, LineChart, SERIES_COLORS } from '@/features/toeic/stats/charts';

const PERIODS = [7, 30, 90, 0] as const;

// YYYY-MM-DD in the viewer's zone, matching the API's daily buckets.
function dayKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function fillDays(timeline: ToeicStatsDay[], days: number): ToeicStatsDay[] {
  if (!days) return timeline;
  const byDate = new Map(timeline.map((d) => [d.date, d]));
  return Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    return (
      byDate.get(date) ?? {
        date,
        attempts: 0,
        completed: 0,
        duration: 0,
        accuracy: null,
        listeningAccuracy: null,
        readingAccuracy: null,
        avgScore: null,
        avgListeningScore: null,
        avgReadingScore: null,
      }
    );
  });
}

export default function ToeicStatsPage() {
  const { t } = useTranslation('toeic');
  const { locale } = useParams<{ locale: string }>();
  const [days, setDays] = useState<number>(30);
  const [metric, setMetric] = useState<'score' | 'accuracy'>('score');
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['toeic-stats', days, timezone],
    queryFn: async () => {
      const res = await toeicService.getStats({ days: days || undefined, timezone });
      if (!res) throw new Error('stats');
      return res.data;
    },
    staleTime: 30_000,
  });

  const timeline = useMemo(() => fillDays(data?.timeline ?? [], days), [data, days]);
  const lang = dateLocale(locale);
  const shortDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' });
  const longDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(lang, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const pct = (value: number) => formatPercent(value, locale);
  const hasScore = timeline.some(
    (d) => d.avgScore != null || d.avgListeningScore != null || d.avgReadingScore != null,
  );
  const showScore = metric === 'score' && hasScore;
  const distribution = data?.scoreAvailable ? data.scoreDistribution : (data?.distribution ?? []);
  const distributionTotal = data?.scoreAvailable ? data.scoredAttempts : (data?.totalCompleted ?? 0);

  return (
    <PageShell>
      <PageHeader
        back={{ href: `/${locale}/toeic`, label: t('stats.back') }}
        title={t('stats.title')}
        description={t('stats.description')}
        actions={
          <div role="group" aria-label={t('stats.period_label')}>
            <Segmented
              value={days}
              onChange={setDays}
              items={PERIODS.map((value) => ({
                value: value as number,
                label: value ? t('stats.period_days', { count: value }) : t('stats.period_all'),
              }))}
            />
          </div>
        }
      />

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('stats.score_notice')}
      </p>

        {isLoading ? (
          <LoadingState label={t('stats.loading')} />
        ) : isError || !data ? (
          <ErrorState message={t('stats.error')} />
        ) : data.totalAttempts === 0 && !days ? (
          <EmptyState
            icon={BarChart3}
            title={t('stats.empty')}
            description={t('stats.empty_description')}
            action={
              <Button asChild>
                <Link href={`/${locale}/toeic`}>{t('stats.start')}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi
                label={t('stats.kpi_attempts')}
                value={String(data.totalAttempts)}
                change={relativeChange(data.totalAttempts, data.previous?.totalAttempts)}
                days={days}
              />
              <Kpi
                label={t('stats.kpi_time')}
                value={formatDuration(data.totalDuration, t)}
                change={relativeChange(data.totalDuration, data.previous?.totalDuration)}
                days={days}
              />
              <Kpi
                label={t('stats.kpi_score')}
                value={data.avgScore != null ? String(data.avgScore) : '—'}
                hint={
                  data.highestScore != null
                    ? t('stats.highest_score', { score: data.highestScore })
                    : t('stats.no_full_test')
                }
                change={
                  data.avgScore != null && data.previous?.avgScore != null
                    ? {
                        value: data.avgScore - data.previous.avgScore,
                        text: t('stats.points', {
                          value: Math.abs(data.avgScore - data.previous.avgScore),
                        }),
                      }
                    : null
                }
                days={days}
              />
              <Kpi
                label={t('stats.kpi_accuracy')}
                value={pct(data.avgAccuracy)}
                change={
                  data.previous?.totalCompleted && data.totalCompleted
                    ? {
                        value: data.avgAccuracy - data.previous.avgAccuracy,
                        text: t('stats.percent_points', {
                          value: Math.abs(data.avgAccuracy - data.previous.avgAccuracy).toFixed(1),
                        }),
                      }
                    : null
                }
                days={days}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel
                title={t(showScore ? 'stats.score_progress_title' : 'stats.progress_title')}
                className="lg:col-span-2"
                action={
                  hasScore && (
                    <Segmented
                      value={metric}
                      onChange={setMetric}
                      items={(['score', 'accuracy'] as const).map((value) => ({
                        value,
                        label: t(`stats.metric_${value}`),
                      }))}
                    />
                  )
                }
              >
                <Legend
                  items={[
                    { label: t('stats.overall'), color: SERIES_COLORS[0] },
                    { label: t('stats.listening'), color: SERIES_COLORS[1] },
                    { label: t('stats.reading'), color: SERIES_COLORS[2] },
                  ]}
                />
                {showScore ? (
                  timeline.some((d) => d.avgScore != null || d.avgListeningScore != null || d.avgReadingScore != null) ? (
                    <LineChart
                      labels={timeline.map((d) => shortDate(d.date))}
                      tooltipLabels={timeline.map((d) => longDate(d.date))}
                      max={990}
                      format={(v) => `${Math.round(v)}`}
                      series={[
                        { key: 'overall', label: t('stats.overall'), color: SERIES_COLORS[0], values: timeline.map((d) => d.avgScore) },
                        { key: 'listening', label: t('stats.listening'), color: SERIES_COLORS[1], values: timeline.map((d) => d.avgListeningScore) },
                        { key: 'reading', label: t('stats.reading'), color: SERIES_COLORS[2], values: timeline.map((d) => d.avgReadingScore) },
                      ]}
                    />
                  ) : (
                    <Empty />
                  )
                ) : timeline.some((d) => d.accuracy != null) ? (
                  <LineChart
                    labels={timeline.map((d) => shortDate(d.date))}
                    tooltipLabels={timeline.map((d) => longDate(d.date))}
                    format={(v) => `${Math.round(v)}%`}
                    series={[
                      { key: 'overall', label: t('stats.overall'), color: SERIES_COLORS[0], values: timeline.map((d) => d.accuracy) },
                      { key: 'listening', label: t('stats.listening'), color: SERIES_COLORS[1], values: timeline.map((d) => d.listeningAccuracy) },
                      { key: 'reading', label: t('stats.reading'), color: SERIES_COLORS[2], values: timeline.map((d) => d.readingAccuracy) },
                    ]}
                  />
                ) : (
                  <Empty />
                )}
              </Panel>

              <Panel title={t('stats.distribution_title')}>
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {distributionTotal}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">
                    {t(data.scoreAvailable ? 'stats.distribution_score_unit' : 'stats.distribution_unit')}
                  </span>
                </p>
                <ul className="space-y-3">
                  {distribution.map(({ band, count }) => {
                    const share = distributionTotal ? (count / distributionTotal) * 100 : 0;
                    return (
                      <li key={band} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">
                            {t(data.scoreAvailable ? `stats.score_band_${band}` : `stats.band_${band}`)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {count} <span className="font-normal text-slate-400">({Math.round(share)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: SERIES_COLORS[0] }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Panel title={t('stats.parts_title')} className="lg:col-span-3">
                {data.partResults.length ? (
                  <BarChart
                    labels={data.partResults.map((p) => `Part ${p.part}`)}
                    values={data.partResults.map((p) => p.accuracy)}
                    max={100}
                    format={(v) => `${Math.round(v)}%`}
                    tooltip={(i) => {
                      const p = data.partResults[i];
                      if (!p) return null;
                      return (
                        <>
                          <p className="font-semibold text-slate-700">Part {p.part}</p>
                          <p className="text-slate-600">
                            {t('stats.part_accuracy')}: <b className="text-slate-900">{pct(p.accuracy)}</b>
                          </p>
                          <p className="text-slate-600">
                            {p.correct} / {p.total} · {t('stats.part_answered', { count: p.answered })}
                          </p>
                        </>
                      );
                    }}
                  />
                ) : (
                  <Empty />
                )}
              </Panel>

              <Panel title={t('stats.study_time_title')} className="lg:col-span-2">
                {timeline.some((d) => d.duration > 0) ? (
                  <BarChart
                    labels={timeline.map((d) => shortDate(d.date))}
                    values={timeline.map((d) => Math.round(d.duration / 60))}
                    format={(v) => `${Math.round(v)}′`}
                    tooltip={(i) => (
                      <DayTooltip date={longDate(timeline[i]!.date)} value={formatDuration(timeline[i]!.duration, t)} />
                    )}
                  />
                ) : (
                  <Empty />
                )}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Panel title={t('stats.mode_title')} className="lg:col-span-2">
                <ModeSplit
                  rows={[
                    { label: t('history.tab_test'), count: data.testAttempts, color: SERIES_COLORS[0] },
                    { label: t('history.tab_practice'), count: data.practiceAttempts, color: SERIES_COLORS[1] },
                  ]}
                />
              </Panel>

              <Panel title={t('stats.attempts_title')} className="lg:col-span-3">
                {timeline.some((d) => d.attempts > 0) ? (
                  <BarChart
                    labels={timeline.map((d) => shortDate(d.date))}
                    values={timeline.map((d) => d.attempts)}
                    tooltip={(i) => (
                      <DayTooltip
                        date={longDate(timeline[i]!.date)}
                        value={t('stats.attempts_count', { count: timeline[i]!.attempts })}
                      />
                    )}
                  />
                ) : (
                  <Empty />
                )}
              </Panel>
            </div>
          </>
        )}
    </PageShell>
  );
}

function relativeChange(current: number, previous?: number) {
  if (!previous) return null;
  const value = ((current - previous) / previous) * 100;
  return { value, text: `${Math.abs(Math.round(value))}%` };
}

function Kpi({
  label,
  value,
  hint,
  change,
  days,
}: {
  label: string;
  value: string;
  hint?: string;
  change: { value: number; text: string } | null;
  days: number;
}) {
  const { t } = useTranslation('toeic');
  const up = (change?.value ?? 0) >= 0;
  return (
    <div className={cn(surface, 'p-5')}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {days > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {change ? (
            <>
              <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
                {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {change.text}
              </span>{' '}
              {t('stats.vs_previous', { count: days })}
            </>
          ) : (
            t('stats.no_previous')
          )}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  action,
  className = '',
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(surface, 'min-w-0 space-y-4 p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DayTooltip({ date, value }: { date: string; value: string }) {
  return (
    <>
      <p className="font-semibold text-slate-700">{date}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </>
  );
}

function Empty() {
  const { t } = useTranslation('toeic');
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">{t('stats.no_chart_data')}</div>
  );
}

function ModeSplit({ rows }: { rows: { label: string; count: number; color: string }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <Empty />;
  return (
    <div className="space-y-5">
      <p className="text-3xl font-bold tracking-tight text-slate-900">{total}</p>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {rows.map((row) =>
          row.count ? (
            <div
              key={row.label}
              title={`${row.label}: ${row.count}`}
              style={{ width: `${(row.count / total) * 100}%`, background: row.color }}
            />
          ) : null,
        )}
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-semibold text-slate-900">
              {row.count} <span className="font-normal text-slate-400">({Math.round((row.count / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
