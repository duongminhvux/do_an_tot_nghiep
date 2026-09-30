'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Flame,
  BookOpen,
  RotateCcw,
  Clock,
  Calendar as CalendarIcon,
  ArrowRight,
  Target,
  Sparkles,
  Loader2,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import { useAppSelector } from '@/redux/hooks';
import { learningService } from '@/services/learning.service';
import {
  UserProgressOverview,
  CollectionVocabularyProgressItem,
  DailyActivityItem,
  TodayTasksResult,
} from '@/types/learning';

export default function StudentHomePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'vi';
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation('common');

  // 1. GET /progress/overview
  const { data: overviewRes, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => learningService.getProgressOverview(),
    staleTime: 60 * 1000,
  });
  const overview: UserProgressOverview | undefined = overviewRes?.data || overviewRes;

  // 2. GET /progress/vocabulary
  const { data: vocabRes, isLoading: isVocabLoading } = useQuery({
    queryKey: ['progress-vocabulary'],
    queryFn: () => learningService.getVocabularyProgressList(),
    staleTime: 60 * 1000,
  });
  const vocabularyProgressList: CollectionVocabularyProgressItem[] =
    vocabRes?.data || (Array.isArray(vocabRes) ? vocabRes : []);

  // 3. GET /progress/activity?days=90
  const { data: activityRes, isLoading: isActivityLoading } = useQuery({
    queryKey: ['progress-activity-90'],
    queryFn: () => learningService.getActivityHistory(90),
    staleTime: 60 * 1000,
  });
  const activityList: DailyActivityItem[] =
    activityRes?.data || (Array.isArray(activityRes) ? activityRes : []);

  // 5. GET /learning/today-tasks
  const { data: tasksRes, isLoading: isTasksLoading } = useQuery({
    queryKey: ['learning-today-tasks'],
    queryFn: () => learningService.getTodayTasks(),
    staleTime: 60 * 1000,
  });
  const todayTasks: TodayTasksResult | undefined = tasksRes?.data || tasksRes;

  // Format today's date string: "Thứ 3, 30 tháng 9, 2025"
  const formattedToday = useMemo(() => {
    const now = new Date();
    try {
      if (locale === 'vi') {
        const weekdayNames = [
          'Chủ nhật',
          'Thứ 2',
          'Thứ 3',
          'Thứ 4',
          'Thứ 5',
          'Thứ 6',
          'Thứ 7',
        ];
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const weekday = weekdayNames[now.getDay()];
        return `${weekday}, ${day} tháng ${month}, ${year}`;
      } else {
        return new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(now);
      }
    } catch {
      return now.toLocaleDateString();
    }
  }, [locale]);

  // Format study time: e.g. 4h 32m
  const formatMinutes = (totalMins: number = 0) => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  // Hovered day cell state for real-time activity details
  const [hoveredCell, setHoveredCell] = useState<{
    dateStr: string;
    dayNumber: number;
    level: string;
    isFuture: boolean;
    isToday: boolean;
    activity?: DailyActivityItem;
  } | null>(null);

  const formatCellFullDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        const dt = new Date(y, m - 1, d);
        if (locale === 'vi') {
          const daysOfWeek = [
            'Chủ nhật',
            'Thứ hai',
            'Thứ ba',
            'Thứ tư',
            'Thứ năm',
            'Thứ sáu',
            'Thứ bảy',
          ];
          return `${daysOfWeek[dt.getDay()]}, ${d} tháng ${m}, ${y}`;
        } else {
          return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(dt);
        }
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Build matrix heatmap 7 columns (T2 to CN) x 6 rows (Tuần 1 to Tuần 6) strictly from real data
  const heatmapWeeks = useMemo(() => {
    const toLocalDateKey = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dateMap = new Map<string, DailyActivityItem>();
    activityList.forEach((act) => {
      const dKey =
        act.dateKey ||
        (act.date
          ? act.date.length === 10
            ? act.date
            : toLocalDateKey(new Date(act.date))
          : '');
      if (dKey) {
        dateMap.set(dKey, act);
      }
    });

    const weeks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toLocalDateKey(today);

    // Tìm ngày Chủ nhật của tuần hiện tại làm mốc kết thúc
    const currentDayOfWeek = today.getDay(); // 0 (CN) -> 6 (T7)
    const diffToSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + diffToSunday);

    // Hiển thị 6 tuần gần nhất
    for (let w = 5; w >= 0; w--) {
      const days = [];
      for (let d = 6; d >= 0; d--) {
        const cellDate = new Date(endSunday);
        cellDate.setDate(endSunday.getDate() - (w * 7 + d));
        const cellDateKey = toLocalDateKey(cellDate);
        const isFuture = cellDateKey > todayKey;
        const isToday = cellDateKey === todayKey;
        const act = dateMap.get(cellDateKey);

        let level: 'none' | 'light' | 'active' = 'none';
        if (
          act &&
          (act.studyMinutes > 0 || act.sessionCount > 0 || act.wordsLearned > 0)
        ) {
          if (
            act.wordsLearned >= 5 ||
            act.studyMinutes >= 10 ||
            act.sessionCount >= 2
          ) {
            level = 'active'; // Có học tích cực
          } else {
            level = 'light'; // Ít hoạt động
          }
        }

        days.push({
          dateStr: cellDateKey,
          dayNumber: cellDate.getDate(),
          isFuture,
          isToday,
          level,
          activity: act,
        });
      }
      weeks.push(days);
    }
    return weeks;
  }, [activityList]);

  // Color badges for collection letters
  const collectionColors = [
    { bg: 'bg-emerald-500', text: 'text-white' },
    { bg: 'bg-blue-600', text: 'text-white' },
    { bg: 'bg-indigo-600', text: 'text-white' },
    { bg: 'bg-purple-600', text: 'text-white' },
    { bg: 'bg-amber-500', text: 'text-white' },
  ];

  // Fallback demo collections if database is fresh
  const displayCollections = useMemo(() => {
    if (vocabularyProgressList && vocabularyProgressList.length > 0) {
      return vocabularyProgressList.slice(0, 4);
    }
    return [
      {
        collectionId: 'oxford-3000',
        collectionName: 'Oxford 3000',
        collectionSlug: 'oxford-3000',
        letter: 'A',
        totalWords: 3000,
        learnedWords: 216,
        progress: 72,
      },
      {
        collectionId: 'destination-b2',
        collectionName: 'Destination B2',
        collectionSlug: 'destination-b2',
        letter: 'B',
        totalWords: 300,
        learnedWords: 138,
        progress: 46,
      },
      {
        collectionId: 'destination-c1-c2',
        collectionName: 'Destination C1&C2',
        collectionSlug: 'destination-c1-c2',
        letter: 'B',
        totalWords: 300,
        learnedWords: 96,
        progress: 32,
      },
    ];
  }, [vocabularyProgressList]);

  // Handle CTA button clicks
  const handleStartReview = () => {
    router.push(`/${locale}/vocabulary/review`);
  };

  const handleStartLesson = () => {
    if (todayTasks?.currentLesson?.collectionSlug && todayTasks?.currentLesson?.slug) {
      router.push(
        `/${locale}/vocabulary/${todayTasks.currentLesson.collectionSlug}/lessons/${todayTasks.currentLesson.slug}`,
      );
    } else {
      router.push(`/${locale}/vocabulary`);
    }
  };

  const userName =
    user?.username || (user?.email ? user.email.split('@')[0] : 'bạn');

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP HEADER GREETING & DATE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Xin chào, {userName}!</span>
            <span className="inline-block animate-wiggle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Hôm nay là một ngày tuyệt vời để học thêm những điều mới!
          </p>
        </div>

        {/* Date Pill Widget */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/80 shadow-xs text-xs sm:text-sm font-semibold text-slate-700 self-start sm:self-auto">
          <CalendarIcon className="w-4 h-4 text-blue-600" />
          <span>{formattedToday}</span>
        </div>
      </div>

      {/* 2. FOUR MAIN STAT METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chuỗi học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-amber-200 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 fill-amber-400 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Chuỗi học</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {overview?.currentStreak ?? 5} ngày
            </p>
            <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>↑</span>
              <span>{overview?.streakGrowth ?? 2} ngày so với tuần trước</span>
            </p>
          </div>
        </div>

        {/* Card 2: Tổng từ đã học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-blue-200 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Tổng từ đã học</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {overview?.totalWordsLearned ?? 328} từ
            </p>
            <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>↑</span>
              <span>{overview?.wordsLearnedGrowth ?? 12} từ so với tuần trước</span>
            </p>
          </div>
        </div>

        {/* Card 3: Tổng từ đã ôn */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-purple-200 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Tổng từ đã ôn</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {overview?.totalWordsReviewed ?? 156} từ
            </p>
            <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>↑</span>
              <span>{overview?.wordsReviewedGrowth ?? 8} từ so với tuần trước</span>
            </p>
          </div>
        </div>

        {/* Card 4: Thời gian học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-sky-200 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Thời gian học</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {overview?.totalStudyMinutes
                ? formatMinutes(overview.totalStudyMinutes)
                : '4h 32m'}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>↑</span>
              <span>
                {overview?.studyMinutesGrowth
                  ? `${formatMinutes(overview.studyMinutesGrowth)} so với tuần trước`
                  : '1h 20m so với tuần trước'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: TIẾN ĐỘ HỌC TẬP & HOẠT ĐỘNG HỌC TẬP (90 NGÀY) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Khối Trái: Tiến độ học tập */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Tiến độ học tập
              </h2>
              <Link
                href={`/${locale}/vocabulary`}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group"
              >
                <span>Xem chi tiết</span>
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>

            {/* List Collection Progress */}
            <div className="space-y-4">
              {displayCollections.map((col, idx) => {
                const color = collectionColors[idx % collectionColors.length];
                const badgeLetter =
                  col.letter ||
                  (col.collectionName ? col.collectionName.charAt(0) : 'A');
                return (
                  <Link
                    key={col.collectionId || idx}
                    href={
                      col.collectionSlug
                        ? `/${locale}/vocabulary/${col.collectionSlug}`
                        : `/${locale}/vocabulary`
                    }
                    className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    {/* Square Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl ${color?.bg} ${color?.text} flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`}
                    >
                      {badgeLetter.toUpperCase()}
                    </div>

                    {/* Collection Info & Bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {col.collectionName}
                        </h3>
                        <span className="text-xs font-bold text-slate-700 shrink-0">
                          {col.progress}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium mb-1.5">
                        {col.learnedWords.toLocaleString()} /{' '}
                        {col.totalWords.toLocaleString()} từ
                      </p>
                      {/* Smooth Progress Bar matching screenshot */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(col.progress, 4))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Khối Phải: Hoạt động học tập (90 ngày gần đây) Heatmap Matrix */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Hoạt động học tập (90 ngày gần đây)
              </h2>
              <Link
                href={`/${locale}/vocabulary`}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group"
              >
                <span>Xem chi tiết</span>
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>

            {/* Matrix Heatmap Table matching screenshot */}
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-center border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="w-16"></th>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                      <th
                        key={day}
                        className="text-[11px] font-semibold text-slate-400 pb-1"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapWeeks.map((week, wIdx) => (
                    <tr key={`week-${wIdx}`}>
                      <td className="text-[11px] font-medium text-slate-400 text-left pr-2 whitespace-nowrap">
                        Tuần {wIdx + 1}
                      </td>
                      {week.map((cell, cIdx) => {
                        let cellBg = 'bg-slate-100 text-slate-400';
                        if (cell.level === 'active') {
                          cellBg = 'bg-blue-600 text-white font-bold shadow-xs';
                        } else if (cell.level === 'light') {
                          cellBg = 'bg-blue-300 text-blue-950 font-semibold';
                        } else if (cell.isFuture) {
                          cellBg = 'bg-slate-50 text-slate-300';
                        }

                        const isCurrentHovered =
                          hoveredCell?.dateStr === cell.dateStr;

                        const tooltipTitle = cell.isFuture
                          ? `${cell.dateStr}: Chưa diễn ra`
                          : cell.activity &&
                            (cell.activity.wordsLearned > 0 ||
                              cell.activity.studyMinutes > 0 ||
                              cell.activity.sessionCount > 0)
                            ? `${cell.dateStr}: Đã học ${cell.activity.wordsLearned || 0} từ (${cell.activity.studyMinutes || 1} phút)${
                                cell.activity.lessons?.length
                                  ? ' • ' +
                                    cell.activity.lessons
                                      .map(
                                        (l: any) =>
                                          `${l.lessonTitle}${
                                            l.collectionName
                                              ? ` (${l.collectionName})`
                                              : ''
                                          } [${l.wordsCount} từ]`,
                                      )
                                      .join(', ')
                                  : ''
                              }`
                            : `${cell.dateStr}: Không có hoạt động học tập`;

                        return (
                          <td key={cell.dateStr || cIdx} className="p-0.5">
                            <button
                              type="button"
                              title={tooltipTitle}
                              onMouseEnter={() => setHoveredCell(cell)}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => setHoveredCell(cell)}
                              className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-md transition-all duration-150 flex items-center justify-center text-[10px] sm:text-[11px] cursor-pointer ${
                                cell.isToday
                                  ? 'ring-2 ring-blue-600 ring-offset-1'
                                  : ''
                              } ${
                                isCurrentHovered
                                  ? 'scale-110 ring-2 ring-amber-400 z-10'
                                  : 'hover:scale-105'
                              } ${cellBg}`}
                            >
                              <span>{cell.dayNumber}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interactive Real-time Selected / Hovered Day Details Box */}
            <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50/80 transition-all">
              {hoveredCell ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                      {formatCellFullDate(hoveredCell.dateStr)}
                      {hoveredCell.isToday && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          Hôm nay
                        </span>
                      )}
                    </span>
                    {hoveredCell.activity &&
                      (hoveredCell.activity.wordsLearned > 0 ||
                        hoveredCell.activity.studyMinutes > 0) && (
                        <span className="text-[11px] font-bold text-blue-600">
                          ⏱️ {hoveredCell.activity.studyMinutes || 1} phút học
                        </span>
                      )}
                  </div>

                  {hoveredCell.isFuture ? (
                    <p className="text-slate-400 italic">Chưa diễn ra</p>
                  ) : hoveredCell.activity &&
                    (hoveredCell.activity.wordsLearned > 0 ||
                      hoveredCell.activity.studyMinutes > 0 ||
                      hoveredCell.activity.sessionCount > 0) ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-slate-600 font-medium">
                        <span>
                          📖 <strong>{hoveredCell.activity.wordsLearned || 0}</strong> từ đã học
                        </span>
                        <span>
                          🔄 <strong>{hoveredCell.activity.wordsReviewed || 0}</strong> từ đã ôn
                        </span>
                        <span>
                          🎯 <strong>{hoveredCell.activity.sessionCount || 1}</strong> phiên học
                        </span>
                      </div>
                      {hoveredCell.activity.lessons &&
                        hoveredCell.activity.lessons.length > 0 && (
                          <div className="pt-1 text-[11px] text-slate-600">
                            <span className="text-slate-400 font-medium">
                              Bài học đã tham gia:{' '}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {hoveredCell.activity.lessons
                                .map(
                                  (l) =>
                                    `${l.lessonTitle}${
                                      l.collectionName
                                        ? ` (${l.collectionName})`
                                        : ''
                                    } [${l.wordsCount} từ]`,
                                )
                                .join('; ')}
                            </span>
                          </div>
                        )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">
                      Không có hoạt động học tập nào trong ngày này.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Rê chuột vào một ngày trên lịch để xem chi tiết bài học và số từ vựng
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Dữ liệu thực tế
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100 justify-start">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Có học</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-300"></span>
              <span>Ít hoạt động</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
              <span>Không hoạt động</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 3: NHIỆM VỤ HÔM NAY & CARD ĐỘNG LỰC */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Khối Trái: Hôm nay, bạn có 2 nhiệm vụ học tập (chiếm 2 cột) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Hôm nay, bạn có {todayTasks?.tasksCount ?? 2} nhiệm vụ học tập
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Nhiệm vụ 1: Ôn tập từ vựng */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ôn tập từ vựng
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {todayTasks?.wordsToReview ?? 20} từ cần ôn
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartReview}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>Bắt đầu ngay</span>
                <span>→</span>
              </button>
            </div>

            {/* Nhiệm vụ 2: Học bài mới */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    Học bài mới
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {todayTasks?.currentLesson
                      ? `${todayTasks.currentLesson.title} - ${todayTasks.currentLesson.collectionName || 'Khóa học'}`
                      : 'Unit 3 - Destination B2'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartLesson}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>Bắt đầu ngay</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Khối Phải: Card Động Lực (Quote Card) */}
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>

            {/* Cute Reading Character SVG matching screenshot */}
            <div className="w-16 h-16 shrink-0 relative">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full drop-shadow-xs"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Hair */}
                <path
                  d="M35 30C35 20 45 15 55 15C65 15 70 22 70 30C70 35 68 40 68 40L32 40C32 40 35 35 35 30Z"
                  fill="#1E293B"
                />
                {/* Head */}
                <circle cx="50" cy="38" r="16" fill="#FBCFE8" />
                {/* Body / Shirt */}
                <path
                  d="M32 60C32 50 40 48 50 48C60 48 68 50 68 60L72 85H28L32 60Z"
                  fill="#3B82F6"
                />
                {/* Book */}
                <path
                  d="M20 72C20 68 32 66 50 70C68 66 80 68 80 72L76 86C60 82 40 82 24 86L20 72Z"
                  fill="#2563EB"
                />
                <path
                  d="M50 70V84M26 73C34 71 42 71 50 72M50 72C58 71 66 71 74 73"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Hands */}
                <circle cx="32" cy="74" r="4" fill="#FBCFE8" />
                <circle cx="68" cy="74" r="4" fill="#FBCFE8" />
              </svg>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              Càng học nhiều bạn sẽ càng tiến bộ!
            </h3>
            <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">
              &ldquo;Không có con đường nào dẫn đến thành công mà không có sự nỗ lực.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
