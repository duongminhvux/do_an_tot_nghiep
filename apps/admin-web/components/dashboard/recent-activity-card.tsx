'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity as ActivityIcon,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  Headphones,
  PlayCircle,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityTemplateKey, ActivityViewItem } from './dashboard-data';

const TEMPLATE_META: Record<
  ActivityTemplateKey,
  { icon: LucideIcon; classes: string }
> = {
  completed_exam: {
    icon: CheckCircle2,
    classes: 'border-blue-100 bg-blue-50 text-blue-600',
  },
  registered: {
    icon: UserPlus,
    classes: 'border-violet-100 bg-violet-50 text-violet-600',
  },
  created_exam: {
    icon: FilePlus2,
    classes: 'border-sky-100 bg-sky-50 text-sky-600',
  },
  achieved_score: {
    icon: Trophy,
    classes: 'border-amber-100 bg-amber-50 text-amber-600',
  },
  started_exam: {
    icon: PlayCircle,
    classes: 'border-emerald-100 bg-emerald-50 text-emerald-600',
  },
  learned_words: {
    icon: BookOpen,
    classes: 'border-teal-100 bg-teal-50 text-teal-600',
  },
  submitted_dictation: {
    icon: Headphones,
    classes: 'border-indigo-100 bg-indigo-50 text-indigo-600',
  },
  generic: {
    icon: ActivityIcon,
    classes: 'border-slate-200 bg-slate-50 text-slate-500',
  },
};

interface RecentActivityCardProps {
  activities: ActivityViewItem[];
  loading?: boolean;
  formatMinutes: (minutes: number) => string;
}

export function RecentActivityCard({
  activities,
  loading,
  formatMinutes,
}: RecentActivityCardProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex h-full flex-col rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)]">
      <h2 className="text-[15px] font-bold text-blue-950">
        {t('recent.title')}
      </h2>

      {loading ? (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 rounded bg-slate-100"
                  style={{ width: `${85 - i * 10}%` }}
                />
                <div
                  className="h-3 rounded bg-slate-50"
                  style={{ width: `${35 - i * 4}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-4 flex-1 divide-y divide-slate-100">
          {activities.map((item) => {
            const meta = TEMPLATE_META[item.template] || TEMPLATE_META.generic;
            const Icon = meta.icon;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    meta.classes,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-700">
                    {t(`recent.${item.template}`, {
                      user: item.userName,
                      target: item.target,
                      score: item.score,
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatMinutes(item.minutesAgo)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
