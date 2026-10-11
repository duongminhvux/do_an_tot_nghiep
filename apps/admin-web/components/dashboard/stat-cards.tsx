'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  FileText,
  MousePointerClick,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatNumber } from './dashboard-data';

interface StatCardsProps {
  locale: string;
  loading: boolean;
  users: number;
  usersGrowth: number;
  exams: number;
  activeExams: number;
  attempts: number;
  attemptsGrowth: number;
  avgScore: number;
  scoreGrowth: number;
}

export function StatCards({
  locale,
  loading,
  users,
  usersGrowth,
  exams,
  activeExams,
  attempts,
  attemptsGrowth,
  avgScore,
  scoreGrowth,
}: StatCardsProps) {
  const { t } = useTranslation('dashboard');

  const cards = [
    {
      icon: Users,
      iconClasses: 'border-blue-100 bg-blue-50 text-blue-600',
      label: t('stats.users.label'),
      value: formatNumber(users, locale),
      delta: `+${Math.round(usersGrowth)}%`,
      sub: t('stats.users.sub'),
    },
    {
      icon: FileText,
      iconClasses: 'border-sky-100 bg-sky-50 text-sky-600',
      label: t('stats.exams.label'),
      value: formatNumber(exams, locale),
      sub: `${formatNumber(activeExams, locale)} ${t('stats.exams.sub')}`,
    },
    {
      icon: MousePointerClick,
      iconClasses: 'border-emerald-100 bg-emerald-50 text-emerald-600',
      label: t('stats.attempts.label'),
      value: formatNumber(attempts, locale),
      delta: `+${Math.round(attemptsGrowth)}%`,
      sub: t('stats.attempts.sub'),
    },
    {
      icon: Target,
      iconClasses: 'border-violet-100 bg-violet-50 text-violet-600',
      label: t('stats.avgScore.label'),
      value: formatNumber(avgScore, locale),
      delta: `+${Math.round(scoreGrowth)}`,
      sub: t('stats.avgScore.sub'),
    },
  ];

  const sparkline = 'M2 25 C10 24 12 20 18 22 S27 23 34 18 S44 20 51 14 S60 11 68 13 S78 7 88 3';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative overflow-hidden rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                card.iconClasses,
              )}
            >
              <card.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              {loading ? (
                <Skeleton className="mt-1.5 h-7 w-20" />
              ) : (
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-blue-950">
                  {card.value}
                </p>
              )}
              {card.delta && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                  <TrendingUp className="h-3 w-3" />
                  {card.delta} <span className="font-normal text-slate-400">{card.sub}</span>
                </span>
              )}
              {!card.delta && <p className="mt-1 text-[11px] text-slate-400">{card.sub}</p>}
            </div>
            <svg viewBox="0 0 90 30" className="mt-5 h-9 w-20 shrink-0 overflow-visible">
              <path d={sparkline} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
