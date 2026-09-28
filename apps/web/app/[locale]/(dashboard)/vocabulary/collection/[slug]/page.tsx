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
import {
  BookOpen,
  ArrowRight,
  ChevronRight,
  Play,
  Bookmark,
  Home,
  Clock,
  FileText,
  BarChart3,
  Info,
  GraduationCap,
  Layers,
} from 'lucide-react';

// Tab items
const TABS = [
  { id: 'lessons', label: 'Danh sách bài học', icon: FileText },
  { id: 'words', label: 'Từ vựng', icon: BookOpen },
  { id: 'stats', label: 'Thống kê', icon: BarChart3 },
  { id: 'about', label: 'Giới thiệu', icon: Info },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CollectionDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const { t } = useTranslation('common');

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

  // 2. Fetch Lessons for this Collection (need collection _id)
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

  const collectionProgress = useMemo(() => {
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



  // No slug state
  if (!slug) {
    return (
      <div className="w-full max-w-[1400px] mx-auto p-6 sm:p-8">
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">
            Không tìm thấy bộ sưu tập
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Vui lòng quay lại trang khám phá để chọn bộ sưu tập.
          </p>
          <Link
            href={`/${locale}/vocabulary`}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>Quay lại</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ===================== */}
      {/* 1. BREADCRUMB */}
      {/* ===================== */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <Link
          href={`/${locale}/vocabulary`}
          className="hover:text-blue-600 transition-colors font-medium"
        >
          Vocabulary
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <Link
          href={`/${locale}/vocabulary`}
          className="hover:text-blue-600 transition-colors font-medium"
        >
          Khám phá
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

      {/* ===================== */}
      {/* 2. HERO SECTION */}
      {/* ===================== */}
      {isColLoading ? (
        <div className="rounded border border-slate-200 bg-white p-6 flex flex-col md:flex-row gap-6 animate-pulse">
          <div className="w-full md:w-80 aspect-[16/9] rounded bg-slate-100" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-28 bg-slate-100 rounded" />
            <div className="h-8 w-64 bg-slate-100 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
          </div>
        </div>
      ) : collection ? (
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
                    <span className="font-semibold">{collection.lessonsCount || lessons.length} bài học</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-semibold">{totalWordsCount || collection.wordsCount || 0} từ vựng</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-semibold">
                      {groupName || 'Tổng quát'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-4 sm:mt-5">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('lessons-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Bắt đầu học</span>
                </button>
                <button
                  type="button"
                  className="px-4 py-2.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Lưu bộ sưu tập</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===================== */}
      {/* 3. PROGRESS OVERVIEW */}
      {/* ===================== */}
      <div className="rounded border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Tiến độ của bạn</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">
              {collectionProgress?.completedLessonsCount || 0}/{lessons.length} bài đã hoàn thành
            </span>
            <span className="font-bold text-blue-600">
              {collectionProgress?.overallProgress || 0}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${collectionProgress?.overallProgress || 0}%` }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="flex items-center gap-2.5 p-3 rounded bg-emerald-50/60 border border-emerald-100">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Đã thuộc</p>
              <p className="text-base font-black text-slate-900">0</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded bg-amber-50/60 border border-amber-100">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Đang học</p>
              <p className="text-base font-black text-slate-900">0</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded bg-rose-50/60 border border-rose-100">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Chưa thuộc</p>
              <p className="text-base font-black text-slate-900">{totalWordsCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded bg-blue-50/60 border border-blue-100">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Thời gian học</p>
              <p className="text-sm font-black text-slate-900">0 phút</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== */}
      {/* 4. TAB NAVIGATION */}
      {/* ===================== */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
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
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================== */}
      {/* 5. TAB CONTENT */}
      {/* ===================== */}
      <div id="lessons-section">
        {activeTab === 'lessons' && (
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
                        Chưa có bài học nào
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Bộ sưu tập này chưa có bài học. Hãy quay lại sau!
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
                                <span>{lesson.wordsCount || 0} từ vựng</span>
                              </div>
                              {lesson.sectionsCount !== undefined && lesson.sectionsCount > 0 && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1 text-blue-600 font-semibold">
                                    <Layers className="w-3 h-3" />
                                    <span>{lesson.sectionsCount} phần</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Bottom: Progress */}
                          {(() => {
                            const lp = lessonProgressMap.get(lesson._id);
                            const prog = lp?.progress ?? 0;
                            const st = lp?.status ?? 'NOT_STARTED';

                            return (
                              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between gap-2">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                    {st === 'COMPLETED' ? (
                                      <span className="text-emerald-600 font-bold">Đã hoàn thành</span>
                                    ) : st === 'IN_PROGRESS' ? (
                                      <span className="text-blue-600 font-bold">Đang học ({prog}%)</span>
                                    ) : (
                                      <span>Chưa học</span>
                                    )}
                                    {prog > 0 && <span className="font-semibold text-slate-500">{prog}%</span>}
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
        )}

        {activeTab === 'words' && (
          <div className="rounded border border-dashed border-slate-200 bg-white p-10 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Từ vựng của bộ sưu tập
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tổng cộng {totalWordsCount} từ vựng trong {lessons.length} bài học. Chọn bài học để xem chi tiết từ vựng.
            </p>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="rounded border border-dashed border-slate-200 bg-white p-10 text-center">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Thống kê học tập
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Chưa có dữ liệu thống kê. Hãy bắt đầu học để xem tiến độ của bạn!
            </p>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="rounded border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Giới thiệu về {collection?.name || 'bộ sưu tập'}
            </h3>
            {collection?.description ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                {collection.description}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Chưa có mô tả cho bộ sưu tập này.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded bg-blue-50/60 border border-blue-100 text-center">
                <p className="text-lg font-black text-slate-900">
                  {collection?.lessonsCount || lessons.length}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Bài học</p>
              </div>
              <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100 text-center">
                <p className="text-lg font-black text-slate-900">
                  {totalWordsCount}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Từ vựng</p>
              </div>
              <div className="p-3 rounded bg-amber-50/60 border border-amber-100 text-center">
                <p className="text-lg font-black text-slate-900">
                  {groupName || 'N/A'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Nhóm</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
