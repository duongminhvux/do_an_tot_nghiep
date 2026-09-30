'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RotateCcw,
  Flame,
  Keyboard,
  Settings,
  CreditCard,
  Brain,
  Headphones,
} from 'lucide-react';
import { StudyMode } from '../../collection/[slug]/lesson/[lessonSlug]/components/study-sound';

interface ReviewHeaderProps {
  locale: string;
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
  streak: number;
  dueCount: number;
  setShowShortcuts: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  t: (key: string, options?: any) => string;
}

export function ReviewHeader({
  locale,
  mode,
  setMode,
  streak,
  dueCount,
  setShowShortcuts,
  setShowSettings,
  t,
}: ReviewHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${locale}/vocabulary`}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs shrink-0 cursor-pointer"
            title={t('back', 'Quay lại')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{t('review.page_title', 'Ôn tập định kỳ (SRS)')}</span>
              {dueCount > 0 && (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {dueCount} {t('words', 'từ')}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium truncate hidden sm:block">
              {t('review.page_desc', 'Ôn tập lại các từ vựng đến hạn để củng cố trí nhớ dài hạn')}
            </p>
          </div>
        </div>

        {/* Right: Mode Switcher + Streak + Controls */}
        <div className="flex items-center gap-2">
          {/* Desktop Mode Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => setMode('flashcard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'flashcard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t('modes.flashcard', 'Flashcard')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('guess')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'guess'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{t('modes.guess', 'Đoán từ')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('repeat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'repeat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{t('modes.repeat', 'Nghe viết')}</span>
            </button>
          </div>

          {/* Gamification Streak Pill */}
          {streak > 0 && (
            <div
              title={t('streak_tooltip', 'Chuỗi trả lời đúng liên tiếp')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-extrabold shadow-sm"
            >
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span>{streak}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            title={t('shortcuts_tooltip', 'Phím tắt')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            title={t('settings_tooltip', 'Cài đặt học tập')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Mode Switcher Bar */}
      <div className="flex sm:hidden overflow-x-auto px-4 py-2 border-t border-slate-100 gap-1.5 bg-slate-50/90 no-scrollbar">
        <button
          type="button"
          onClick={() => setMode('flashcard')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all cursor-pointer ${
            mode === 'flashcard'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.flashcard', 'Flashcard')}
        </button>
        <button
          type="button"
          onClick={() => setMode('guess')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all cursor-pointer ${
            mode === 'guess'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.guess', 'Đoán từ')}
        </button>
        <button
          type="button"
          onClick={() => setMode('repeat')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all cursor-pointer ${
            mode === 'repeat'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.repeat', 'Nghe viết')}
        </button>
      </div>
    </header>
  );
}

export default ReviewHeader;
