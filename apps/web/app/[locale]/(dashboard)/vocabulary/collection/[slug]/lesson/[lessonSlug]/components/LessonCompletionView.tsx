'use client';

import React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Volume2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { WordDetail } from '@/types/vocabulary';

interface LessonCompletionViewProps {
  totalWords: number;
  highestStreak: number;
  masteredWordsCount: number;
  unmasteredWordsCount?: number;
  wordsList: WordDetail[];
  lessonTitle?: string;
  sectionName?: string | null;
  slug: string;
  locale: string;
  onReplay: (onlyUnmastered?: boolean) => void;
  playAudio: (customUrl?: string, langCode?: string, textToSpeak?: string) => void;
  t: (key: string, options?: any) => string;
}

export function LessonCompletionView({
  totalWords,
  highestStreak,
  masteredWordsCount,
  unmasteredWordsCount = 0,
  wordsList,
  lessonTitle,
  sectionName,
  slug,
  locale,
  onReplay,
  playAudio,
  t,
}: LessonCompletionViewProps) {
  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-10 text-center space-y-6 animate-in zoom-in-95 duration-300">
      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25 animate-bounce">
        <Trophy className="w-10 h-10 text-amber-900" />
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
          {t('completion_title')}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600">
          {t('completion_desc', {
            count: totalWords,
            lesson: lessonTitle || '',
          })}
          {sectionName ? ` (${sectionName})` : ''}.
        </p>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-3 gap-3 py-2 max-w-xl mx-auto">
        <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/60 text-center">
          <p className="text-[11px] font-semibold text-blue-600 uppercase">
            {t('total_cards')}
          </p>
          <p className="text-xl font-black text-blue-900 mt-1">{totalWords}</p>
        </div>
        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-center">
          <p className="text-[11px] font-semibold text-amber-600 uppercase">
            {t('highest_streak')}
          </p>
          <p className="text-xl font-black text-amber-900 mt-1 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            {highestStreak}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 text-center">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase">
            {t('mastered_count')}
          </p>
          <p className="text-xl font-black text-emerald-900 mt-1">
            {masteredWordsCount > 0 ? masteredWordsCount : totalWords}
          </p>
        </div>
      </div>

      {/* Word Quick Review List */}
      <div className="max-w-xl mx-auto space-y-2 pt-2 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          {t('recent_words_title')}
        </h4>
        <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200 divide-y divide-slate-100">
          {wordsList.map((w, idx) => (
            <div
              key={w._id || idx}
              className="pt-1.5 first:pt-0 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{w.word}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 truncate max-w-xs">
                  {w.meaning || w.parts?.[0]?.meanings?.[0]?.definition || ''}
                </span>
              </div>
              <button
                onClick={() =>
                  playAudio(
                    w.audio?.us || w.audioUrl,
                    'en-US',
                    w.word
                  )
                }
                className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer"
                title={t('listen_again')}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {unmasteredWordsCount > 0 ? (
          <>
            <button
              onClick={() => onReplay(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chỉ học từ chưa học ({unmasteredWordsCount} từ)</span>
            </button>
            <button
              onClick={() => onReplay(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Học lại toàn bộ phần này</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => onReplay(false)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/25 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('replay_lesson')}</span>
          </button>
        )}

        <Link
          href={`/${locale}/vocabulary/collection/${slug}`}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
        >
          {t('back_to_collection')}
        </Link>
      </div>
    </div>
  );
}
