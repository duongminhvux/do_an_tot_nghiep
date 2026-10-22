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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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
      <div className={cn(surface, 'flex flex-col gap-6 p-5 md:flex-row')}>
        <Skeleton className="aspect-[16/9] w-full rounded-lg md:w-80" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!collection) return null;

  return (
    <div className={cn(surface, 'overflow-hidden')}>
      <div className="flex flex-col md:flex-row">
        {/* Cover Image */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-blue-50 md:aspect-auto md:w-80 lg:w-96">
          {collection.coverUrl ? (
            <img
              src={collection.coverUrl}
              alt={collection.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center p-6 text-center text-blue-600">
              <BookOpen className="mb-2 h-12 w-12" />
              <span className="text-lg font-bold text-blue-900">
                {collection.name}
              </span>
            </div>
          )}
          {/* Group Badge Overlay */}
          {groupName && (
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                {groupName}
              </span>
            </div>
          )}
        </div>

        {/* Collection Info */}
        <div className="flex flex-1 flex-col justify-between p-5">
          <div className="space-y-3">
            {collection.description ? (
              <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                {collection.description}
              </p>
            ) : (
              <p className="text-sm italic text-slate-400">
                {t('collection_detail.no_description')}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge tone="blue">
                <FileText className="h-3.5 w-3.5" />
                {collection.lessonsCount || lessonsCount}{' '}
                {t('collection_detail.stat_lessons').toLowerCase()}
              </Badge>
              <Badge tone="emerald">
                <BookOpen className="h-3.5 w-3.5" />
                {totalWordsCount || collection.wordsCount || 0}{' '}
                {t('collection_detail.stat_words').toLowerCase()}
              </Badge>
              <Badge tone="slate">
                <GraduationCap className="h-3.5 w-3.5" />
                {groupName || 'General'}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onStartClick}>
              <Play />
              <span>{t('collection_detail.start_btn')}</span>
            </Button>
            <Button type="button" variant="outline">
              <Bookmark />
              <span>{t('collection_detail.save_collection')}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
