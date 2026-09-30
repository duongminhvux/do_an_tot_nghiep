'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  collectionService,
  lessonService,
} from '@/services/vocabulary.service';
import { learningService } from '@/services/learning.service';
import { CollectionItem, LessonItem } from '@/types/vocabulary';
import { CollectionProgressDetail } from '@/types/learning';
import {
  BookOpen,
  ArrowRight,
  ChevronRight,
  Home,
  FileText,
  BarChart3,
  Info,
} from 'lucide-react';
import { CollectionHero } from './components/CollectionHero';
import { CollectionProgressOverview } from './components/CollectionProgressOverview';
import { CollectionLessonsTab } from './components/CollectionLessonsTab';
import { CollectionStatsTab } from './components/CollectionStatsTab';
import { CollectionAboutTab } from './components/CollectionAboutTab';

// Tab items
const TAB_KEYS = [
  { id: 'lessons', labelKey: 'tab_lessons', icon: FileText },
  { id: 'stats', labelKey: 'tab_stats', icon: BarChart3 },
  { id: 'about', labelKey: 'tab_about', icon: Info },
] as const;

type TabId = typeof TAB_KEYS[number]['id'];

export default function CollectionDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const { t } = useTranslation('vocabulary');

  const [activeTab, setActiveTab] = useState<TabId>('lessons');

  // 1. Fetch Collection Detail by Slug
  const { data: collectionRes, isLoading: isColLoading } = useQuery({
    queryKey: ['collection-detail', slug],
    queryFn: () => collectionService.getBySlug(slug),
    enabled: !!slug,
  });

  const collection: CollectionItem | null = useMemo(() => {
    return (collectionRes as any)?.data || collectionRes || null;
  }, [collectionRes]);

  // 2. Fetch Lessons for this Collection
  const collectionId = collection?._id || '';

  const { data: lessonsRes, isLoading: isLessonsLoading } = useQuery({
    queryKey: ['collection-lessons', collectionId],
    queryFn: () => lessonService.getAll(collectionId),
    enabled: !!collectionId,
  });

  const lessons: LessonItem[] = useMemo(() => {
    const raw = (lessonsRes as any)?.data || lessonsRes || [];
    return Array.isArray(raw) ? raw : [];
  }, [lessonsRes]);

  // Total word count across all lessons
  const totalWordsCount = useMemo(() => {
    return lessons.reduce((acc, l) => acc + (l.wordsCount || 0), 0);
  }, [lessons]);

  // 3. Fetch Collection Progress
  const { data: progressRes } = useQuery({
    queryKey: ['collection-progress', collectionId],
    queryFn: () => learningService.getCollectionProgress(collectionId),
    enabled: !!collectionId,
  });

  const collectionProgress: CollectionProgressDetail | null = useMemo(() => {
    return (progressRes as any)?.data || progressRes || null;
  }, [progressRes]);

  const lessonProgressMap = useMemo(() => {
    const map = new Map<string, { progress: number; status: string }>();
    if (collectionProgress?.lessons) {
      collectionProgress.lessons.forEach((l: any) => {
        map.set(l.lessonId, { progress: l.progress, status: l.status });
      });
    }
    return map;
  }, [collectionProgress]);

  // Group name from populated groupId
  const groupName = useMemo(() => {
    if (!collection) return '';
    if (typeof collection.groupId === 'object' && collection.groupId !== null) {
      return (collection.groupId as any).name || '';
    }
    return '';
  }, [collection]);

  const handleStartClick = () => {
    const el = document.getElementById('lessons-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  // No slug state
  if (!slug) {
    return (
      <div className="w-full max-w-[1400px] mx-auto p-6 sm:p-8">
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">
            {t('collection_detail.not_found_title')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('collection_detail.not_found_desc')}
          </p>
          <Link
            href={`/${locale}/vocabulary`}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>{t('back')}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
          title={t('collection_detail.breadcrumb_home')}
        >
          <Home className="w-3.5 h-3.5" />
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <Link
          href={`/${locale}/vocabulary`}
          className="hover:text-blue-600 transition-colors font-medium"
        >
          {t('collection_detail.breadcrumb_vocab')}
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <Link
          href={`/${locale}/vocabulary`}
          className="hover:text-blue-600 transition-colors font-medium"
        >
          {t('collection_detail.breadcrumb_explore')}
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        {isColLoading ? (
          <span className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
        ) : (
          <span className="font-semibold text-slate-900 truncate max-w-[200px]">
            {collection?.name || '...'}
          </span>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <CollectionHero
        collection={collection}
        groupName={groupName}
        lessonsCount={lessons.length}
        totalWordsCount={totalWordsCount}
        isLoading={isColLoading}
        onStartClick={handleStartClick}
      />

      {/* 3. PROGRESS OVERVIEW */}
      <CollectionProgressOverview
        collectionProgress={collectionProgress}
        lessonsCount={lessons.length}
        totalWordsCount={totalWordsCount}
      />

      {/* 4. TAB NAVIGATION */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none">
        {TAB_KEYS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(`collection_detail.${tab.labelKey}`)}</span>
            </button>
          );
        })}
      </div>

      {/* 5. TAB CONTENT */}
      <div id="lessons-section">
        {activeTab === 'lessons' && (
          <CollectionLessonsTab
            lessons={lessons}
            lessonProgressMap={lessonProgressMap}
            isLessonsLoading={isLessonsLoading}
            slug={slug}
            locale={locale}
          />
        )}

        {activeTab === 'stats' && (
          <CollectionStatsTab
            collectionProgress={collectionProgress}
            lessons={lessons}
            lessonProgressMap={lessonProgressMap}
            totalWordsCount={totalWordsCount}
            slug={slug}
            locale={locale}
          />
        )}

        {activeTab === 'about' && (
          <CollectionAboutTab
            collection={collection}
            lessonsCount={lessons.length}
            totalWordsCount={totalWordsCount}
            groupName={groupName}
          />
        )}
      </div>
    </div>
  );
}
