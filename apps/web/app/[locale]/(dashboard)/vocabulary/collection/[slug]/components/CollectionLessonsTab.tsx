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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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
              <div key={i} className={cn(surface, 'space-y-3 p-4')}>
                <Skeleton className="aspect-[16/9] w-full rounded-lg" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          : lessons.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t('collection_detail.no_lessons_title')}
                description={t('collection_detail.no_lessons_desc')}
                className="col-span-full"
              />
            ) : (
              lessons.map((lesson, index) => {
                const unitLabel = `Unit ${index + 1}`;

                return (
                  <Link
                    key={lesson._id}
                    href={`/${locale}/vocabulary/collection/${slug}/lesson/${lesson.slug || lesson._id}`}
                    className={cn(surface, 'group flex flex-col justify-between p-4 transition-colors hover:border-blue-300')}
                  >
                    <div className="space-y-2.5">
                      {/* 16:9 Lesson Thumbnail */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-100 bg-blue-50">
                        {lesson.coverUrl ? (
                          <img
                            src={lesson.coverUrl}
                            alt={lesson.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-blue-600">
                            <BookOpen className="mb-1 h-6 w-6" />
                            <span className="max-w-full truncate text-xs font-semibold text-blue-700">
                              {lesson.title}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Unit Label */}
                      <span className="block text-xs font-semibold uppercase tracking-wider text-blue-600">
                        {unitLabel}
                      </span>

                      {/* Title */}
                      <h3 className="truncate text-sm font-semibold leading-tight text-slate-900 transition-colors group-hover:text-blue-600">
                        {lesson.title}
                      </h3>

                      {/* Word count & Sections count */}
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
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
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
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
                                  st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary'
                                }`}
                                style={{ width: `${prog}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-primary group-hover:text-white">
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
