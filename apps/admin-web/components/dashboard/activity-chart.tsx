'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  formatNumber,
  type AttemptSeriesData,
  type TimeRangeDays,
} from './dashboard-data';

interface ActivityChartProps {
  locale: string;
  days: TimeRangeDays;
  data: AttemptSeriesData;
  loading?: boolean;
}

export function ActivityChart({ locale, days, data, loading }: ActivityChartProps) {
  const { t } = useTranslation('dashboard');
  const [visible, setVisible] = useState<Record<string, boolean>>({
    listening: true,
    reading: true,
    fullTest: false,
  });

  const series = useMemo(
    () => [
      {
        key: 'listening',
        label: t('chart.listening'),
        color: '#2563eb',
        values: data.listening,
      },
      {
        key: 'reading',
        label: t('chart.reading'),
        color: '#0ea5e9',
        values: data.reading,
      },
      {
        key: 'fullTest',
        label: t('chart.fullTest'),
        color: '#8b5cf6',
        values: data.fullTest,
      },
    ],
    [t, data],
  );

  const activeSeries = series.filter((s) => visible[s.key]);

  const { max, ticks } = useMemo(() => {
    const all = activeSeries.flatMap((s) => s.values);
    const rawMax = all.length ? Math.max(...all) : 100;
    const niceMax = Math.max(100, Math.ceil((rawMax * 1.08) / 4) * 4);
    return {
      max: niceMax,
      ticks: [1, 2, 3, 4].map((i) => Math.round((niceMax / 4) * i)),
    };
  }, [activeSeries]);

  const toggleSeries = (key: string) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-w-0 rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-blue-950">
            {t('chart.title', { days })}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t('chart.subtitle', { days })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {series.map((s) => {
            const isActive = visible[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                  isActive
                    ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60 hover:opacity-100',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-6 h-60 w-full" />
      ) : activeSeries.length === 0 ? (
        <div className="mt-6 flex h-60 items-center justify-center text-sm text-slate-400">
          {t('chart.empty')}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto pb-1">
          <div className={cn('min-w-0', data.labels.length > 7 && 'min-w-[760px]')}>
          <div className="flex">
            {/* Trục Y */}
            <div className="flex h-60 w-10 flex-col justify-between pr-2">
              {ticks.map((v) => (
                <span
                  key={v}
                  className="-translate-y-1/2 text-right text-[10px] font-medium text-slate-400"
                >
                  {formatNumber(v, locale)}
                </span>
              ))}
            </div>

            {/* Vùng biểu đồ */}
            <div className="relative h-60 min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                {ticks.map((v) => (
                  <div key={v} className="border-t border-slate-100" />
                ))}
              </div>
              <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
                {data.labels.map((label, i) => (
                  <div
                    key={`${label}-${i}`}
                    className="group relative flex h-full flex-1 items-end justify-center gap-[2px] sm:gap-[3px]"
                  >
                    {activeSeries.map((s) => {
                      const value = s.values[i] ?? 0;
                      const pct = max > 0 ? (value / max) * 100 : 0;
                      return (
                        <div
                          key={s.key}
                          className={cn(
                            'w-2.5 rounded-t-[3px] transition-all duration-200 group-hover:opacity-70 sm:w-3',
                            data.labels.length > 15 && 'w-1.5 sm:w-2',
                          )}
                          style={{
                            height: `${Math.max(pct, 2)}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      );
                    })}

                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-first:left-0 group-first:translate-x-0 group-last:left-auto group-last:right-0 group-last:translate-x-0">
                      <div className="min-w-[150px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
                        <p className="mb-1.5 text-xs font-semibold text-slate-900">
                          {label}
                        </p>
                        {activeSeries.map((s) => (
                          <div
                            key={s.key}
                            className="flex items-center justify-between gap-4 py-0.5"
                          >
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.label}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-900">
                              {formatNumber(s.values[i] ?? 0, locale)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trục X */}
          <div className="mt-2 flex gap-1 pl-10 sm:gap-2">
            {data.labels.map((label, i) => {
              const show =
                data.labels.length <= 7 ||
                i % Math.ceil(data.labels.length / 8) === 0;
              return (
                <span
                  key={`${label}-${i}`}
                  className={cn(
                    'flex-1 truncate text-center text-[10px] font-medium',
                    show ? 'text-slate-400' : 'text-transparent',
                  )}
                >
                  {label}
                </span>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
