'use client';

import React from 'react';
import { Award, Flame, BookOpen, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardStudyStats } from '@/types/learning';
import { Panel } from '@/components/ui/page';

interface UserAchievementsWidgetProps {
  stats?: DashboardStudyStats;
  isLoading?: boolean;
}

export function UserAchievementsWidget({
  stats,
  isLoading = false,
}: UserAchievementsWidgetProps) {
  const { t } = useTranslation('vocabulary');
  const streak = stats?.streak ?? 0;
  const totalLearned = stats?.totalLearnedWords ?? 0;
  const totalMastered = stats?.totalMasteredWords ?? 0;

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-600" />
          {t('achievements_widget.title')}
        </span>
      }
      action={
        <span className="text-xs text-slate-500">
          {t('achievements_widget.actual_badge')}
        </span>
      }
      bodyClassName="space-y-4"
    >

      {/* 3 Columns */}
      <div className="grid grid-cols-3 gap-2 text-center py-1">
        {/* Streak */}
        <div className="space-y-1">
          <Flame
            className={`w-5 h-5 mx-auto transition-colors ${
              streak > 0
                ? 'text-amber-500 fill-amber-500/20'
                : 'text-slate-300'
            }`}
          />
          <p className="text-lg font-bold text-slate-900">
            {isLoading ? '...' : streak}
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {t('achievements_widget.days_streak')}
          </p>
        </div>

        {/* Learned Words */}
        <div className="space-y-1 border-x border-slate-100">
          <BookOpen
            className={`w-5 h-5 mx-auto transition-colors ${
              totalLearned > 0 ? 'text-blue-500' : 'text-slate-300'
            }`}
          />
          <p className="text-lg font-bold text-slate-900">
            {isLoading ? '...' : totalLearned}
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {t('achievements_widget.words_learned')}
          </p>
        </div>

        {/* Mastered Words */}
        <div className="space-y-1">
          <Star
            className={`w-5 h-5 mx-auto transition-colors ${
              totalMastered > 0
                ? 'text-amber-400 fill-amber-400/20'
                : 'text-slate-300'
            }`}
          />
          <p className="text-lg font-bold text-slate-900">
            {isLoading ? '...' : totalMastered}
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            {t('achievements_widget.words_mastered')}
          </p>
        </div>
      </div>

      {/* Encouragement message */}
      <p className="text-center text-xs text-slate-500">
        {isLoading ? (
          t('achievements_widget.loading')
        ) : totalLearned === 0 ? (
          t('achievements_widget.empty_msg')
        ) : streak > 0 ? (
          t('achievements_widget.streak_msg', { streak })
        ) : (
          t('achievements_widget.words_msg', { count: totalLearned })
        )}
      </p>
    </Panel>
  );
}
