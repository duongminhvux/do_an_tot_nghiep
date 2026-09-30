'use client';

import React, { useState, useMemo } from 'react';
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
  GraduationCap,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  FolderKanban,
  CheckCircle2,
  TrendingUp,
  Bookmark,
} from 'lucide-react';

// Category color badges based on group name
function getCategoryBadgeStyle(groupName?: string) {
  const lower = (groupName || '').toLowerCase();
  if (lower.includes('exam') || lower.includes('toeic') || lower.includes('ielts')) {
    return 'bg-rose-50 text-rose-600 border-rose-200';
  }
  if (lower.includes('general') || lower.includes('tổng quát')) {
    return 'bg-blue-50 text-blue-600 border-blue-200';
  }
  if (lower.includes('textbook') || lower.includes('giáo trình') || lower.includes('destination')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (lower.includes('cefr') || lower.includes('academic') || lower.includes('oxford')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  return 'bg-purple-50 text-purple-700 border-purple-200';
}

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
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: Main Catalog (8-9 cols on desktop)          */}
        {/* ======================================================== */}
        <div className="xl:col-span-8 2xl:col-span-9 space-y-8 min-w-0">
          
          {/* 1. Hero Welcome Banner */}
          <div className="relative rounded border border-blue-100 bg-gradient-to-r from-blue-50/90 via-sky-50 to-indigo-50/70 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
            {/* Background subtle glow shapes */}
            <div className="absolute top-0 right-1/4 w-80 h-80 rounded-full bg-blue-200/30 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-10 w-64 h-64 rounded-full bg-indigo-200/20 blur-2xl pointer-events-none" />

            {/* Left Content */}
            <div className="space-y-2.5 max-w-xl relative z-10">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 block">
                {t('catalog.badge')}
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {t('catalog.title')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg">
                {t('catalog.subtitle')}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('all-collections-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  <span>{t('catalog.start_btn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Graphic Illustration */}
            <div className="relative z-10 shrink-0 w-48 sm:w-60 md:w-72 lg:w-80 flex items-center justify-center">
              <img
                src="/images/vocab-hero-student.jpg"
                alt="Student studying English"
                className="w-full h-auto object-contain rounded drop-shadow-sm select-none"
              />
            </div>
          </div>

          {/* 2. Due Review Alert Banner (Chỉ hiển thị khi có từ cần ôn tập) */}
          <DueReviewBanner
            dueCount={dueCheckData?.dueCount ?? 0}
            previewWords={dueCheckData?.previewWords}
            locale={locale}
          />

          {/* 3. Section: "Bộ sưu tập nổi bật" (Featured Collections) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {t('catalog.featured_title')}
              </h2>
            </div>

            {/* Featured Grid (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isColsLoading
                ? [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rounded border border-slate-200 bg-white p-3 space-y-3 animate-pulse"
                    >
                      <div className="w-full aspect-[16/9] rounded bg-slate-100" />
                      <div className="h-4 w-20 rounded bg-slate-100" />
                      <div className="h-4 w-32 rounded bg-slate-100" />
                      <div className="h-3 w-24 rounded bg-slate-100" />
                    </div>
                  ))
                : featuredCollections.length === 0 ? (
                    <div className="col-span-full py-10 text-center rounded border border-dashed border-slate-200 bg-white">
                      <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-600">{t('catalog.no_featured')}</p>
                    </div>
                  ) : (
                    featuredCollections.map((col) => {
                      const groupName =
                        typeof col.groupId === 'object' && col.groupId !== null
                          ? (col.groupId as any).name
                          : 'General';
                      const badgeClass = getCategoryBadgeStyle(groupName);
                      const progress = (col as any).progress ?? 0;

                      return (
                        <Link
                          key={col._id}
                          href={`/${locale}/vocabulary/collection/${col.slug || col._id}`}
                          className="group rounded border border-slate-200 bg-white p-3 hover:border-blue-400 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            {/* 16:9 Thumbnail Image */}
                            <div className="w-full aspect-[16/9] rounded overflow-hidden border border-slate-100 bg-slate-900 relative">
                              {col.coverUrl ? (
                                <img
                                  src={col.coverUrl}
                                  alt={col.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-blue-900 to-indigo-950 text-white">
                                  <BookOpen className="w-6 h-6 text-blue-300 mb-1" />
                                  <span className="text-xs font-bold truncate max-w-full">
                                    {col.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Category Badge */}
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                            >
                              {groupName}
                            </span>

                            {/* Title & Metadata */}
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {col.name}
                              </h3>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {t('catalog.lessons_count', {
                                  lessons: col.lessonsCount || 0,
                                  defaultValue: `${col.lessonsCount || 0} bài học`,
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Progress Bar & Arrow (Actual data) */}
                          <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span>{progress > 0 ? `${progress}%` : t('catalog.not_studied')}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                {progress > 0 && (
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="w-6 h-6 rounded-full border border-blue-200 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
            </div>
          </div>

          {/* 4. Section: "Tất cả bộ sưu tập" (All Collections) */}
          <div id="all-collections-section" className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-slate-400" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {t('catalog.all_collections_title')}
                </h2>
              </div>

              {/* Filter Pills & Sort Dropdown */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId('all')}
                    className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer ${
                      selectedGroupId === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t('catalog.filter_all')}
                  </button>
                  {groups.slice(0, 4).map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() => setSelectedGroupId(g._id)}
                      className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer ${
                        selectedGroupId === g._id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                {/* Sort Selector */}
                <Select
                  value={sortOption}
                  onValueChange={(val) => setSortOption(val as any)}
                >
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-xs font-semibold rounded-[6px] border-slate-200">
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

            {/* Collections Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isColsLoading
                ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="rounded border border-slate-200 bg-white p-3 flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-16 h-16 rounded bg-slate-100 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                        <div className="h-4 w-28 bg-slate-100 rounded" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                      </div>
                    </div>
                  ))
                : filteredCollections.length === 0 ? (
                    <div className="col-span-full py-12 text-center rounded border border-dashed border-slate-200 bg-white">
                      <FolderKanban className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">{t('catalog.no_collections_found')}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedGroupId !== 'all' ? t('catalog.no_collections_hint_filter') : t('catalog.no_collections_hint_empty')}
                      </p>
                    </div>
                  ) : (
                    filteredCollections.map((col) => {
                      const groupName =
                        typeof col.groupId === 'object' && col.groupId !== null
                          ? (col.groupId as any).name
                          : 'General';
                      const badgeClass = getCategoryBadgeStyle(groupName);
                      const progress = (col as any).progress ?? 0;

                      return (
                        <Link
                          key={col._id}
                          href={`/${locale}/vocabulary/collection/${col.slug || col._id}`}
                          className="group rounded border border-slate-200 bg-white p-3 hover:border-blue-400 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
                        >
                          <div className="flex items-start gap-3">
                            {/* Thumbnail Left Box (16:9 aspect) */}
                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded overflow-hidden border border-slate-100 bg-slate-900 shrink-0 relative">
                              {col.coverUrl ? (
                                <img
                                  src={col.coverUrl}
                                  alt={col.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-gradient-to-br from-slate-800 to-indigo-950 text-white">
                                  <BookOpen className="w-5 h-5 text-blue-300" />
                                </div>
                              )}
                            </div>

                            {/* Info Right */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <span
                                className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-bold border ${badgeClass}`}
                              >
                                {groupName}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {col.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium truncate">
                                {t('catalog.lessons_count', {
                                  lessons: col.lessonsCount || 0,
                                  defaultValue: `${col.lessonsCount || 0} bài học`,
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Bottom Progress Bar & Button (Actual data) */}
                          <div className="pt-2 mt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                            <div className="flex-1 space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400">
                                {progress > 0 ? `${progress}%` : t('catalog.not_studied')}
                              </span>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                {progress > 0 && (
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="w-5 h-5 rounded-full border border-blue-200 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                              <ArrowRight className="w-2.5 h-2.5" />
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Study Stats & Widgets (4 cols)             */}
        {/* ======================================================== */}
        <div className="xl:col-span-4 2xl:col-span-3 space-y-5">
          
          {/* Widget 1: "Học hôm nay" (Daily Learning Progress - Real Data) */}
          <TodayStudyWidget
            stats={dashboardStats}
            isLoading={isStatsLoading}
            locale={locale}
          />

          {/* Widget 2: "Thành tích của bạn" (Achievements - Real Data) */}
          <UserAchievementsWidget
            stats={dashboardStats}
            isLoading={isStatsLoading}
          />

          {/* Widget 3: "Gợi ý cho bạn" (Real Collections from DB) */}
          <div className="rounded border border-slate-200 bg-white p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">{t('catalog.recommendations_title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('all-collections-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                {t('catalog.view_all')}
              </button>
            </div>

            {/* Recommendations List from real DB collections */}
            <div className="space-y-2">
              {recommendedCollections.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded">
                  {t('catalog.no_recommendations')}
                </div>
              ) : (
                recommendedCollections.map((item) => (
                  <Link
                    key={item._id}
                    href={`/${locale}/vocabulary/collection/${item.slug || item._id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 aspect-[16/9] rounded-[4px] overflow-hidden bg-slate-900 text-white flex items-center justify-center shrink-0 border border-slate-200">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5 text-blue-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {t('catalog.lessons_count', {
                            lessons: item.lessonsCount || 0,
                            defaultValue: `${item.lessonsCount || 0} bài học`,
                          })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Widget 4: Inspirational Quote Card */}
          <div className="rounded border border-blue-100 bg-gradient-to-b from-blue-50/80 via-sky-50/50 to-indigo-50/80 p-5 relative overflow-hidden shadow-2xs">
            <div className="relative z-10 space-y-3">
              <p className="text-sm font-bold text-slate-900 leading-relaxed">
                {t('catalog.quote_text')}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {t('catalog.quote_author')}
              </p>
            </div>

            {/* Mountains image at bottom */}
            <div className="mt-4 -mx-5 -mb-5 h-24 overflow-hidden relative">
              <img
                src="/images/vocab-quote-mountains.jpg"
                alt="Mountains landscape"
                className="w-full h-full object-cover object-bottom opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-blue-50/60" />
            </div>
          </div>

        </div>

      </div>

      {/* Auto-popup when user has words due for review */}
      <DueReviewModal locale={locale} />
    </div>
  );
}
