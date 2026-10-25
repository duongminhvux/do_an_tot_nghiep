'use client';

import React from 'react';
import {
  Layers,
  ChevronRight,
  Check,
  CheckCheck,
  Bookmark,
} from 'lucide-react';
import { SectionItem, LessonItem, LessonWordItem } from '@/types/vocabulary';
import { SectionProgressStat } from '@/types/learning';
import { surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

interface TopicSidebarProps {
  sections: SectionItem[];
  selectedSectionId: string;
  setSelectedSectionId: (id: string) => void;
  rawWords: LessonWordItem[];
  currentLesson: LessonItem | null;
  masteredWords: Set<string>;
  needReviewWords: Set<string>;
  learnedWords: Set<string>;
  sectionStats?: Record<string, SectionProgressStat>;
  reviewAll: boolean;
  setReviewAll: (val: boolean) => void;
  t: (key: string, options?: any) => string;
}

export function TopicSidebar({
  sections,
  selectedSectionId,
  setSelectedSectionId,
  rawWords,
  currentLesson,
  masteredWords,
  needReviewWords,
  learnedWords,
  sectionStats,
  reviewAll,
  setReviewAll,
  t,
}: TopicSidebarProps) {
  return (
    <aside className={cn(surface, 'w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-32 lg:w-72')}>
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {t('topic_list')}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {sections.length > 0
            ? t('topics_count', { count: sections.length })
            : t('topics_count', { count: 1 })}
        </span>
      </div>

      <div className="space-y-2 max-h-[calc(100dvh-320px)] overflow-y-auto pr-1">
        {sections.length > 0 ? (
          sections.map((sec, idx) => {
            const isActive = selectedSectionId === sec._id;
            const secLabel = sec.name || t('topic_default', { index: idx + 1 });
            const stat = sectionStats?.[sec._id];
            const wordCount = stat?.totalWords || sec.wordsCount || 0;
            const learnedInSec =
              stat?.learnedCount ??
              (stat ? stat.masteredCount + stat.needReviewCount : 0);
            const masteredInSec = stat?.masteredCount || 0;
            const progressPercent =
              stat?.progressPercent ??
              (wordCount > 0 ? Math.round((learnedInSec / wordCount) * 100) : 0);
            const isAllMastered = wordCount > 0 && masteredInSec >= wordCount;

            return (
              <button
                key={sec._id}
                onClick={() => setSelectedSectionId(sec._id)}
                className={`group flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`truncate text-sm font-semibold ${
                          isActive
                            ? 'text-blue-700'
                            : 'text-slate-800 group-hover:text-blue-600'
                        }`}
                      >
                        {secLabel}
                      </h3>
                      {isAllMastered && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                          {t('sidebar.mastered_badge')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform shrink-0 ${
                      isActive
                        ? 'bg-primary text-white'
                        : isAllMastered
                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200'
                        : 'border border-slate-200 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:translate-x-0.5'
                    }`}
                  >
                    {isAllMastered ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* Thông tin số từ đã học của section */}
                <div className="w-full space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      {learnedInSec > 0 ? (
                        <>
                          <span className="font-semibold text-slate-700">
                            {t('sidebar.learned_in_sec', { learned: learnedInSec, total: wordCount })}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-600">
                            ({progressPercent}%)
                          </span>
                        </>
                      ) : (
                        <span>{t('words_count', { count: wordCount })}</span>
                      )}
                    </span>
                    {learnedInSec > 0 && masteredInSec > 0 && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                        {t('sidebar.mastered_in_sec', { count: masteredInSec })}
                      </span>
                    )}
                    {learnedInSec === 0 && (
                      <span className="text-[11px] text-slate-400">
                        {t('sidebar.not_studied')}
                      </span>
                    )}
                  </div>

                  {/* Mini Progress Bar của từng Section */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isAllMastered
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          (() => {
            const total = rawWords.length;
            const learnedTotal = masteredWords.size + needReviewWords.size;
            const totalPercent = total > 0 ? Math.round((learnedTotal / total) * 100) : 0;
            const isAll = total > 0 && masteredWords.size >= total;

            return (
              <button
                onClick={() => setSelectedSectionId('all')}
                className="flex w-full cursor-pointer flex-col gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="truncate text-sm font-semibold text-blue-700">
                      {currentLesson?.title || t('all_words_title')}
                    </h3>
                  </div>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="w-full space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="font-semibold text-slate-700">
                      {learnedTotal > 0
                        ? `${t('sidebar.learned_in_sec', { learned: learnedTotal, total })} (${totalPercent}%)`
                        : t('all_words_in_lesson', { count: total })}
                    </span>
                    {masteredWords.size > 0 && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                        {t('sidebar.mastered_in_sec', { count: masteredWords.size })}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isAll ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(totalPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })()
        )}
      </div>

      {/* Options: Review all mode if user wants to re-study already learned words */}
      <div className="pt-2.5 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-slate-50">
          <input
            type="checkbox"
            checked={reviewAll}
            onChange={(e) => setReviewAll(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-blue-600"
          />
          <span className="font-medium flex-1">
            {t('sidebar.review_all_label')}
          </span>
          {reviewAll && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
              {t('sidebar.review_all_on')}
            </span>
          )}
        </label>
      </div>

      {/* Quick Session Stats in Sidebar */}
      <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {t('sidebar.learned_label')} <strong className="text-emerald-700 font-bold">{learnedWords.size}</strong>/{rawWords.length}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {t('sidebar.unlearned_label')} <strong className="text-amber-700 font-bold">{Math.max(0, rawWords.length - learnedWords.size)}</strong>
            </span>
          </span>
        </div>
        <p className="text-[11px] leading-tight text-slate-400">
          {t('sidebar.srs_tip')}
        </p>
      </div>
    </aside>
  );
}
