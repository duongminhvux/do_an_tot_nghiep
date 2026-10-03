'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExamItem } from '@/types';

interface ExamOverviewTabProps {
  exam: ExamItem;
  questionsCount: number;
}

export function ExamOverviewTab({ exam, questionsCount }: ExamOverviewTabProps) {
  const { t } = useTranslation('assessment');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-bold text-slate-900">
        {t('detailPage.overviewTitle')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewName')}
          </span>
          <div className="font-bold text-slate-800 mt-1">{exam.name}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewSlug')}
          </span>
          <div className="font-bold text-slate-800 mt-1">{exam.slug || '—'}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewTypeMode')}
          </span>
          <div className="font-bold text-slate-800 mt-1">
            {exam.type} (Full Test)
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewDuration')}
          </span>
          <div className="font-bold text-slate-800 mt-1">
            {exam.durationMinutes || 120} {t('table.minutes')}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewTotalQuestions')}
          </span>
          <div className="font-bold text-slate-800 mt-1">
            {questionsCount} {t('table.questionsCount', { count: '' }).trim()} (
            {t('detailPage.targetQuestions', {
              target: exam.totalQuestions || 200,
            })}
            )
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-slate-400 font-medium">
            {t('detailPage.overviewStatus')}
          </span>
          <div className="font-bold text-slate-800 mt-1">
            {exam.isActive ? t('status.active') : t('status.inactive')}
          </div>
        </div>
      </div>
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
        <span className="text-slate-400 font-medium">
          {t('detailPage.overviewDesc')}
        </span>
        <div className="text-slate-700 mt-1 leading-relaxed">
          {exam.description || t('table.noDescription')}
        </div>
      </div>
    </div>
  );
}
