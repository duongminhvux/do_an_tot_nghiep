'use client';

import React from 'react';
import Link from 'next/link';
import { Target, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardStudyStats } from '@/types/learning';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/page';

interface TodayStudyWidgetProps {
  stats?: DashboardStudyStats;
  isLoading?: boolean;
  locale?: string;
  onStartClick?: () => void;
}

export function TodayStudyWidget({
  stats,
  isLoading = false,
  locale = 'vi',
  onStartClick,
}: TodayStudyWidgetProps) {
  const { t } = useTranslation('vocabulary');
  const dailyGoal = stats?.dailyGoal ?? 20;
  const todayLearned = stats?.todayLearnedCount ?? 0;
  const progressPercent = Math.min(100, Math.round((todayLearned / dailyGoal) * 100));

  const continueLesson = stats?.continueLesson;
  const hasContinue = Boolean(continueLesson?.lessonSlug && continueLesson?.collectionSlug);

  const handleAction = () => {
    if (onStartClick) {
      onStartClick();
      return;
    }
    const el = document.getElementById('all-collections-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-600" />
          {t('today_widget.title')}
        </span>
      }
      action={
        <span className="text-xs font-medium text-slate-500">
          {t('today_widget.goal_label', { count: dailyGoal })}
        </span>
      }
    >

      <div className="flex items-center justify-between gap-4 py-1">
        {/* Circular Progress Gauge */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            {/* Background Track */}
            <path
              className="text-slate-100"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            {/* Dynamic Progress Circle */}
            <path
              className={`transition-all duration-700 ease-out ${
                progressPercent >= 100 ? 'text-emerald-500' : 'text-blue-600'
              }`}
              strokeDasharray={`${progressPercent}, 100`}
              strokeLinecap="round"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            {isLoading ? (
              <span className="text-xs font-semibold text-slate-400 animate-pulse">...</span>
            ) : (
              <>
                <span className="text-sm font-bold leading-tight text-slate-900">
                  {todayLearned}/{dailyGoal}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {t('today_widget.words_learned')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress Detail & CTA */}
        <div className="space-y-3 flex-1 min-w-0">
          <p className="text-xs text-slate-500 leading-relaxed">
            {isLoading ? (
              t('today_widget.loading')
            ) : todayLearned === 0 ? (
              t('today_widget.no_words_today')
            ) : todayLearned >= dailyGoal ? (
              <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                {t('today_widget.goal_achieved')}
              </span>
            ) : (
              t('today_widget.progress_encouragement', { learned: todayLearned, goal: dailyGoal })
            )}
          </p>

          {hasContinue ? (
            <Button asChild size="sm" className="w-full">
              <Link
                href={`/${locale}/vocabulary/collection/${continueLesson?.collectionSlug}/lesson/${continueLesson?.lessonSlug}`}
              >
                <span>{continueLesson?.progress ? t('today_widget.continue_study') : t('today_widget.start_study')}</span>
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleAction} className="w-full">
              <span>{t('today_widget.start_study')}</span>
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
