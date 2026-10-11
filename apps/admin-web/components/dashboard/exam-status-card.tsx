'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from './dashboard-data';

interface ExamStatusCardProps {
  locale: string;
  total: number;
  active: number;
  inactive: number;
  loading?: boolean;
  toeic?: number;
}

export function ExamStatusCard({
  locale,
  total,
  active,
  inactive,
  loading,
  toeic,
}: ExamStatusCardProps) {
  const { t } = useTranslation('dashboard');

  const items = [
    { label: t('examStatus.active'), value: active, color: '#34d399' },
    { label: t('examStatus.inactive'), value: inactive, color: '#93c5fd' },
  ];
  const activePercent = total > 0 ? (active / total) * 100 : 0;
  const inactivePercent = total > 0 ? (inactive / total) * 100 : 0;
  const activeEnd = activePercent;

  return (
    <div className="flex h-full min-h-[250px] flex-col rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)]">
      <h2 className="text-[15px] font-bold text-blue-950">
        {t('examStatus.title')}
      </h2>

      {loading ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-10 w-40" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                <circle
                  cx="21"
                  cy="21"
                  r="15.5"
                  fill="none"
                  stroke="#dbeafe"
                  strokeWidth="7"
                />
                {activePercent > 0 && (
                  <circle
                    cx="21"
                    cy="21"
                    r="15.5"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="7"
                    strokeDasharray={`${activePercent} ${100 - activePercent}`}
                    strokeDashoffset="0"
                    pathLength="100"
                  />
                )}
                {inactivePercent > 0 && (
                  <circle
                    cx="21"
                    cy="21"
                    r="15.5"
                    fill="none"
                    stroke="#93c5fd"
                    strokeWidth="7"
                    strokeDasharray={`${inactivePercent} ${100 - inactivePercent}`}
                    strokeDashoffset={`${-activeEnd}`}
                    pathLength="100"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-blue-950">{formatNumber(total, locale)}</span>
                <span className="text-[10px] text-slate-400">{t('examStatus.total')}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
            {items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
                <span className="font-bold text-blue-950">{formatNumber(item.value, locale)}</span>
              </div>
            ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
