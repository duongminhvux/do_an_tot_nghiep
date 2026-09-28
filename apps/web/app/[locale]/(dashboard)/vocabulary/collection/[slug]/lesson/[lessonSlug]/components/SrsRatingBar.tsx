'use client';

import React from 'react';
import { CheckCircle2, Bookmark } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

export type SrsLevel = 'again' | 'hard' | 'good' | 'easy';

interface SrsRatingBarProps {
  onRating: (level: SrsLevel) => void;
  isMastered: boolean;
  onToggleMastered: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  t: (key: string, options?: any) => string;
}

export function SrsRatingBar({
  onRating,
  isMastered,
  onToggleMastered,
  isSaved,
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
      className="fixed bottom-0 right-0 z-40 w-auto bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] py-2 sm:py-2.5 px-3 sm:px-6 transition-[left] duration-200 ease-linear select-none animate-in slide-in-from-bottom duration-200"
    >
      <div className="max-w-xl mx-auto space-y-2">
        {/* 4 Compact SRS Action Buttons */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
          {/* 1. HỌC LẠI */}
          <button
            type="button"
            onClick={() => onRating('again')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl bg-rose-50/90 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shadow-2xs"
            title={`${t('srs.again')} (${keyLabel} 1)`}
          >
            <span className="absolute top-1 right-1.5 text-[9px] font-mono font-bold text-rose-500 bg-white/90 rounded px-1 border border-rose-200/80 hidden sm:inline shadow-2xs">
              1
            </span>
            <span className="text-xs sm:text-sm font-bold text-rose-700 group-hover:text-rose-800 uppercase tracking-wide transition-colors">
              {t('srs.again')}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-rose-600/80 group-hover:text-rose-700 pt-0.5 transition-colors">
              {t('srs.again_time')}
            </span>
          </button>

          {/* 2. KHÓ */}
          <button
            type="button"
            onClick={() => onRating('hard')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shadow-2xs"
            title={`${t('srs.hard')} (${keyLabel} 2)`}
          >
            <span className="absolute top-1 right-1.5 text-[9px] font-mono font-bold text-amber-600 bg-white/90 rounded px-1 border border-amber-200/80 hidden sm:inline shadow-2xs">
              2
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-800 group-hover:text-amber-900 uppercase tracking-wide transition-colors">
              {t('srs.hard')}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-amber-700/80 group-hover:text-amber-800 pt-0.5 transition-colors">
              {t('srs.hard_time')}
            </span>
          </button>

          {/* 3. TỐT */}
          <button
            type="button"
            onClick={() => onRating('good')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shadow-2xs"
            title={`${t('srs.good')} (${keyLabel} 3)`}
          >
            <span className="absolute top-1 right-1.5 text-[9px] font-mono font-bold text-emerald-700 bg-white/90 rounded px-1 border border-emerald-200/80 hidden sm:inline shadow-2xs">
              3
            </span>
            <span className="text-xs sm:text-sm font-bold text-emerald-800 group-hover:text-emerald-900 uppercase tracking-wide transition-colors">
              {t('srs.good')}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-700/80 group-hover:text-emerald-800 pt-0.5 transition-colors">
              {t('srs.good_time')}
            </span>
          </button>

          {/* 4. DỄ */}
          <button
            type="button"
            onClick={() => onRating('easy')}
            className="group relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl bg-blue-50/90 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shadow-2xs"
            title={`${t('srs.easy')} (${keyLabel} 4)`}
          >
            <span className="absolute top-1 right-1.5 text-[9px] font-mono font-bold text-blue-600 bg-white/90 rounded px-1 border border-blue-200/80 hidden sm:inline shadow-2xs">
              4
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-800 group-hover:text-blue-900 uppercase tracking-wide transition-colors">
              {t('srs.easy')}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-blue-700/80 group-hover:text-blue-800 pt-0.5 transition-colors">
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
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isMastered
                ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-2xs'
                : 'bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200 hover:border-purple-200'
            }`}
            title={`${t('srs.mastered')} (${keyLabel} M)`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isMastered ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>{t('srs.mastered')}</span>
          </button>

          {/* Lưu */}
          <button
            type="button"
            onClick={onToggleSave}
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isSaved
                ? 'bg-sky-100 text-sky-700 border-sky-300 shadow-2xs'
                : 'bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border-slate-200 hover:border-sky-200'
            }`}
            title={`${isSaved ? t('srs.saved') : t('srs.save')} (${keyLabel} S)`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-sky-500 text-sky-500' : 'text-slate-400'}`} />
            <span>{isSaved ? t('srs.saved') : t('srs.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
