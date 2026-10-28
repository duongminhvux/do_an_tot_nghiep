'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Headphones,
  BookOpen,
  Layers,
  FileText,
  BarChart2,
  CheckCircle2,
  Clock,
  Sparkles,
  Package,
  Award,
  Target,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import {
  toeicService,
  ToeicExamSummary,
  ToeicAttemptSummary,
} from '@/services/toeic.service';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  PageShell,
  StatCard,
  surface,
  tones,
  type Tone,
} from '@/components/ui/page';
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
  advanced: { icon: Sparkles, tone: 'red' },
};

const DEFAULT_ICON: { icon: any; tone: Tone } = { icon: Headphones, tone: 'blue' };

export default function ToeicGroupDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const { t } = useTranslation('toeic');
  const userId=useAppSelector(state=>state.auth.user?._id);



  // 1. Fetch group detail by slug or id
  const { data: groupData, isLoading: isGroupLoading, isError: isGroupError } = useQuery({
    queryKey: ['toeic-group-detail', slug],
    queryFn: () => toeicService.getGroupBySlugOrId(slug),
    enabled: !!slug,
  });

  // 2. Fetch exams belonging to this group
  const { data: groupExamsData, isLoading: isGroupExamsLoading } = useQuery({
    queryKey: ['toeic-group-exams', slug],
    queryFn: () => toeicService.getGroupExams(slug),
    enabled: !!slug,
  });

  // 3. Fetch user attempts for progress status
  const { data: attemptsData,isError:isProgressError,isPending:isProgressPending,refetch:retryProgress } = useQuery({
    queryKey: ['toeic-group-progress',slug,userId],
    queryFn: () => toeicService.getGroupProgress(slug),
    enabled:!!slug&&!!userId,
    staleTime: 15_000,
  });

  const group = unwrapOne<any>(groupData);
  const rawExams = unwrapArray<ToeicExamSummary>(groupExamsData);
  const rawAttempts = unwrapArray<ToeicAttemptSummary>(attemptsData);

  const groupName = group?.name || slug;
  const groupDescription =
    group?.description ||
    t('pages.group_description');
  const groupExamCount = group?.examCount ?? rawExams.length;

  const iconConfig = PRESET_ICON_MAP[slug] ?? DEFAULT_ICON;
  const GroupIcon = iconConfig.icon;

  // Build attempts map: examId -> latest attempt
  const attemptsMap = useMemo(() => {
    const map = new Map<string, ToeicAttemptSummary>();
    rawAttempts.forEach((att) => {
      const examId =
        typeof att.examId === 'object' && att.examId
          ? (att.examId as any)._id
          : (att.examId as string);
      if (examId && !map.has(examId)) {
        map.set(examId, att);
      }
    });
    return map;
  }, [rawAttempts]);

  // Total completed attempts in this group
  const totalAttempts = useMemo(() => {
    return rawExams.reduce((acc, exam) => acc + (exam.totalAttempts ?? 0), 0);
  }, [rawExams]);

  // Order chosen by admins (drag & drop in the group); exams placed before
  // that existed (groupOrder 0) fall back to their global order.
  const sortedExams = useMemo(() => {
    return [...rawExams].sort(
      (a, b) =>
        (a.groupOrder ?? 0) - (b.groupOrder ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [rawExams]);

  const isLoading = isGroupLoading || isGroupExamsLoading;

  // Error: group not found
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
      <PageHeader
        breadcrumbs={[
          { label: t('group_detail.breadcrumb_toeic'), href: `/${locale}/toeic` },
          { label: isLoading ? '...' : groupName },
        ]}
        icon={GroupIcon}
        title={isLoading ? <span className="inline-block animate-pulse rounded-md bg-slate-100 align-middle h-8 w-48" /> : groupName}
        description={isLoading ? <span className="inline-block animate-pulse rounded-md bg-slate-100 align-middle h-4 w-72" /> : groupDescription}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          tone="blue"
          label={t('group_detail.in_group')}
          value={isLoading ? <span className="inline-block animate-pulse rounded-md bg-slate-100 align-middle h-7 w-16" /> : `${groupExamCount} ${t('group_detail.total_exams_label')}`}
        />
        <StatCard
          icon={BarChart2}
          tone="violet"
          label={t('group_detail.attempts_label')}
          value={isLoading ? <span className="inline-block animate-pulse rounded-md bg-slate-100 align-middle h-7 w-16" /> : totalAttempts}
        />
      </div>

      {isProgressError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{t('group_detail.progress_error')}</p><Button variant="outline" size="sm" onClick={()=>void retryProgress()}>{t('community.retry')}</Button></div>}
      {isLoading ? (
        <Card>
          <LoadingState label={t('modals.group_exams.loading')} />
        </Card>
      ) : sortedExams.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('modals.group_exams.empty_title')}
          description={t('modals.group_exams.empty_desc')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedExams.map((exam, index) => {
            const attempt = attemptsMap.get(exam._id);
            const progress=groupAttemptProgress(attempt);
            const isCompleted = progress.completed;
            const isInProgress = progress.inProgress;
            const isNew = index === 0;

            const totalQ = exam.totalQuestions || 0;
            const answeredQ = progress.answered;

            const examSlug = exam.slug || exam._id;
            const href = `/${locale}/toeic/${slug}/${examSlug}`;

            // Circular progress ring
            const R = 18;
            const circ = 2 * Math.PI * R;
            const progressVal = progress.percent;
            const dash = (progressVal / 100) * circ;
            const ringColor = isCompleted ? '#10b981' : isInProgress ? '#2563eb' : '#e2e8f0';

            return (
              <Link
                key={exam._id}
                href={href}
                className={cn(
                  surface,
                  'group flex flex-col gap-4 p-5 transition-all hover:border-blue-300 hover:shadow-md',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tones[iconConfig.tone])}>
                    <GroupIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-blue-600">
                      {exam.name}
                    </h3>
                    {isNew && (
                      <Badge tone="red" className="mt-1">
                        {t('group_detail.new_badge')}
                      </Badge>
                    )}
                    {exam.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{exam.description}</p>
                    )}
                  </div>

                  {/* Circular Progress Ring */}
                  <div className="relative flex shrink-0 items-center justify-center" style={{ width: 44, height: 44 }}>
                    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="22" cy="22" r={R} fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle
                        cx="22"
                        cy="22"
                        r={R}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        style={{ transition: 'stroke-dasharray 0.4s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : isInProgress ? (
                        <span className="text-[11px] font-semibold leading-none text-blue-600">
                          {Math.round(progressVal)}%
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium leading-none text-slate-400">0%</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {totalQ > 0 && (
                      <span className="flex items-center gap-1">
                        <FileQuestion className="h-3.5 w-3.5" />
                        {totalQ} câu
                      </span>
                    )}
                    {exam.durationMinutes && exam.durationMinutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {exam.durationMinutes} {t('pages.minutes')}
                      </span>
                    )}
                  </div>

                  {isCompleted ? (
                    <span className="text-xs font-semibold text-emerald-600">
                      {t('group_detail.status_completed')}
                    </span>
                  ) : isInProgress ? (
                    <span className="text-xs font-semibold text-blue-600">
                      {answeredQ}/{progress.total} {t('pages.questions')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">{t(isProgressError?'group_detail.progress_unavailable':isProgressPending?'community.loading':'group_detail.status_not_started')}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
