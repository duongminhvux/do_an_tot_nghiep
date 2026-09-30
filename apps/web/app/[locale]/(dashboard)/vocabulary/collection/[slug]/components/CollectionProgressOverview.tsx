'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { CollectionProgressDetail } from '@/types/learning';

interface CollectionProgressOverviewProps {
  collectionProgress: CollectionProgressDetail | null;
  lessonsCount: number;
  totalWordsCount: number;
}

export function CollectionProgressOverview({
  collectionProgress,
  lessonsCount,
  totalWordsCount,
}: CollectionProgressOverviewProps) {
  const { t } = useTranslation('vocabulary');

  const masteredWords = collectionProgress?.masteredWords ?? 0;
  const learningWords = collectionProgress?.learningWords ?? 0;
  const unlearnedWords =
    collectionProgress?.unlearnedWords ??
    Math.max(0, totalWordsCount - masteredWords - learningWords);

  return (
    <div className="rounded border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">
          {t('collection_detail.your_progress')}
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold">
            {t('collection_detail.completed_lessons', {
              completed: collectionProgress?.completedLessonsCount || 0,
              total: lessonsCount,
            })}
          </span>
          <span className="font-bold text-blue-600">
            {collectionProgress?.overallProgress || 0}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
          style={{ width: `${collectionProgress?.overallProgress || 0}%` }}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="flex items-center gap-2.5 p-3 rounded bg-emerald-50/60 border border-emerald-100">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">
              {t('collection_detail.mastered')}
            </p>
            <p className="text-base font-black text-slate-900">
              {masteredWords}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded bg-amber-50/60 border border-amber-100">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">
              {t('collection_detail.learning')}
            </p>
            <p className="text-base font-black text-slate-900">
              {learningWords}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded bg-rose-50/60 border border-rose-100">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">
              {t('collection_detail.not_mastered')}
            </p>
            <p className="text-base font-black text-slate-900">
              {unlearnedWords}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded bg-blue-50/60 border border-blue-100">
          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">
              {t('collection_detail.study_time')}
            </p>
            <p className="text-sm font-black text-slate-900">
              {t('collection_detail.minutes_count', {
                count: collectionProgress?.studyMinutes ?? 0,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
