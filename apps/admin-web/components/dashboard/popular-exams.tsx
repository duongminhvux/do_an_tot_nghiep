'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, type PopularExamItem } from './dashboard-data';

interface PopularExamsProps {
  locale: string;
  exams: PopularExamItem[];
  loading?: boolean;
}

export function PopularExams({ locale, exams, loading }: PopularExamsProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex h-full min-h-[250px] flex-col rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)]">
      <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-blue-950">
        {t('popular.title')}
      </h2>
      <span className="text-[10px] font-medium text-blue-500">{t('popular.view')}</span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 rounded bg-slate-100"
                  style={{ width: `${70 - i * 8}%` }}
                />
                <div
                  className="h-3 rounded bg-slate-50"
                  style={{ width: `${40 - i * 4}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
          <div className="grid grid-cols-[28px_1fr_48px] bg-blue-50/70 px-2 py-1.5 text-[9px] font-bold uppercase text-blue-900">
            <span>#</span><span>{t('popular.title')}</span><span className="text-right">SL</span>
          </div>
        <ul className="divide-y divide-slate-100">
          {exams.map((exam, i) => {
            return (
              <li
                key={exam.id}
                className="grid grid-cols-[28px_1fr_48px] items-center gap-1 px-2 py-2"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-700">
                    {exam.name}
                  </p>
                </div>
                <span className="text-right text-[11px] text-slate-500">{formatNumber(exam.attempts, locale)}</span>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </div>
  );
}
