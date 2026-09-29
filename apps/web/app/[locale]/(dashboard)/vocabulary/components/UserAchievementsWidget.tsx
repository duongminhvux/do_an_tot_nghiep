'use client';

import React from 'react';
import { Award, Flame, BookOpen, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardStudyStats } from '@/types/learning';

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
    <div className="rounded border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">{t('achievements_widget.title')}</h3>
        </div>
        <span className="text-[11px] text-slate-400">
          {t('achievements_widget.actual_badge')}
        </span>
      </div>

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
          <p className="text-lg font-black text-slate-900">
            {isLoading ? '...' : streak}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
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
          <p className="text-lg font-black text-slate-900">
            {isLoading ? '...' : totalLearned}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
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
          <p className="text-lg font-black text-slate-900">
            {isLoading ? '...' : totalMastered}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            {t('achievements_widget.words_mastered')}
          </p>
        </div>
      </div>

      {/* Encouragement message */}
      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
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
    </div>
  );
}
