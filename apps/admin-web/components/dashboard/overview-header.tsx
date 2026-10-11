'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Calendar, Check, ChevronDown, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TimeRangeDays } from './dashboard-data';

interface OverviewHeaderProps {
  locale: string;
  days: TimeRangeDays;
  onChange: (days: TimeRangeDays) => void;
}

const RANGE_OPTIONS: TimeRangeDays[] = [7, 30, 90];

export function OverviewHeader({ locale, days, onChange }: OverviewHeaderProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="relative flex flex-wrap items-end justify-between gap-5">
      <div className="space-y-1.5">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-blue-600"
          >
            <Home className="h-3.5 w-3.5" />
            {t('breadcrumb.home')}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="font-semibold text-slate-600">
            {t('breadcrumb.overview')}
          </span>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-[2rem]">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-500 sm:text-[15px]">{t('description')}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-10 cursor-pointer gap-2 rounded-xl border-slate-200 bg-white px-3.5 text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:text-blue-700"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {t(`range.${days}`)}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {RANGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => onChange(option)}
              className="cursor-pointer"
            >
              <span
                className={cn(
                  'flex w-full items-center justify-between',
                  option === days && 'font-semibold text-blue-600',
                )}
              >
                {t(`range.${option}`)}
                {option === days && <Check className="h-3.5 w-3.5" />}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
