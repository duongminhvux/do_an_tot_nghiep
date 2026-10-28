'use client';

import React, { useState, useMemo } from 'react';
import {StudyArtwork} from '@/components/study-artwork';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  collectionService,
  vocabularyGroupService,
} from '@/services/vocabulary.service';
import { learningService } from '@/services/learning.service';
import { CollectionItem, VocabularyGroupItem } from '@/types/vocabulary';
import { TodayStudyWidget } from './components/TodayStudyWidget';
import { UserAchievementsWidget } from './components/UserAchievementsWidget';
import { DueReviewBanner } from './components/DueReviewBanner';
import { DueReviewModal } from './components/DueReviewModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  LayoutGrid,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell, PageHeader, Panel, Badge, EmptyState, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

// Category badge tone based on group name
function getCategoryBadgeTone(groupName?: string): 'red' | 'blue' | 'amber' | 'emerald' | 'violet' {
  const lower = (groupName || '').toLowerCase();
  if (lower.includes('exam') || lower.includes('toeic') || lower.includes('ielts')) {
    return 'red';
  }
  if (lower.includes('general') || lower.includes('tổng quát')) {
    return 'blue';
  }
  if (lower.includes('textbook') || lower.includes('giáo trình') || lower.includes('destination')) {
    return 'amber';
  }
  if (lower.includes('cefr') || lower.includes('academic') || lower.includes('oxford')) {
    return 'emerald';
  }
  return 'violet';
}

function CollectionCover({ name, coverUrl, compact }: { name: string; coverUrl?: string; compact?: boolean }) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={name}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-blue-50 p-2 text-center text-blue-600">
      <BookOpen className={compact ? 'h-5 w-5' : 'mb-1 h-6 w-6'} />
      {!compact && <span className="max-w-full truncate text-xs font-semibold text-blue-700">{name}</span>}
    </div>
  );
}

const pillClass = (active: boolean) =>
  cn(
    'cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  );

const scrollToAll = () => {
  const el = document.getElementById('all-collections-section');
  el?.scrollIntoView({ behavior: 'smooth' });
};

export default function VocabularyPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('vocabulary');

  // Filter & Sort states
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'newest' | 'popular' | 'az'>('newest');

  // 1. Fetch Vocabulary Groups
  const { data: groupsRes } = useQuery({
    queryKey: ['vocabulary-groups'],
    queryFn: () => vocabularyGroupService.getAll({ limit: 50 }),
  });

  const groups: VocabularyGroupItem[] = useMemo(() => {
    return (groupsRes as any)?.data?.data || (groupsRes as any)?.data || [];
  }, [groupsRes]);

  // 2. Fetch Collections
  const { data: collectionsRes, isLoading: isColsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionService.getAll({ limit: 100 }),
  });

  const allCollections: CollectionItem[] = useMemo(() => {
    return (collectionsRes as any)?.data?.data || (collectionsRes as any)?.data || [];
  }, [collectionsRes]);

  // 2.1. Fetch Real User Progress by Collection
  const { data: vocabProgressRes } = useQuery({
    queryKey: ['user-vocabulary-progress'],
    queryFn: () => learningService.getVocabularyProgressList(),
    staleTime: 30 * 1000,
  });

  const progressMap = useMemo(() => {
    const rawList =
      vocabProgressRes?.data || (Array.isArray(vocabProgressRes) ? vocabProgressRes : []);
    const map = new Map<string, number>();
    rawList.forEach((item: any) => {
      const prog = item.progress || 0;
      if (item.collectionId) {
        map.set(String(item.collectionId), prog);
      }
      if (item.collectionSlug) {
        map.set(String(item.collectionSlug), prog);
      }
    });
    return map;
  }, [vocabProgressRes]);

  // Merge real progress into collection items
  const allCollectionsWithProgress = useMemo(() => {
    return allCollections.map((col) => {
      const colId = String(col._id);
      const colSlug = col.slug || '';
      const userProg = progressMap.get(colId) ?? progressMap.get(colSlug) ?? 0;
      return {
        ...col,
        progress: userProg,
      };
    });
  }, [allCollections, progressMap]);

  // 3. Fetch Real Dashboard Study Stats (Today's count, streak, total learned, total mastered)
  const { data: statsRes, isLoading: isStatsLoading } = useQuery({
    queryKey: ['dashboard-study-stats'],
    queryFn: () => learningService.getDashboardStats(),
    staleTime: 60 * 1000,
  });

  const dashboardStats = useMemo(() => {
    return (statsRes as any)?.data || statsRes || undefined;
  }, [statsRes]);

  // 4. Fetch Due Review Stats (for banner & modal)
  const { data: dueCheckRes } = useQuery({
    queryKey: ['due-reviews-check'],
    queryFn: () => learningService.checkDueReviews(),
    staleTime: 60 * 1000,
  });

  const dueCheckData = useMemo(() => {
    return (dueCheckRes as any)?.data || dueCheckRes || undefined;
  }, [dueCheckRes]);

  // Filter collections by selected group
  const filteredCollections = useMemo(() => {
    let result = [...allCollectionsWithProgress];

    if (selectedGroupId !== 'all') {
      result = result.filter((col) => {
        const colGroupId =
          typeof col.groupId === 'object' && col.groupId !== null
            ? (col.groupId as any)._id
            : col.groupId;
        return colGroupId === selectedGroupId;
      });
    }

    if (sortOption === 'az') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'popular') {
      result.sort((a, b) => (b.lessonsCount || 0) - (a.lessonsCount || 0));
    } else {
      result.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return result;
  }, [allCollectionsWithProgress, selectedGroupId, sortOption]);

  // Featured collections: top 4 collections from database
  const featuredCollections = useMemo(() => {
    if (allCollectionsWithProgress.length <= 4) return allCollectionsWithProgress;
    return allCollectionsWithProgress.slice(0, 4);
  }, [allCollectionsWithProgress]);

  // Recommended collections: top 3 collections from database
  const recommendedCollections = useMemo(() => {
    if (allCollectionsWithProgress.length <= 3) return allCollectionsWithProgress;
    return allCollectionsWithProgress.slice(0, 3);
  }, [allCollectionsWithProgress]);

  return (
    <PageShell>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* LEFT COLUMN: Main Catalog */}
        <div className="min-w-0 space-y-6 xl:col-span-8 2xl:col-span-9">
          {/* Hero */}
          <div className="flex flex-col items-center justify-between gap-6 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 md:flex-row">
            <div className="max-w-xl">
              <PageHeader
                eyebrow={t('catalog.badge')}
                title={t('catalog.title')}
                description={t('catalog.subtitle')}
              />
              <Button type="button" onClick={scrollToAll} className="mt-5">
                <span>{t('catalog.start_btn')}</span>
                <ArrowRight />
              </Button>
            </div>

            <div className="flex w-48 shrink-0 items-center justify-center sm:w-60 md:w-64 lg:w-72">
              <StudyArtwork className="h-auto w-full select-none rounded-lg" />
            </div>
          </div>

          {/* Due Review Alert Banner */}
          <DueReviewBanner
            dueCount={dueCheckData?.dueCount ?? 0}
            previewWords={dueCheckData?.previewWords}
            locale={locale}
          />

          {/* Featured Collections */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              {t('catalog.featured_title')}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isColsLoading
                ? [1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn(surface, 'space-y-3 p-4')}>
                      <Skeleton className="aspect-[16/9] w-full rounded-lg" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))
                : featuredCollections.length === 0 ? (
                    <EmptyState
                      icon={FolderKanban}
                      title={t('catalog.no_featured')}
                      className="col-span-full py-10"
                    />
                  ) : (
                    featuredCollections.map((col) => {
                      const groupName =
                        typeof col.groupId === 'object' && col.groupId !== null
                          ? (col.groupId as any).name
                          : 'General';
                      const progress = (col as any).progress ?? 0;

                      return (
                        <Link
                          key={col._id}
                          href={`/${locale}/vocabulary/collection/${col.slug || col._id}`}
                          className={cn(
                            surface,
                            'group flex flex-col justify-between p-4 transition-colors hover:border-blue-300',
                          )}
                        >
                          <div className="space-y-2.5">
                            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-100">
                              <CollectionCover name={col.name} coverUrl={col.coverUrl} />
                            </div>

                            <Badge tone={getCategoryBadgeTone(groupName)}>{groupName}</Badge>

                            <div>
                              <h3 className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                                {col.name}
                              </h3>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {t('catalog.lessons_count', {
                                  lessons: col.lessonsCount || 0,
                                  defaultValue: `${col.lessonsCount || 0} bài học`,
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <div className="flex-1 space-y-1">
                              <span className="text-xs font-medium text-slate-500">
                                {progress > 0 ? `${progress}%` : t('catalog.not_studied')}
                              </span>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                {progress > 0 && (
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${progress}%` }}
                                  />
                                )}
                              </div>
                            </div>

                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-primary group-hover:text-white">
                              <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
            </div>
          </section>

          {/* All Collections */}
          <section id="all-collections-section" className="scroll-mt-20 space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-slate-400" />
                <h2 className="text-base font-semibold text-slate-900">
                  {t('catalog.all_collections_title')}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId('all')}
                    className={pillClass(selectedGroupId === 'all')}
                  >
                    {t('catalog.filter_all')}
                  </button>
                  {groups.slice(0, 4).map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() => setSelectedGroupId(g._id)}
                      className={pillClass(selectedGroupId === g._id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <Select
                  value={sortOption}
                  onValueChange={(val) => setSortOption(val as any)}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[140px] rounded-lg border-slate-200 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="newest">{t('catalog.sort_newest')}</SelectItem>
                    <SelectItem value="popular">{t('catalog.sort_popular')}</SelectItem>
                    <SelectItem value="az">{t('catalog.sort_az')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isColsLoading
                ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className={cn(surface, 'flex items-center gap-3 p-4')}>
                      <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))
                : filteredCollections.length === 0 ? (
                    <EmptyState
                      icon={FolderKanban}
                      title={t('catalog.no_collections_found')}
                      description={
                        selectedGroupId !== 'all'
                          ? t('catalog.no_collections_hint_filter')
                          : t('catalog.no_collections_hint_empty')
                      }
                      className="col-span-full"
                    />
                  ) : (
                    filteredCollections.map((col) => {
                      const groupName =
                        typeof col.groupId === 'object' && col.groupId !== null
                          ? (col.groupId as any).name
                          : 'General';
                      const progress = (col as any).progress ?? 0;

                      return (
                        <Link
                          key={col._id}
                          href={`/${locale}/vocabulary/collection/${col.slug || col._id}`}
                          className={cn(
                            surface,
                            'group flex flex-col justify-between p-4 transition-colors hover:border-blue-300',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100">
                              <CollectionCover name={col.name} coverUrl={col.coverUrl} compact />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <Badge tone={getCategoryBadgeTone(groupName)} className="max-w-full truncate px-2 text-[11px]">
                                {groupName}
                              </Badge>
                              <h3 className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                                {col.name}
                              </h3>
                              <p className="truncate text-xs text-slate-500">
                                {t('catalog.lessons_count', {
                                  lessons: col.lessonsCount || 0,
                                  defaultValue: `${col.lessonsCount || 0} bài học`,
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <div className="flex-1 space-y-1">
                              <span className="text-[11px] font-medium text-slate-500">
                                {progress > 0 ? `${progress}%` : t('catalog.not_studied')}
                              </span>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                {progress > 0 && (
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${progress}%` }}
                                  />
                                )}
                              </div>
                            </div>

                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-primary group-hover:text-white">
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Study Stats & Widgets */}
        <div className="space-y-6 xl:col-span-4 2xl:col-span-3">
          <TodayStudyWidget
            stats={dashboardStats}
            isLoading={isStatsLoading}
            locale={locale}
          />

          <UserAchievementsWidget
            stats={dashboardStats}
            isLoading={isStatsLoading}
          />

          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                {t('catalog.recommendations_title')}
              </span>
            }
            action={
              <Button type="button" variant="link" size="sm" onClick={scrollToAll} className="h-auto px-0">
                {t('catalog.view_all')}
              </Button>
            }
            bodyClassName="space-y-1"
          >
            {recommendedCollections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                {t('catalog.no_recommendations')}
              </div>
            ) : (
              recommendedCollections.map((item) => (
                <Link
                  key={item._id}
                  href={`/${locale}/vocabulary/collection/${item.slug || item._id}`}
                  className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex aspect-[16/9] w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-blue-50 text-blue-600">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 transition-colors group-hover:text-blue-600">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {t('catalog.lessons_count', {
                          lessons: item.lessonsCount || 0,
                          defaultValue: `${item.lessonsCount || 0} bài học`,
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-600" />
                </Link>
              ))
            )}
          </Panel>

          {/* Inspirational Quote Card */}
          <div className={cn(surface, 'overflow-hidden')}>
            <div className="space-y-2 p-5">
              <p className="text-sm font-semibold leading-relaxed text-slate-900">
                {t('catalog.quote_text')}
              </p>
              <p className="text-xs text-slate-500">
                {t('catalog.quote_author')}
              </p>
            </div>
            <div className="h-24 overflow-hidden">
              <StudyArtwork kind="landscape" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Auto-popup when user has words due for review */}
      <DueReviewModal locale={locale} />
    </PageShell>
  );
}
