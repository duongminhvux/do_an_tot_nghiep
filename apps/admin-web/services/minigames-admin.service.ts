import apiClient from "@/lib/axios";

export type ScoreSort = "score_desc" | "score_asc" | "newest" | "oldest";

export interface AdminScore {
  _id: string;
  userId: string;
  gameType: string;
  score: number;
  createdAt: string;
  player?: { username?: string; email?: string };
}

export interface ScoreQuery {
  gameType?: string;
  search?: string;
  from?: string;
  to?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  limit?: number;
  sort?: ScoreSort;
}

export interface Statistics {
  totalPlays: number;
  playsToday: number;
  uniquePlayers: number;
  mostPlayedGame: { gameType: string; plays: number } | null;
  games: {
    gameType: string;
    plays: number;
    uniquePlayers: number;
    bestScore: number;
  }[];
  playsByDay: { date: string; plays: number }[];
  bestScores: {
    gameType: string;
    score: number;
    userId: string;
    createdAt: string;
  }[];
}

export const minigamesAdminService = {
  async scores(query: ScoreQuery) {
    return (
      await apiClient.get<{
        data: { items: AdminScore[]; total: number; page: number; limit: number };
      }>("/admin/minigames/results", { params: query })
    ).data.data;
  },
  async statistics() {
    return (await apiClient.get<{ data: Statistics }>(
      "/admin/minigames/statistics",
    )).data.data;
  },
};
