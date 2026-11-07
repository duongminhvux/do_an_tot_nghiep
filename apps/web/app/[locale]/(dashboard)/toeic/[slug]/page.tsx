'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileQuestion,
  Headphones,
  Layers,
  PlayCircle,
  RotateCcw,
  Rocket,
  Search,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import {
  toeicService,
  ToeicExamSummary,
  ToeicAttemptSummary,
} from '@/services/toeic.service';
import { Button } from '@/components/ui/button';
import { EmptyState, PageShell, Segmented, tones, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/redux/hooks';
import { groupAttemptProgress } from '@/features/toeic/attempt/group-progress';

function unwrapArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  return [];
}

function unwrapOne<T>(value: any): T | null {
  if (!value) return null;
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    return value.data as T;
  }
  return value as T;
}

// Icon map for preset slugs
const PRESET_ICON_MAP: Record<string, { icon: any; tone: Tone }> = {
  'basic-listening': { icon: Headphones, tone: 'blue' },
  'basic-reading': { icon: BookOpen, tone: 'emerald' },
  'practice-tests': { icon: Layers, tone: 'violet' },
  'by-level': { icon: Award, tone: 'amber' },
  'by-topic': { icon: Target, tone: 'pink' },
  advanced: { icon: Rocket, tone: 'red' },
};
const DEFAULT_ICON: { icon: any; tone: Tone } = { icon: Headphones, tone: 'blue' };

type Status = 'not_started' | 'in_progress' | 'completed';
type Filter = 'all' | Status;
type Sort = 'default' | 'az' | 'newest';

const STATUS_STYLE: Record<Status, { badge: string; bar: string; dot: string }> = {
  not_started: { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-200', dot: 'bg-slate-400' },
  in_progress: { badge: 'bg-blue-50 text-blue-700', bar: 'bg-blue-600', dot: 'bg-blue-600' },
  completed: { badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
};

/** Progress ring for the hero (completed exams / all exams). */
function ProgressRing({ value, label }: { value: number; label: React.ReactNode }) {
  const R = 34;
  const circ = 2 * Math.PI * R;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
          className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{label}</div>
    </div>
  );
}

export default function ToeicGroupDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const { t } = useTranslation('toeic');
  const userId = useAppSelector((state) => state.auth.user?._id);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const [search, setSearch] = useState('');

  const { data: groupData, isLoading: isGroupLoading, isError: isGroupError } = useQuery({
    queryKey: ['toeic-group-detail', slug],
    queryFn: () => toeicService.getGroupBySlugOrId(slug),
    enabled: !!slug,
  });
  const { data: groupExamsData, isLoading: isGroupExamsLoading } = useQuery({
    queryKey: ['toeic-group-exams', slug],
    queryFn: () => toeicService.getGroupExams(slug),
    enabled: !!slug,
  });
  const {
    data: attemptsData,
    isError: isProgressError,
    isPending: isProgressPending,
    refetch: retryProgress,
  } = useQuery({
    queryKey: ['toeic-group-progress', slug, userId],
    queryFn: () => toeicService.getGroupProgress(slug),
    enabled: !!slug && !!userId,
    staleTime: 15_000,
  });

  const group = unwrapOne<any>(groupData);
  const rawExams = unwrapArray<ToeicExamSummary>(groupExamsData);
  const rawAttempts = unwrapArray<ToeicAttemptSummary>(attemptsData);

  const groupName = group?.name || slug;
  const groupDescription = group?.description || t('pages.group_description');
  const iconConfig = PRESET_ICON_MAP[slug] ?? DEFAULT_ICON;
  const GroupIcon = iconConfig.icon;

  // Latest attempt per exam (the API returns newest first).
  const attemptsMap = useMemo(() => {
    const map = new Map<string, ToeicAttemptSummary>();
    rawAttempts.forEach((att) => {
      const examId = typeof att.examId === 'object' && att.examId ? (att.examId as any)._id : (att.examId as string);
      if (examId && !map.has(examId)) map.set(examId, att);
    });
    return map;
  }, [rawAttempts]);

  // Admin order first (drag & drop in the group), then global order, then newest.
  const exams = useMemo(() => {
    const ordered = [...rawExams].sort(
      (a, b) =>
        (a.groupOrder ?? 0) - (b.groupOrder ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    return ordered.map((exam, index) => {
      const attempt = attemptsMap.get(exam._id);
      const progress = groupAttemptProgress(attempt);
      const status: Status = progress.completed ? 'completed' : progress.inProgress ? 'in_progress' : 'not_started';
      return { exam, attempt, progress, status, number: index + 1 };
    });
  }, [rawExams, attemptsMap]);

  const counts = useMemo(
    () => ({
      all: exams.length,
      not_started: exams.filter((e) => e.status === 'not_started').length,
      in_progress: exams.filter((e) => e.status === 'in_progress').length,
      completed: exams.filter((e) => e.status === 'completed').length,
    }),
    [exams],
  );
  const totalQuestions = exams.reduce((sum, e) => sum + (e.exam.totalQuestions || 0), 0);
  const totalAttempts = rawExams.reduce((acc, exam) => acc + (exam.totalAttempts ?? 0), 0);
  const completedPercent = exams.length ? Math.round((counts.completed / exams.length) * 100) : 0;
  // Resume an unfinished test first, otherwise the first one not started yet.
  const next = exams.find((e) => e.status === 'in_progress') ?? exams.find((e) => e.status === 'not_started');

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = exams.filter(
      (e) =>
        (filter === 'all' || e.status === filter) &&
        (!keyword || `${e.exam.name} ${e.exam.description ?? ''}`.toLowerCase().includes(keyword)),
    );
    if (sort === 'az') return [...list].sort((a, b) => a.exam.name.localeCompare(b.exam.name, locale));
    if (sort === 'newest')
      return [...list].sort((a, b) => new Date(b.exam.createdAt || 0).getTime() - new Date(a.exam.createdAt || 0).getTime());
    return list;
  }, [exams, filter, search, sort, locale]);

  const isLoading = isGroupLoading || isGroupExamsLoading;
  const examHref = (exam: ToeicExamSummary) => `/${locale}/toeic/${slug}/${exam.slug || exam._id}`;

  if (!isGroupLoading && (isGroupError || (!isLoading && !group && rawExams.length === 0))) {
    return (
      <PageShell>
        <EmptyState
          icon={AlertCircle}
          title={t('pages.group_not_found')}
          description={t('pages.group_not_found_description')}
          action={
            <Button asChild>
              <Link href={`/${locale}/toeic`}>{t('pages.back_to_toeic')}</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href={`/${locale}/toeic`} className="hover:text-blue-600">
          {t('group_detail.breadcrumb_toeic')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="truncate font-medium text-slate-700">{isLoading ? '…' : groupName}</span>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg shadow-blue-900/10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className={cn("relative grid gap-6 p-5 sm:p-7 lg:items-center", exams.length > 0 && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-50 ring-1 ring-inset ring-white/20">
              <GroupIcon className="h-3.5 w-3.5" />
              {t('group_detail.hero_kicker')}
            </p>
            {isLoading ? (
              <div className="mt-3 space-y-2">
                <span className="block h-9 w-64 animate-pulse rounded-lg bg-white/20" />
                <span className="block h-4 w-80 max-w-full animate-pulse rounded bg-white/15" />
              </div>
            ) : (
              <>
                <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{groupName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">{groupDescription}</p>
              </>
            )}
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {[
                { icon: Layers, label: t('group_detail.in_group'), value: t('group_detail.exam_count', { count: exams.length }) },
                { icon: FileQuestion, label: t('group_detail.total_questions'), value: totalQuestions.toLocaleString(locale) },
                { icon: Users, label: t('group_detail.attempts_label'), value: totalAttempts.toLocaleString(locale) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-blue-200">{label}</dt>
                    <dd className="font-semibold">{isLoading ? '…' : value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Personal progress + next step (only when the set has tests) */}
          {exams.length > 0 && (
          <div className="rounded-xl bg-white/10 p-4 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <ProgressRing value={completedPercent} label={`${completedPercent}%`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">{t('group_detail.progress_title')}</p>
                <p className="mt-1 text-sm font-semibold">
                  {t('group_detail.progress_summary', { done: counts.completed, total: exams.length })}
                </p>
                {counts.in_progress > 0 && (
                  <p className="mt-0.5 text-xs text-blue-100">{t('group_detail.progress_in_progress', { count: counts.in_progress })}</p>
                )}
              </div>
            </div>
            {next ? (
              <Link
                href={examHref(next.exam)}
                className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {next.status === 'in_progress' ? t('group_detail.btn_continue') : t('group_detail.next_up')}
                  </span>
                  <span className="block truncate">{next.exam.name}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            ) : exams.length > 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-400/20 px-4 py-3 text-sm font-semibold ring-1 ring-inset ring-emerald-200/30">
                <Trophy className="h-4 w-4" />
                {t('group_detail.all_done')}
              </p>
            ) : null}
          </div>
          )}
        </div>
      </section>

      {isProgressError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">{t('group_detail.progress_error')}</p>
          <Button variant="outline" size="sm" onClick={() => void retryProgress()}>
            {t('community.retry')}
          </Button>
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && exams.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            items={(['all', 'not_started', 'in_progress', 'completed'] as const).map((value) => ({
              value,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {value === 'all' ? t('group_detail.filter_all') : t(`group_detail.status_${value}`)}
                  <span className="rounded-full bg-slate-200/80 px-1.5 text-[10px] font-bold text-slate-600">{counts[value]}</span>
                </span>
              ),
            }))}
          />
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
              <span className="sr-only">{t('group_detail.search_placeholder')}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('group_detail.search_placeholder')}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </label>
            <label className="shrink-0">
              <span className="sr-only">{t('group_detail.sort_label')}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="default">{t('group_detail.sort_default')}</option>
                <option value="az">{t('group_detail.sort_az')}</option>
                <option value="newest">{t('group_detail.sort_newest')}</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Exams */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('modals.group_exams.loading')}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', tones[iconConfig.tone])}>
            <GroupIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-slate-900">{t('modals.group_exams.empty_title')}</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">{t('modals.group_exams.empty_desc')}</p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={`/${locale}/toeic`}>{t('group_detail.browse_other_groups')}</Link>
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">{t('group_detail.no_match')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setFilter('all');
              setSearch('');
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('group_detail.clear_filters')}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ exam, attempt, progress, status, number }) => {
            const style = STATUS_STYLE[status];
            const score = status === 'completed' && typeof attempt?.score === 'number' ? attempt.score : null;
            return (
              <li key={exam._id}>
                <Link
                  href={examHref(exam)}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn('flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none', tones[iconConfig.tone])}>
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{t('group_detail.test_label')}</span>
                      <span className="mt-0.5 text-lg font-bold tabular-nums">{String(number).padStart(2, '0')}</span>
                    </span>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', style.badge)}>
                      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                      {userId && isProgressPending && !isProgressError
                        ? t('community.loading')
                        : isProgressError
                          ? t('group_detail.progress_unavailable')
                          : t(`group_detail.status_${status}`)}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-blue-700">
                    {exam.name}
                  </h3>
                  {exam.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{exam.description}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {(exam.totalQuestions ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileQuestion className="h-3.5 w-3.5" />
                        {t('group_detail.questions_count', { count: exam.totalQuestions })}
                      </span>
                    )}
                    {(exam.durationMinutes ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t('group_detail.mins_duration', { count: exam.durationMinutes })}
                      </span>
                    )}
                    {(exam.totalAttempts ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t('group_detail.attempts_count', { count: exam.totalAttempts })}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                      <span>
                        {status === 'in_progress'
                          ? t('group_detail.answered', { answered: progress.answered, total: progress.total })
                          : score !== null
                            ? `${t('group_detail.score_label')}: ${score}${attempt?.scoreMax ? `/${attempt.scoreMax}` : ''}`
                            : t(status === 'not_started' ? 'group_detail.no_attempt_yet' : `group_detail.status_${status}`)}
                      </span>
                      <span className="tabular-nums">{Math.round(progress.percent)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full transition-[width] duration-500', style.bar)} style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span
                      className={cn(
                        'mt-4 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                        status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'
                          : 'bg-blue-600 text-white group-hover:bg-blue-700',
                      )}
                    >
                      {status === 'completed' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {t('group_detail.btn_view_result')}
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4" />
                          {status === 'in_progress' ? t('group_detail.btn_continue') : t('group_detail.btn_start')}
                        </>
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
