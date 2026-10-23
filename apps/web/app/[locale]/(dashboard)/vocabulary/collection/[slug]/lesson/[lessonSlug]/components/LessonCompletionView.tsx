'use client';

import React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="w-full space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm animate-in zoom-in-95 duration-300 sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Trophy className="h-8 w-8" />
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('completion_title')}
        </h3>
        <p className="text-sm text-slate-600">
          {t('completion_desc', {
            count: totalWords,
            lesson: lessonTitle || '',
          })}
          {sectionName ? ` (${sectionName})` : ''}.
        </p>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-3 gap-3 py-2 max-w-xl mx-auto">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('total_cards')}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">{totalWords}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('highest_streak')}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            {highestStreak}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('mastered_count')}
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-700">
            {masteredWordsCount > 0 ? masteredWordsCount : totalWords}
          </p>
        </div>
      </div>

      {/* Word Quick Review List */}
      <div className="max-w-xl mx-auto space-y-2 pt-2 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          {t('recent_words_title')}
        </h4>
        <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-100">
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
            <Button type="button" onClick={() => onReplay(true)} className="w-full sm:w-auto">
              <RotateCcw />
              <span>{t('study_page.replay_unmastered_btn', { count: unmasteredWordsCount })}</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => onReplay(false)} className="w-full sm:w-auto">
              <RotateCcw />
              <span>{t('study_page.replay_all_btn')}</span>
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => onReplay(false)} className="w-full sm:w-auto">
            <RotateCcw />
            <span>{t('replay_lesson')}</span>
          </Button>
        )}

        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href={`/${locale}/vocabulary/collection/${slug}`}>
            {t('back_to_collection')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
