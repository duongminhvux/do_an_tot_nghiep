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
  ArrowLeft,
  FileText,
  BarChart3,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell, PageHeader, Tabs, EmptyState } from '@/components/ui/page';
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

  const breadcrumbs = [
    { label: t('collection_detail.breadcrumb_home'), href: `/${locale}` },
    { label: t('collection_detail.breadcrumb_vocab'), href: `/${locale}/vocabulary` },
    { label: t('collection_detail.breadcrumb_explore'), href: `/${locale}/vocabulary` },
    { label: isColLoading ? '...' : collection?.name || '...' },
  ];

  // No slug state
  if (!slug) {
    return (
      <PageShell>
        <EmptyState
          icon={BookOpen}
          title={t('collection_detail.not_found_title')}
          description={t('collection_detail.not_found_desc')}
          action={
            <Button asChild size="sm">
              <Link href={`/${locale}/vocabulary`}>
                <ArrowLeft />
                <span>{t('back')}</span>
              </Link>
            </Button>
          }
          className="py-20"
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          isColLoading ? (
            <Skeleton className="h-8 w-64 max-w-full" />
          ) : (
            collection?.name || '...'
          )
        }
      />

      {/* HERO SECTION */}
      <CollectionHero
        collection={collection}
        groupName={groupName}
        lessonsCount={lessons.length}
        totalWordsCount={totalWordsCount}
        isLoading={isColLoading}
        onStartClick={handleStartClick}
      />

      {/* PROGRESS OVERVIEW */}
      <CollectionProgressOverview
        collectionProgress={collectionProgress}
        lessonsCount={lessons.length}
        totalWordsCount={totalWordsCount}
      />

      {/* TABS + CONTENT */}
      <div id="lessons-section" className="scroll-mt-20 space-y-5">
        <Tabs
          items={TAB_KEYS.map((tab) => {
            const Icon = tab.icon;
            return {
              value: tab.id,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  {t(`collection_detail.${tab.labelKey}`)}
                </span>
              ),
            };
          })}
          value={activeTab}
          onChange={setActiveTab}
        />

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
    </PageShell>
  );
}
