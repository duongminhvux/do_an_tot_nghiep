'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  FileText,
  GraduationCap,
  Play,
  Bookmark,
} from 'lucide-react';
import { CollectionItem } from '@/types/vocabulary';

interface CollectionHeroProps {
  collection: CollectionItem | null;
  groupName: string;
  lessonsCount: number;
  totalWordsCount: number;
  isLoading: boolean;
  onStartClick: () => void;
}

export function CollectionHero({
  collection,
  groupName,
  lessonsCount,
  totalWordsCount,
  isLoading,
  onStartClick,
}: CollectionHeroProps) {
  const { t } = useTranslation('vocabulary');

  if (isLoading) {
    return (
      <div className="rounded border border-slate-200 bg-white p-6 flex flex-col md:flex-row gap-6 animate-pulse">
        <div className="w-full md:w-80 aspect-[16/9] rounded bg-slate-100" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-28 bg-slate-100 rounded" />
          <div className="h-8 w-64 bg-slate-100 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (!collection) return null;

  return (
    <div className="rounded border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Cover Image */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 aspect-[16/9] md:aspect-auto relative bg-gradient-to-br from-blue-900 to-indigo-950 overflow-hidden">
          {collection.coverUrl ? (
            <img
              src={collection.coverUrl}
              alt={collection.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
              <BookOpen className="w-12 h-12 text-blue-300 mb-2" />
              <span className="text-lg font-bold text-white">
                {collection.name}
              </span>
            </div>
          )}
          {/* Group Badge Overlay */}
          {groupName && (
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-sm text-white text-[11px] font-bold shadow-sm">
                {groupName}
              </span>
            </div>
          )}
        </div>

        {/* Collection Info */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-3">
                {collection.description}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-4 sm:gap-6 text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold">
                  {collection.lessonsCount || lessonsCount}{' '}
                  {t('collection_detail.stat_lessons').toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold">
                  {totalWordsCount || collection.wordsCount || 0}{' '}
                  {t('collection_detail.stat_words').toLowerCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold">
                  {groupName || 'General'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4 sm:mt-5">
            <button
              type="button"
              onClick={onStartClick}
              className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{t('collection_detail.start_btn')}</span>
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <Bookmark className="w-4 h-4" />
              <span>{t('collection_detail.save_collection')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
