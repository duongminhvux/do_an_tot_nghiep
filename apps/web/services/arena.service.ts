import apiClient from "@/lib/axios";
import { ApiResponse } from "@/services/types";

export type ArenaProfile = {
  userId: string;
  rating: number;

  leaderboard: {
    position: number | null;
    topPercent: number | null;
    totalPlayers: number;
  };

  todayRatingChange: number;

  ranked: {
    matches: number;
    wins: number;
    losses: number;
    draws: number;

    winRate: number;
    currentWinStreak: number;
    bestWinStreak: number;
  };
};

export type ArenaRankingPeriod = "week" | "month" | "all";
export type ArenaRankingEntry = {
  userId: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  position: number;
  matches: number;
  wins: number;
};
export type ArenaLeaderboard = {
  period: ArenaRankingPeriod;
  players: ArenaRankingEntry[];
  me: ArenaRankingEntry | null;
  totalPlayers: number;
};
export type ArenaRecentMatch = {
  id: string;
  name: string;
  avatarUrl?: string;
  score: [number, number];
  result: "WIN" | "LOSS" | "DRAW";
  mode: "rank" | "friend" | "word-chain" | "room";
  points: number;
  finishedAt: string;
};

export const arenaService = {
  getPresence: async () => {
    const response =
      await apiClient.get<ApiResponse<{ onlineCount: number }>>(
        "/arena/presence",
      );
    return response.data;
  },
  getRecentMatches: async (limit = 20) => {
    const response = await apiClient.get<ApiResponse<ArenaRecentMatch[]>>(
      "/arena/matches",
      { params: { limit } },
    );
    return response.data;
  },
  getLeaderboard: async (period: ArenaRankingPeriod) => {
    const response = await apiClient.get<ApiResponse<ArenaLeaderboard>>(
      "/arena/leaderboard",
      { params: { period } },
    );
    return response.data;
  },
  getProfile: async () => {
    const response =
      await apiClient.get<ApiResponse<ArenaProfile>>(`/arena/profile`);
    return response.data;
  },
};
