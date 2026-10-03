import apiClient from '@/lib/axios';
import {
  DictationLessonDetail,
  DictationLessonSummary,
  DictationProgress,
  DictationProgressOverview,
} from '@/types';
import { ApiResponse } from '@/services/types';

export const dictationService = {
  getAll: async (params?: Record<string, string | undefined>) => {
    const res = await apiClient.get<ApiResponse<DictationLessonSummary[]>>('/dictation', { params });
    return res.data;
  },

  getBySlug: async (slug: string) => {
    const res = await apiClient.get<ApiResponse<DictationLessonDetail>>(`/dictation/slug/${slug}`);
    return res.data;
  },

  getProgressOverview: async () => {
    const res = await apiClient.get<ApiResponse<DictationProgressOverview>>('/dictation/progress');
    return res.data;
  },

  getProgress: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<DictationProgress>>(`/dictation/${lessonId}/progress`);
    return res.data;
  },

  recordAttempt: async (lessonId: string, segmentIndex: number, isCorrect: boolean) => {
    const res = await apiClient.post<ApiResponse<DictationProgress>>(
      `/dictation/${lessonId}/progress/attempt`,
      { segmentIndex, isCorrect },
    );
    return res.data;
  },

  resetProgress: async (lessonId: string) => {
    const res = await apiClient.post<ApiResponse<{ success: boolean }>>(`/dictation/${lessonId}/progress/reset`);
    return res.data;
  },
};
