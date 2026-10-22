import apiClient from "@/lib/axios";
import { ApiResponse } from "@/services/types";

export type LearningModule =
  | "VOCABULARY"
  | "DICTATION"
  | "TOEIC"
  | "ARENA"
  | "MINIGAME";

export interface ActivityTotals {
  xp: number;
  count: number;
  durationSec: number;
}

export interface HomeDay extends ActivityTotals {
  date: string;
  byModule: Partial<Record<LearningModule, ActivityTotals>>;
}

export interface LearningHome {
  timezone: string;
  today: {
    date: string;
    xp: number;
    goalXp: number;
    activities: number;
    durationSec: number;
  };
  streak: { current: number; longest: number; activeToday: boolean };
  totals: ActivityTotals & { activeDays: number };
  week: ActivityTotals;
  /** % change vs the previous 7 days; null when there was nothing before. */
  growth: {
    xp: number | null;
    count: number | null;
    durationSec: number | null;
  };
  byModule: Record<LearningModule, ActivityTotals>;
  heatmap: HomeDay[];
}

export interface RecentActivity {
  id: string;
  module: LearningModule;
  type: string;
  title?: string;
  link?: string;
  correct?: number;
  total?: number;
  score?: number;
  durationSec?: number;
  xp: number;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export const learningActivityService = {
  getHome: async (timezone: string) => {
    const res = await apiClient.get<ApiResponse<LearningHome>>(
      "/learning-activity/home",
      { params: { timezone } },
    );
    return res.data.data;
  },

  getRecent: async (limit = 8) => {
    const res = await apiClient.get<ApiResponse<RecentActivity[]>>(
      "/learning-activity/recent",
      { params: { limit } },
    );
    return res.data.data;
  },
};
