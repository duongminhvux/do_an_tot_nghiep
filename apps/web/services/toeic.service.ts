import apiClient from "@/lib/axios";
import { ApiResponse } from "@/services/types";
export interface RawToeicResult {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
}

export interface ToeicExamGroup {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  examCount?: number;
  totalAttempts?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ToeicExamSummary {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  totalQuestions?: number;
  durationMinutes?: number;
  totalAttempts?: number;
  groupId?: string | { _id: string; name: string; slug: string };
  isActive?: boolean;
  order?: number;
  /** Position inside its exam group (set by admins). */
  groupOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ToeicExamPart {
  _id: string;
  section: "LISTENING" | "READING";
  part: number;
  type: string;
  totalQuestions: number;
  order?: number;
}

export interface ToeicAttemptSummary {
  _id: string;
  examId: string | ToeicExamSummary;
  userId?: string;
  score?: number;
  scoreMax?: number;
  listeningScore?: number;
  readingScore?: number;
  expiresAt?: string;
  totalCorrect?: number;
  totalQuestions?: number;
  durationSpent?: number;
  completedAt?: string;
  createdAt?: string;
  mode?: "TEST" | "PRACTICE";
  selectedParts?: number[];
  answeredQuestions?: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  unansweredQuestions?: number;
  accuracy?: number;
  resultType?: "RAW";
  partResults?: (RawToeicResult & { part: number })[];
  listeningResult?: RawToeicResult;
  readingResult?: RawToeicResult;
  status?: "FINISHED" | "COMPLETED" | "IN_PROGRESS" | "ABANDONED";
}

export interface ToeicStatsPeriod {
  totalAttempts: number;
  totalCompleted: number;
  inProgress: number;
  testAttempts: number;
  practiceAttempts: number;
  totalQuestions: number;
  totalAnswered: number;
  totalCorrect: number;
  avgAccuracy: number;
  totalDuration: number;
  avgDuration: number;
  scoredAttempts: number;
  avgScore: number | null;
  highestScore: number | null;
  avgListeningScore: number | null;
  avgReadingScore: number | null;
}

export interface ToeicStatsDay {
  date: string;
  attempts: number;
  completed: number;
  duration: number;
  accuracy: number | null;
  listeningAccuracy: number | null;
  readingAccuracy: number | null;
  avgScore: number | null;
  avgListeningScore: number | null;
  avgReadingScore: number | null;
}

export type ToeicResultBand = "excellent" | "good" | "fair" | "average" | "low";

export interface ToeicStatsOverview {
  inProgress: number;
  testAttempts: number;
  practiceAttempts: number;
  days: number | null;
  previous: ToeicStatsPeriod | null;
  timeline: ToeicStatsDay[];
  distribution: { band: ToeicResultBand; count: number }[];
  scoreDistribution: { band: ToeicResultBand; count: number }[];
  scoreAvailable: boolean;
  scoredAttempts: number;
  avgScore: number | null;
  highestScore: number | null;
  avgListeningScore: number | null;
  avgReadingScore: number | null;
  totalAttempts: number;
  totalCompleted: number;
  recentAttempts: ToeicAttemptSummary[];
  totalQuestions: number;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  avgAccuracy: number;
  avgDuration: number;
  totalDuration: number;
  partResults: (RawToeicResult & { part: number; attempts: number })[];
  listeningResult: RawToeicResult;
  readingResult: RawToeicResult;
}

export const toeicService = {
  getExams: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<ToeicExamSummary[]>>("/exams", {
      params,
    });
    return res.data;
  },

  getExamById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<ToeicExamSummary>>(
      `/exams/${id}`,
    );
    return res.data;
  },

  getExamParts: async (examId: string) => {
    const res = await apiClient.get<ApiResponse<ToeicExamPart[]>>(
      `/exams/${examId}/parts`,
    );
    return res.data;
  },

  getAttempts: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<ToeicAttemptSummary[]>>(
      "/attempts",
      { params },
    );
    return res.data;
  },

  getStats: async (params?: {
    days?: number;
    timezone?: string;
    mode?: "TEST" | "PRACTICE";
  }) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicStatsOverview>>(
        "/attempts/stats",
        { params },
      );
      return res.data;
    } catch {
      return null;
    }
  },

  getGroups: async (params?: Record<string, any>) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamGroup[]>>(
        "/exam-groups",
        { params },
      );
      return res.data;
    } catch {
      return { data: [], total: 0 } as any;
    }
  },

  getGroupBySlugOrId: async (slugOrId: string) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamGroup>>(
        `/exam-groups/${slugOrId}`,
      );
      return res.data;
    } catch {
      return null;
    }
  },

  getGroupExams: async (
    groupIdOrSlug: string,
    params?: Record<string, any>,
  ) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamSummary[]>>(
        `/exam-groups/${groupIdOrSlug}/exams`,
        { params },
      );
      return res.data;
    } catch {
      return { data: [], total: 0 } as any;
    }
  },
};
