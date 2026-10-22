'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { CollectionProgressDetail } from '@/types/learning';
import { Panel } from '@/components/ui/page';

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

  const tiles = [
    { dot: 'bg-emerald-500', label: t('collection_detail.mastered'), value: masteredWords },
    { dot: 'bg-amber-500', label: t('collection_detail.learning'), value: learningWords },
    { dot: 'bg-red-500', label: t('collection_detail.not_mastered'), value: unlearnedWords },
  ];

  return (
    <Panel
      title={t('collection_detail.your_progress')}
      action={
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">
            {t('collection_detail.completed_lessons', {
              completed: collectionProgress?.completedLessonsCount || 0,
              total: lessonsCount,
            })}
          </span>
          <span className="font-bold text-blue-600">
            {collectionProgress?.overallProgress || 0}%
          </span>
        </div>
      }
      bodyClassName="space-y-4"
    >
      {/* Progress Bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${collectionProgress?.overallProgress || 0}%` }}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tile.dot}`} />
            <div>
              <p className="text-xs font-medium text-slate-500">{tile.label}</p>
              <p className="text-base font-bold text-slate-900">{tile.value}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Clock className="h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-medium text-slate-500">
              {t('collection_detail.study_time')}
            </p>
            <p className="text-sm font-bold text-slate-900">
              {t('collection_detail.minutes_count', {
                count: collectionProgress?.studyMinutes ?? 0,
              })}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
