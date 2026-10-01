'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export function ExamAttemptsTab() {
  const { t } = useTranslation('assessment');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-bold text-slate-900">
        {t('detailPage.attemptsHistoryTitle')}
      </h3>
      <div className="py-12 text-center text-slate-400 text-xs">
        {t('detailPage.noAttemptsDesc')}
      </div>
    </div>
  );
}
