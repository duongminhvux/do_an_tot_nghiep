"use client";

import { useMemo } from "react";
import { useSiteSettings } from "@/providers/site-settings-provider";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/redux/hooks";
import { learningActivityService } from "@/services/learning-activity.service";
import { learningService } from "@/services/learning.service";
import { dictationService } from "@/services/dictation.service";
import { toeicService } from "@/services/toeic.service";
import { arenaService } from "@/services/arena.service";
import type { TodayTasksResult } from "@/types/learning";

const STALE = 60_000;

/**
 * Data for the learner home page: the cross-module activity summary plus one
 * small query per module for its "continue learning" card. Module queries are
 * independent so one failing module never blanks the whole page.
 */
export function useHomeData() {
  const { locale = "vi" } = useParams<{ locale: string }>();
  const { t } = useTranslation("home");
  const { user } = useAppSelector((state) => state.auth);
  const { timezone } = useSiteSettings();

  const home = useQuery({
    queryKey: ["learning-home", timezone],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: () => learningActivityService.getHome(timezone),
    staleTime: STALE,
  });
  const recent = useQuery({
    queryKey: ["learning-recent"],
    queryFn: () => learningActivityService.getRecent(8),
    staleTime: STALE,
  });

  const vocabulary = useQuery({
    queryKey: ["learning-today-tasks"],
    queryFn: async () => {
      const res = await learningService.getTodayTasks();
      return ((res as { data?: TodayTasksResult })?.data ??
        res) as TodayTasksResult;
    },
    staleTime: STALE,
  });
  const dictation = useQuery({
    queryKey: ["dictation-progress-overview"],
    queryFn: async () => (await dictationService.getProgressOverview()).data,
    staleTime: STALE,
  });
  const toeicStats = useQuery({
    queryKey: ["toeic-stats", "all"],
    queryFn: () => toeicService.getStats(),
    staleTime: STALE,
  });
  const toeicInProgress = useQuery({
    queryKey: ["toeic-attempts", "home-in-progress"],
    queryFn: async () => {
      const res = await toeicService.getAttempts({
        status: "IN_PROGRESS",
        limit: 1,
      });
      return Array.isArray(res?.data) ? (res.data[0] ?? null) : null;
    },
    staleTime: STALE,
  });
  const arena = useQuery({
    queryKey: ["arena-profile"],
    queryFn: async () => (await arenaService.getProfile()).data,
    staleTime: STALE,
  });

  const formattedToday = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        timeZone: timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [locale, timezone],
  );

  const userName =
    user?.username ||
    (user?.email ? user.email.split("@")[0] : t("greeting.default_name"));

  return {
    t,
    locale,
    userName,
    formattedToday,
    home,
    recent,
    modules: {
      vocabulary,
      dictation,
      toeicStats,
      toeicInProgress,
      arena,
    },
  };
}

export type HomeData = ReturnType<typeof useHomeData>;
