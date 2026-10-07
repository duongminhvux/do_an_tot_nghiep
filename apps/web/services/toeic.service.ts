import apiClient from '@/lib/axios';
import { ApiResponse } from '@/services/types';

export interface ToeicExamGroup {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  examCount?: number;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface ToeicExamPart {
  _id: string;
  section: 'LISTENING' | 'READING';
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
  listeningScore?: number;
  readingScore?: number;
  totalCorrect?: number;
  totalQuestions?: number;
  durationSpent?: number;
  completedAt?: string;
  createdAt?: string;
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'ABANDONED';
}

export interface ToeicStatsOverview {
  totalAttempts: number;
  totalCompleted: number;
  avgScore: number;
  highestScore: number;
  avgListeningScore: number;
  avgReadingScore: number;
  recentAttempts: ToeicAttemptSummary[];
}

export const toeicService = {
  getExams: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<ToeicExamSummary[]>>('/exams', { params });
    return res.data;
  },

  getExamById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<ToeicExamSummary>>(`/exams/${id}`);
    return res.data;
  },

  getExamParts: async (examId: string) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamPart[]>>(`/exams/${examId}/parts`);
      return res.data;
    } catch {
      return { data: [] } as any;
    }
  },

  getAttempts: async (params?: Record<string, any>) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicAttemptSummary[]>>('/attempts', { params });
      return res.data;
    } catch {
      return { data: [], total: 0 } as any;
    }
  },

  getStats: async () => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicStatsOverview>>('/attempts/stats');
      return res.data;
    } catch {
      return null;
    }
  },

  getGroups: async (params?: Record<string, any>) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamGroup[]>>('/exam-groups', { params });
      return res.data;
    } catch {
      return { data: [], total: 0 } as any;
    }
  },

  getGroupBySlugOrId: async (slugOrId: string) => {
    try {
      const res = await apiClient.get<ApiResponse<ToeicExamGroup>>(`/exam-groups/${slugOrId}`);
      return res.data;
    } catch {
      return null;
    }
  },

  getGroupExams: async (groupIdOrSlug: string, params?: Record<string, any>) => {
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
