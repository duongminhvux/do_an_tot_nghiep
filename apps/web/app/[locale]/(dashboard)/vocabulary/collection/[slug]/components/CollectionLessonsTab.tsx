'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  ArrowRight,
  FileText,
  Layers,
} from 'lucide-react';
import { LessonItem } from '@/types/vocabulary';

interface CollectionLessonsTabProps {
  lessons: LessonItem[];
  lessonProgressMap: Map<string, { progress: number; status: string }>;
  isLessonsLoading: boolean;
  slug: string;
  locale: string;
}

export function CollectionLessonsTab({
  lessons,
  lessonProgressMap,
  isLessonsLoading,
  slug,
  locale,
}: CollectionLessonsTabProps) {
  const { t } = useTranslation('vocabulary');

  return (
    <div className="space-y-4">
      {/* Lessons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLessonsLoading
          ? [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded border border-slate-200 bg-white p-3 space-y-3 animate-pulse"
              >
                <div className="w-full aspect-[16/9] rounded bg-slate-100" />
                <div className="h-3 w-12 rounded bg-slate-100" />
                <div className="h-4 w-32 rounded bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
            ))
          : lessons.length === 0 ? (
              <div className="col-span-full py-12 text-center rounded border border-dashed border-slate-200 bg-white">
                <Layers className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {t('collection_detail.no_lessons_title')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {t('collection_detail.no_lessons_desc')}
                </p>
              </div>
            ) : (
              lessons.map((lesson, index) => {
                const unitLabel = `Unit ${index + 1}`;

                return (
                  <Link
                    key={lesson._id}
                    href={`/${locale}/vocabulary/collection/${slug}/lesson/${lesson.slug || lesson._id}`}
                    className="group rounded border border-slate-200 bg-white p-3 hover:border-blue-400 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      {/* 16:9 Lesson Thumbnail */}
                      <div className="w-full aspect-[16/9] rounded overflow-hidden border border-slate-100 bg-slate-900 relative">
                        {lesson.coverUrl ? (
                          <img
                            src={lesson.coverUrl}
                            alt={lesson.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-blue-900 to-indigo-950 text-white">
                            <BookOpen className="w-6 h-6 text-blue-300 mb-1" />
                            <span className="text-xs font-bold truncate max-w-full">
                              {lesson.title}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Unit Label */}
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                        {unitLabel}
                      </span>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate leading-tight">
                        {lesson.title}
                      </h3>

                      {/* Word count & Sections count */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{t('words_count', { count: lesson.wordsCount || 0 })}</span>
                        </div>
                        {lesson.sectionsCount !== undefined && lesson.sectionsCount > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1 text-blue-600 font-semibold">
                              <Layers className="w-3 h-3" />
                              <span>{t('collection_detail.sections_count', { count: lesson.sectionsCount })}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Progress */}
                    {(() => {
                      const progData = lessonProgressMap.get(lesson._id);
                      const prog = progData?.progress ?? 0;
                      const st = progData?.status ?? 'NOT_STARTED';

                      return (
                        <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                              <span>
                                {st === 'COMPLETED'
                                  ? t('collection_detail.status_completed')
                                  : st === 'IN_PROGRESS'
                                    ? t('collection_detail.status_in_progress', { prog })
                                    : t('collection_detail.status_not_started')}
                              </span>
                              {prog > 0 && <span>{prog}%</span>}
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${prog}%` }}
                              />
                            </div>
                          </div>

                          <div className="w-6 h-6 rounded-full border border-blue-200 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </div>
                      );
                    })()}
                  </Link>
                );
              })
            )}
      </div>
    </div>
  );
}
