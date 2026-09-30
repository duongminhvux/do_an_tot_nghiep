'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Layers,
  Sparkles,
  Target,
} from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Banner */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              <Target className="w-3.5 h-3.5" />
              <span>{t('collection_detail.learning_status')}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              {collectionProgress && collectionProgress.overallProgress >= 100
                ? t('collection_detail.status_completed_title')
                : collectionProgress && collectionProgress.overallProgress > 0
                  ? t('collection_detail.status_in_progress_title')
                  : t('collection_detail.status_not_started_title')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              {t('collection_detail.status_desc', {
                completed: collectionProgress?.completedLessonsCount || 0,
                total: lessons.length,
                words: masteredWords + learningWords,
                totalWords: totalWordsCount,
              })}
            </p>
          </div>

          {/* Overall Progress Gauge Box */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs shrink-0 self-start md:self-auto">
            <div className="w-14 h-14 rounded-full bg-blue-50 border-4 border-blue-600 flex items-center justify-center shrink-0">
              <span className="text-base font-extrabold text-blue-700">
                {collectionProgress?.overallProgress || 0}%
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                {t('collection_detail.completion_rate')}
              </span>
              <span className="text-sm font-bold text-slate-900">
                {collectionProgress?.completedLessonsCount || 0} / {lessons.length}{' '}
                {t('collection_detail.stat_lessons').toLowerCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-blue-100/80">
          <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium block">
              {t('collection_detail.study_time_accumulated')}
            </span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              ⏱️ {formatMinutes(collectionProgress?.studyMinutes)}
            </span>
          </div>
          <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium block">
              {t('collection_detail.completed_lessons_stat')}
            </span>
            <span className="text-sm font-bold text-emerald-600 mt-0.5 block">
              ✓ {collectionProgress?.completedLessonsCount || 0} / {lessons.length}
            </span>
          </div>
          <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium block">
              {t('collection_detail.mastered_words_stat')}
            </span>
            <span className="text-sm font-bold text-blue-600 mt-0.5 block">
              ★ {masteredWords} {t('collection_detail.stat_words').toLowerCase()}
            </span>
          </div>
          <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium block">
              {t('collection_detail.learning_words_stat')}
            </span>
            <span className="text-sm font-bold text-amber-600 mt-0.5 block">
              🔄 {learningWords} {t('collection_detail.stat_words').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Word Distribution Breakdown Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>{t('collection_detail.distribution_title')}</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('collection_detail.distribution_subtitle')}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {totalWordsCount} {t('collection_detail.stat_words').toLowerCase()}
          </span>
        </div>

        {/* Stacked Multi-segment Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
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

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* 3 Detail Cards for Words Distribution */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Mastered */}
          <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 flex items-start justify-between">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {t('collection_detail.mastered')}
              </span>
              <p className="text-[11px] text-slate-500 leading-tight">
                {t('collection_detail.mastered_desc')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-emerald-700 block">
                {masteredWords}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 block">
                {masteredPercent}%
              </span>
            </div>
          </div>

          {/* Learning */}
          <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 flex items-start justify-between">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                {t('collection_detail.learning')}
              </span>
              <p className="text-[11px] text-slate-500 leading-tight">
                {t('collection_detail.learning_desc')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-amber-700 block">
                {learningWords}
              </span>
              <span className="text-[10px] font-bold text-amber-600 block">
                {learningPercent}%
              </span>
            </div>
          </div>

          {/* Unlearned */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                {t('collection_detail.not_mastered')}
              </span>
              <p className="text-[11px] text-slate-500 leading-tight">
                {t('collection_detail.unlearned_desc')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-slate-800 block">
                {unlearnedWords}
              </span>
              <span className="text-[10px] font-bold text-slate-500 block">
                {unlearnedPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Lesson-by-lesson Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{t('collection_detail.lessons_breakdown_title')}</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('collection_detail.lessons_breakdown_subtitle')}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {lessons.length} {t('collection_detail.stat_lessons')}
          </span>
        </div>

        {/* Table / List of Lessons with progress */}
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {lessons.map((lesson, idx) => {
            const lessonProgData = lessonProgressMap.get(String(lesson._id));
            const prog = lessonProgData?.progress || 0;
            const st = lessonProgData?.status || 'NOT_STARTED';
            const unitLabel = `Unit ${idx + 1}`;

            return (
              <div
                key={lesson._id}
                className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-blue-600 uppercase">
                        {unitLabel}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {lesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{t('collection_detail.words_unit_count', { count: lesson.wordsCount || 0 })}</span>
                      {lesson.sectionsCount !== undefined && lesson.sectionsCount > 0 && (
                        <span>• {t('collection_detail.sections_count', { count: lesson.sectionsCount })}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status badge & progress bar & Action button */}
                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                  <div className="w-28 sm:w-36 space-y-1 text-right">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span
                        className={`text-[10px] font-bold ${
                          st === 'COMPLETED'
                            ? 'text-emerald-600'
                            : st === 'IN_PROGRESS'
                              ? 'text-blue-600'
                              : 'text-slate-400'
                        }`}
                      >
                        {st === 'COMPLETED'
                          ? `✓ ${t('collection_detail.status_completed')}`
                          : st === 'IN_PROGRESS'
                            ? t('collection_detail.status_in_progress', { prog })
                            : t('collection_detail.status_not_started')}
                      </span>
                      <span className="text-slate-700">{prog}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                  </div>

                  <Link
                    href={`/${locale}/vocabulary/collection/${slug}/lesson/${lesson.slug || lesson._id}`}
                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-colors shrink-0"
                  >
                    {st === 'COMPLETED'
                      ? t('collection_detail.action_review')
                      : st === 'IN_PROGRESS'
                        ? t('collection_detail.action_continue')
                        : t('collection_detail.action_start')}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
