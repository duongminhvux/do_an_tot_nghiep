"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/redux/hooks";
import { learningService } from "@/services/learning.service";
import {
  UserProgressOverview,
  CollectionVocabularyProgressItem,
  DailyActivityItem,
  TodayTasksResult,
} from "@/types/learning";

export function useDashboardData() {
  const params = useParams();

  const router = useRouter();

  const locale = (params?.locale as string) || "vi";

  const { user } = useAppSelector((state) => state.auth);

  const { t } = useTranslation("home");

  // 1. GET /progress/overview
  const {
    data: overviewRes,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["progress-overview"],
    queryFn: () => learningService.getProgressOverview(),
    staleTime: 60 * 1000,
  });

  const overview: UserProgressOverview | undefined =
    overviewRes?.data || overviewRes;

  // 2. GET /progress/vocabulary
  const {
    data: vocabRes,
    isLoading: isVocabLoading,
    isError: isVocabError,
    error: vocabError,
    refetch: refetchVocab,
  } = useQuery({
    queryKey: ["progress-vocabulary"],
    queryFn: () => learningService.getVocabularyProgressList(),
    staleTime: 60 * 1000,
  });

  const vocabularyProgressList: CollectionVocabularyProgressItem[] =
    vocabRes?.data || (Array.isArray(vocabRes) ? vocabRes : []);

  // 3. GET /progress/activity?days=90
  const {
    data: activityRes,
    isLoading: isActivityLoading,
    isError: isActivityError,
    error: activityError,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ["progress-activity-90"],
    queryFn: () => learningService.getActivityHistory(90),
    staleTime: 60 * 1000,
  });

  const activityList: DailyActivityItem[] =
    activityRes?.data || (Array.isArray(activityRes) ? activityRes : []);

  // 4. GET /learning/today-tasks
  const {
    data: tasksRes,
    isLoading: isTasksLoading,
    isError: isTasksError,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["learning-today-tasks"],
    queryFn: () => learningService.getTodayTasks(),
    staleTime: 60 * 1000,
  });

  const todayTasks: TodayTasksResult | undefined = tasksRes?.data || tasksRes;

  // Format today's date string: "Thứ 3, 30 tháng 9, 2025"
  const formattedToday = useMemo(() => {
    const now = new Date();
    try {
      if (locale === "vi") {
        const weekdayNames = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const weekday = weekdayNames[now.getDay()];
        return `${weekday}, ${day} tháng ${month}, ${year}`;
      } else {
        return new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
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
    return `${hours}h ${mins.toString().padStart(2, "0")}m`;
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
    if (!dStr) return "";
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        const dt = new Date(y, m - 1, d);
        if (locale === "vi") {
          const daysOfWeek = [
            "Chủ nhật",
            "Thứ hai",
            "Thứ ba",
            "Thứ tư",
            "Thứ năm",
            "Thứ sáu",
            "Thứ bảy",
          ];
          return `${daysOfWeek[dt.getDay()]}, ${d} tháng ${m}, ${y}`;
        } else {
          return new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
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
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
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
          : "");
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

        let level: "none" | "light" | "active" = "none";
        if (
          act &&
          (act.studyMinutes > 0 || act.sessionCount > 0 || act.wordsLearned > 0)
        ) {
          if (
            act.wordsLearned >= 5 ||
            act.studyMinutes >= 10 ||
            act.sessionCount >= 2
          ) {
            level = "active"; // Có học tích cực
          } else {
            level = "light"; // Ít hoạt động
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
    { bg: "bg-emerald-500", text: "text-white" },
    { bg: "bg-blue-600", text: "text-white" },
    { bg: "bg-indigo-600", text: "text-white" },
    { bg: "bg-purple-600", text: "text-white" },
    { bg: "bg-amber-500", text: "text-white" },
  ];

  // Danh sách collection đã học (server CHỈ trả về collection user đã học)
  const displayCollections = useMemo(() => {
    return (vocabularyProgressList || []).slice(0, 4);
  }, [vocabularyProgressList]);

  // Tính % tiến độ từ server, fallback tính thủ công nếu thiếu field
  const getProgressPercent = (col: CollectionVocabularyProgressItem) => {
    if (typeof col.progress === "number" && !Number.isNaN(col.progress)) {
      return Math.min(100, Math.max(0, Math.round(col.progress)));
    }
    if (col.totalWords && col.totalWords > 0) {
      return Math.min(
        100,
        Math.round(((col.learnedWords || 0) / col.totalWords) * 100),
      );
    }
    return 0;
  };

  // Daily goal progress (real data)
  const dailyGoal = todayTasks?.dailyGoal || 0;

  const todayLearnedCount = todayTasks?.todayLearnedCount || 0;

  const dailyGoalPct =
    dailyGoal > 0
      ? Math.min(100, Math.round((todayLearnedCount / dailyGoal) * 100))
      : 0;

  // Handle CTA button clicks
  const handleStartReview = () => {
    router.push(`/${locale}/vocabulary/review`);
  };

  const handleStartLesson = () => {
    if (
      todayTasks?.currentLesson?.collectionSlug &&
      todayTasks?.currentLesson?.slug
    ) {
      router.push(
        `/${locale}/vocabulary/${todayTasks.currentLesson.collectionSlug}/lessons/${todayTasks.currentLesson.slug}`,
      );
    } else {
      router.push(`/${locale}/vocabulary`);
    }
  };

  const userName =
    user?.username ||
    (user?.email ? user.email.split("@")[0] : t("greeting.default_name"));
  return {
    t,
    locale,
    isTasksLoading,
    todayTasks,
    dailyGoal,
    todayLearnedCount,
    dailyGoalPct,
    handleStartReview,
    handleStartLesson,
    formattedToday,
    userName,
    isOverviewError,
    overviewError,
    refetchOverview,
    isVocabError,
    vocabError,
    refetchVocab,
    isActivityError,
    activityError,
    refetchActivity,
    isTasksError,
    tasksError,
    refetchTasks,
    isOverviewLoading,
    overview,
    formatMinutes,
    isVocabLoading,
    collectionColors,
    displayCollections,
    getProgressPercent,
    isActivityLoading,
    hoveredCell,
    setHoveredCell,
    formatCellFullDate,
    heatmapWeeks,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
