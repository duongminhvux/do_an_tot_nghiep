'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { SaveWordButton } from '@/components/vocabulary/SaveWordButton';

export type SrsLevel = 'again' | 'hard' | 'good' | 'easy';

interface SrsRatingBarProps {
  onRating: (level: SrsLevel) => void;
  isMastered: boolean;
  onToggleMastered: () => void;
  isSaved: boolean;
  wordId?: string;
  onToggleSave: () => void;
  t: (key: string, options?: any) => string;
}

export function SrsRatingBar({
  onRating,
  isMastered,
  onToggleMastered,
  isSaved,
  wordId,
  onToggleSave,
  t,
}: SrsRatingBarProps) {
  // Respect the app sidebar width so the bottom bar only spans the content area
  let isMobile = false;
  let open = true;
  try {
    const sidebar = useSidebar();
    isMobile = sidebar.isMobile;
    open = sidebar.open;
  } catch {
    // Fallback if not inside SidebarProvider
  }

  const leftOffset = isMobile
    ? '0px'
    : open
    ? 'var(--sidebar-width, 16rem)'
    : 'var(--sidebar-width-icon, 3rem)';

  const keyLabel = t('srs.shortcut_key', 'Phím');

  return (
    <div
      style={{ left: leftOffset }}
      className="fixed bottom-0 right-0 z-40 w-auto select-none border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[left] duration-200 ease-linear animate-in slide-in-from-bottom sm:px-6 sm:py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-xl mx-auto space-y-2">
        {/* 4 Compact SRS Action Buttons */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
          {/* 1. HỌC LẠI */}
          <button
            type="button"
            onClick={() => onRating('again')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg border border-red-200 bg-red-50 transition-colors hover:border-red-300 hover:bg-red-100 cursor-pointer"
            title={`${t('srs.again')} (${keyLabel} 1)`}
          >
            <span className="absolute top-1 right-1.5 hidden rounded-md border border-red-200 bg-white px-1 font-mono text-[11px] font-bold text-red-500 sm:inline">
              1
            </span>
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-red-700 group-hover:text-red-800 transition-colors">
              {t('srs.again')}
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-red-600/80 group-hover:text-red-700 pt-0.5 transition-colors">
              {t('srs.again_time')}
            </span>
          </button>

          {/* 2. KHÓ */}
          <button
            type="button"
            onClick={() => onRating('hard')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg border border-amber-200 bg-amber-50 transition-colors hover:border-amber-300 hover:bg-amber-100 cursor-pointer"
            title={`${t('srs.hard')} (${keyLabel} 2)`}
          >
            <span className="absolute top-1 right-1.5 hidden rounded-md border border-amber-200 bg-white px-1 font-mono text-[11px] font-bold text-amber-600 sm:inline">
              2
            </span>
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-amber-800 group-hover:text-amber-900 transition-colors">
              {t('srs.hard')}
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-amber-700/80 group-hover:text-amber-800 pt-0.5 transition-colors">
              {t('srs.hard_time')}
            </span>
          </button>

          {/* 3. TỐT */}
          <button
            type="button"
            onClick={() => onRating('good')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg border border-emerald-200 bg-emerald-50 transition-colors hover:border-emerald-300 hover:bg-emerald-100 cursor-pointer"
            title={`${t('srs.good')} (${keyLabel} 3)`}
          >
            <span className="absolute top-1 right-1.5 hidden rounded-md border border-emerald-200 bg-white px-1 font-mono text-[11px] font-bold text-emerald-700 sm:inline">
              3
            </span>
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800 group-hover:text-emerald-900 transition-colors">
              {t('srs.good')}
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-emerald-700/80 group-hover:text-emerald-800 pt-0.5 transition-colors">
              {t('srs.good_time')}
            </span>
          </button>

          {/* 4. DỄ */}
          <button
            type="button"
            onClick={() => onRating('easy')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg border border-blue-200 bg-blue-50 transition-colors hover:border-blue-300 hover:bg-blue-100 cursor-pointer"
            title={`${t('srs.easy')} (${keyLabel} 4)`}
          >
            <span className="absolute top-1 right-1.5 hidden rounded-md border border-blue-200 bg-white px-1 font-mono text-[11px] font-bold text-blue-600 sm:inline">
              4
            </span>
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-blue-800 group-hover:text-blue-900 transition-colors">
              {t('srs.easy')}
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-blue-700/80 group-hover:text-blue-800 pt-0.5 transition-colors">
              {t('srs.easy_time')}
            </span>
          </button>
        </div>

        {/* Sub-actions: Thành thạo & Lưu */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1 border-t border-slate-100">
          {/* Thành thạo */}
          <button
            type="button"
            onClick={onToggleMastered}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-0.5 text-xs font-semibold transition-colors ${
              isMastered
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
            title={`${t('srs.mastered')} (${keyLabel} M)`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isMastered ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{t('srs.mastered')}</span>
          </button>

          {/* Lưu */}
          <SaveWordButton
            isSaved={isSaved}
            wordId={wordId}
            onToggle={onToggleSave}
            shortcutKey="S"
            variant="pill"
          />
        </div>
      </div>
    </div>
  );
}
