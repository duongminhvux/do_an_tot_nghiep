'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Flame,
  Keyboard,
  Settings,
  CreditCard,
  Brain,
  Headphones,
} from 'lucide-react';
import { StudyMode } from './study-sound';
import { CollectionItem, LessonItem } from '@/types/vocabulary';

interface StudyHeaderProps {
  locale: string;
  slug: string;
  collection: CollectionItem | null;
  currentLesson: LessonItem | null;
  currentWordSectionName: string | null;
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
  streak: number;
  setShowShortcuts: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  t: (key: string, options?: any) => string;
}

export function StudyHeader({
  locale,
  slug,
  collection,
  currentLesson,
  currentWordSectionName,
  mode,
  setMode,
  streak,
  setShowShortcuts,
  setShowSettings,
  t,
}: StudyHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Back & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${locale}/vocabulary/collection/${slug}`}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs shrink-0"
            title={t('back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate flex items-center gap-2">
              <span>{currentLesson?.title || collection?.name || t('pos.default')}</span>
              {currentWordSectionName && (
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {currentWordSectionName}
                </span>
              )}
            </h1>
            {collection?.name && (
              <p className="text-[11px] text-slate-400 font-medium truncate hidden sm:block">
                {collection.name}
              </p>
            )}
          </div>
        </div>

        {/* Right: Mode Switcher + Streak + Controls */}
        <div className="flex items-center gap-2">
          {/* Desktop Mode Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              onClick={() => setMode('flashcard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'flashcard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t('modes.flashcard')}</span>
            </button>

            <button
              onClick={() => setMode('guess')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'guess'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{t('modes.guess')}</span>
            </button>

            <button
              onClick={() => setMode('repeat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'repeat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{t('modes.repeat')}</span>
            </button>
          </div>

          {/* Gamification Streak Pill */}
          {streak > 0 && (
            <div
              title={t('streak_tooltip')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-extrabold shadow-sm animate-flame"
            >
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span>{streak}</span>
            </div>
          )}

          <button
            onClick={() => setShowShortcuts(true)}
            title={t('shortcuts_tooltip')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            title={t('settings_tooltip')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Mode Switcher Bar */}
      <div className="flex lg:hidden overflow-x-auto px-4 py-2 border-t border-slate-100 gap-1.5 bg-slate-50/90 no-scrollbar">
        <button
          onClick={() => setMode('flashcard')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all ${
            mode === 'flashcard'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.flashcard')}
        </button>
        <button
          onClick={() => setMode('guess')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all ${
            mode === 'guess'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.guess')}
        </button>
        <button
          onClick={() => setMode('repeat')}
          className={`px-3 py-1 rounded-lg text-xs shrink-0 font-semibold transition-all ${
            mode === 'repeat'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 bg-white border border-slate-200'
          }`}
        >
          {t('modes.repeat')}
        </button>
      </div>
    </header>
  );
}
