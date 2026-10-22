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
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/page';

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
  const modeItems = [
    {
      value: 'flashcard' as StudyMode,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          {t('modes.flashcard', 'Flashcard')}
        </span>
      ),
    },
    {
      value: 'guess' as StudyMode,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5" />
          {t('modes.guess', 'Đoán từ')}
        </span>
      ),
    },
    {
      value: 'repeat' as StudyMode,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5" />
          {t('modes.repeat', 'Nghe viết')}
        </span>
      ),
    },
  ];

  return (
    // Sticks just below the dashboard shell's own sticky top bar (h-14, z-30).
    <header className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Left: Back & Title */}
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="icon" className="shrink-0" title={t('back', 'Quay lại')}>
            <Link href={`/${locale}/vocabulary`}>
              <ArrowLeft />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-base font-semibold text-slate-900">
              <RotateCcw className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="truncate">{t('review.page_title', 'Ôn tập định kỳ (SRS)')}</span>
              {dueCount > 0 && (
                <Badge tone="amber" className="hidden sm:inline-flex">
                  {dueCount} {t('words', 'từ')}
                </Badge>
              )}
            </h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {t('review.page_desc', 'Ôn tập lại các từ vựng đến hạn để củng cố trí nhớ dài hạn')}
            </p>
          </div>
        </div>

        {/* Right: Mode Switcher + Streak + Controls */}
        <div className="flex items-center gap-2">
          <Segmented
            items={modeItems}
            value={mode}
            onChange={setMode}
            className="hidden sm:inline-flex"
          />

          {/* Gamification Streak Pill */}
          {streak > 0 && (
            <div
              title={t('streak_tooltip', 'Chuỗi trả lời đúng liên tiếp')}
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200"
            >
              <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>{streak}</span>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setShowShortcuts(true)}
            title={t('shortcuts_tooltip', 'Phím tắt')}
          >
            <Keyboard />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setShowSettings(true)}
            title={t('settings_tooltip', 'Cài đặt học tập')}
          >
            <Settings />
          </Button>
        </div>
      </div>

      {/* Mobile Mode Switcher Bar */}
      <div className="flex overflow-x-auto border-t border-slate-100 px-4 py-2 no-scrollbar sm:hidden">
        <Segmented items={modeItems} value={mode} onChange={setMode} className="shrink-0" />
      </div>
    </header>
  );
}

export default ReviewHeader;
