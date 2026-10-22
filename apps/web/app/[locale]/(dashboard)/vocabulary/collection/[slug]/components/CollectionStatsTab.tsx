'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Star,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Panel, tones } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { LessonItem } from '@/types/vocabulary';
import { CollectionProgressDetail } from '@/types/learning';

interface CollectionStatsTabProps {
  collectionProgress: CollectionProgressDetail | null;
  lessons: LessonItem[];
  lessonProgressMap: Map<string, { progress: number; status: string }>;
  totalWordsCount: number;
  slug: string;
  locale: string;
}

export function CollectionStatsTab({
  collectionProgress,
  lessons,
  lessonProgressMap,
  totalWordsCount,
  slug,
  locale,
}: CollectionStatsTabProps) {
  const { t } = useTranslation('vocabulary');

  const formatMinutes = (totalMins: number = 0) => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins} phút`;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  const masteredWords = collectionProgress?.masteredWords || 0;
  const learningWords = collectionProgress?.learningWords || 0;
  const unlearnedWords =
    collectionProgress?.unlearnedWords ??
    Math.max(0, totalWordsCount - masteredWords - learningWords);
  const totalW = totalWordsCount > 0 ? totalWordsCount : 1;
  const masteredPercent = Math.min(
    100,
    Math.round((masteredWords / totalW) * 100),
  );
  const learningPercent = Math.min(
    100,
    Math.round((learningWords / totalW) * 100),
  );
  const unlearnedPercent = Math.max(0, 100 - masteredPercent - learningPercent);

  const metrics = [
    {
      icon: Clock,
      tone: 'blue' as const,
      label: t('collection_detail.study_time_accumulated'),
      value: formatMinutes(collectionProgress?.studyMinutes),
    },
    {
      icon: CheckCircle2,
      tone: 'emerald' as const,
      label: t('collection_detail.completed_lessons_stat'),
      value: `${collectionProgress?.completedLessonsCount || 0} / ${lessons.length}`,
    },
    {
      icon: Star,
      tone: 'blue' as const,
      label: t('collection_detail.mastered_words_stat'),
      value: `${masteredWords} ${t('collection_detail.stat_words').toLowerCase()}`,
    },
    {
      icon: RotateCcw,
      tone: 'amber' as const,
      label: t('collection_detail.learning_words_stat'),
      value: `${learningWords} ${t('collection_detail.stat_words').toLowerCase()}`,
    },
  ];

  const distribution = [
    {
      dot: 'bg-emerald-500',
      label: t('collection_detail.mastered'),
      desc: t('collection_detail.mastered_desc'),
      value: masteredWords,
      percent: masteredPercent,
      valueClass: 'text-emerald-700',
    },
    {
      dot: 'bg-amber-500',
      label: t('collection_detail.learning'),
      desc: t('collection_detail.learning_desc'),
      value: learningWords,
      percent: learningPercent,
      valueClass: 'text-amber-700',
    },
    {
      dot: 'bg-slate-300',
      label: t('collection_detail.not_mastered'),
      desc: t('collection_detail.unlearned_desc'),
      value: unlearnedWords,
      percent: unlearnedPercent,
      valueClass: 'text-slate-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Overview */}
      <Panel>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl space-y-2">
            <Badge tone="blue">
              <Target className="h-3.5 w-3.5" />
              {t('collection_detail.learning_status')}
            </Badge>
            <h3 className="text-base font-semibold text-slate-900">
              {collectionProgress && collectionProgress.overallProgress >= 100
                ? t('collection_detail.status_completed_title')
                : collectionProgress && collectionProgress.overallProgress > 0
                  ? t('collection_detail.status_in_progress_title')
                  : t('collection_detail.status_not_started_title')}
            </h3>
            <p className="text-sm text-slate-500">
              {t('collection_detail.status_desc', {
                completed: collectionProgress?.completedLessonsCount || 0,
                total: lessons.length,
                words: masteredWords + learningWords,
                totalWords: totalWordsCount,
              })}
            </p>
          </div>

          {/* Overall Progress Gauge Box */}
          <div className="flex shrink-0 items-center gap-4 self-start rounded-lg border border-slate-200 bg-slate-50 p-4 md:self-auto">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-blue-600 bg-white">
              <span className="text-base font-bold text-blue-700">
                {collectionProgress?.overallProgress || 0}%
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('collection_detail.completion_rate')}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {collectionProgress?.completedLessonsCount || 0} / {lessons.length}{' '}
                {t('collection_detail.stat_lessons').toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Summary Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tones[m.tone])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-500">{m.label}</span>
                  <span className="block truncate text-sm font-bold text-slate-900">{m.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 2. Word Distribution Breakdown */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            {t('collection_detail.distribution_title')}
          </span>
        }
        description={t('collection_detail.distribution_subtitle')}
        action={
          <span className="text-xs font-medium text-slate-500">
            {totalWordsCount} {t('collection_detail.stat_words').toLowerCase()}
          </span>
        }
        bodyClassName="space-y-4"
      >
        {/* Stacked Multi-segment Bar */}
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {masteredPercent > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${masteredPercent}%` }}
                title={`${t('collection_detail.mastered')}: ${masteredWords} (${masteredPercent}%)`}
              />
            )}
            {learningPercent > 0 && (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${learningPercent}%` }}
                title={`${t('collection_detail.learning')}: ${learningWords} (${learningPercent}%)`}
              />
            )}
            {unlearnedPercent > 0 && (
              <div
                className="h-full bg-slate-200 transition-all duration-500"
                style={{ width: `${unlearnedPercent}%` }}
                title={`${t('collection_detail.not_mastered')}: ${unlearnedWords} (${unlearnedPercent}%)`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {distribution.map((d) => (
            <div key={d.label} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <span className={cn('h-2.5 w-2.5 rounded-full', d.dot)} />
                  {d.label}
                </span>
                <p className="text-xs leading-tight text-slate-500">{d.desc}</p>
              </div>
              <div className="text-right">
                <span className={cn('block text-base font-bold', d.valueClass)}>{d.value}</span>
                <span className="block text-[11px] font-semibold text-slate-500">{d.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 3. Detailed Lesson-by-lesson Breakdown */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            {t('collection_detail.lessons_breakdown_title')}
          </span>
        }
        description={t('collection_detail.lessons_breakdown_subtitle')}
        action={
          <span className="text-xs font-medium text-slate-500">
            {lessons.length} {t('collection_detail.stat_lessons')}
          </span>
        }
      >
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {lessons.map((lesson, idx) => {
            const lessonProgData = lessonProgressMap.get(String(lesson._id));
            const prog = lessonProgData?.progress || 0;
            const st = lessonProgData?.status || 'NOT_STARTED';
            const unitLabel = `Unit ${idx + 1}`;

            return (
              <div
                key={lesson._id}
                className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                        {unitLabel}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {lesson.title}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                      <span>{t('collection_detail.words_unit_count', { count: lesson.wordsCount || 0 })}</span>
                      {lesson.sectionsCount !== undefined && lesson.sectionsCount > 0 && (
                        <span>• {t('collection_detail.sections_count', { count: lesson.sectionsCount })}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <div className="w-28 space-y-1 text-right sm:w-36">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          st === 'COMPLETED'
                            ? 'text-emerald-600'
                            : st === 'IN_PROGRESS'
                              ? 'text-blue-600'
                              : 'text-slate-400',
                        )}
                      >
                        {st === 'COMPLETED' && <CheckCircle2 className="h-3 w-3" />}
                        {st === 'COMPLETED'
                          ? t('collection_detail.status_completed')
                          : st === 'IN_PROGRESS'
                            ? t('collection_detail.status_in_progress', { prog })
                            : t('collection_detail.status_not_started')}
                      </span>
                      <span className="text-slate-700">{prog}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary',
                        )}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  </div>

                  <Button asChild size="sm" variant={st === 'COMPLETED' ? 'outline' : 'secondary'} className="shrink-0">
                    <Link href={`/${locale}/vocabulary/collection/${slug}/lesson/${lesson.slug || lesson._id}`}>
                      {st === 'COMPLETED'
                        ? t('collection_detail.action_review')
                        : st === 'IN_PROGRESS'
                          ? t('collection_detail.action_continue')
                          : t('collection_detail.action_start')}
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
