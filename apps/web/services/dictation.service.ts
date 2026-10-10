import apiClient from '@/lib/axios';
import {
  DictationLessonDetail,
  DictationLessonSummary,
  DictationProgress,
  DictationProgressOverview,
  DictationTopicDetail,
  DictationTopicSummary,
} from '@/types';
import { ApiResponse } from '@/services/types';

export const dictationService = {

  getTopics: async () => {
    const res = await apiClient.get<ApiResponse<DictationTopicSummary[]>>('/dictation/topics');
    return res.data;
  },

  getTopicBySlug: async (slug: string) => {
    const res = await apiClient.get<ApiResponse<DictationTopicDetail>>(`/dictation/topics/${slug}`);
    return res.data;
  },
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


  revealSegment: async (lessonId: string, segmentIndex: number) => {
    const res = await apiClient.post<ApiResponse<DictationProgress>>(
      `/dictation/${lessonId}/progress/reveal-segment`,
      { segmentIndex },
    );
    return res.data;
  },

  revealTranscript: async (lessonId: string) => {
    const res = await apiClient.post<ApiResponse<DictationProgress>>(
      `/dictation/${lessonId}/progress/reveal-transcript`,
    );
    return res.data;
  },

  recordReplay: async (lessonId: string, segmentIndex: number) => {
    const res = await apiClient.post<ApiResponse<DictationProgress>>(
      `/dictation/${lessonId}/progress/replay`,
      { segmentIndex },
    );
    return res.data;
  },

  resetProgress: async (lessonId: string) => {
    const res = await apiClient.post<ApiResponse<{ success: boolean }>>(`/dictation/${lessonId}/progress/reset`);
    return res.data;
  },
};
