import apiClient from '@/lib/axios';
import {
  ApiResponse,
  CreateDictationPayload,
  DictationLesson,
  DictationSegmentEditPayload,
  DictationVoice,
} from '@/types';

export const dictationService = {
  getAll: async (params?: Record<string, string | undefined>) => {
    const res = await apiClient.get<ApiResponse<DictationLesson[]>>('/admin/dictation', { params });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<DictationLesson>>(`/admin/dictation/${id}`);
    return res.data;
  },

  getVoices: async () => {
    const res = await apiClient.get<ApiResponse<{ voices: DictationVoice[] }>>('/admin/dictation/voices');
    return res.data;
  },

  getProcessorHealth: async () => {
    const res = await apiClient.get<ApiResponse<{ tts: unknown; asr: unknown }>>('/admin/dictation/processors/health');
    return res.data;
  },

  previewSplit: async (sourceText: string) => {
    const res = await apiClient.post<ApiResponse<{ count: number; sentences: Array<{ order: number; text: string }> }>>(
      '/admin/dictation/preview-split',
      { sourceText },
    );
    return res.data;
  },

  create: async (payload: CreateDictationPayload) => {
    const res = await apiClient.post<ApiResponse<DictationLesson>>('/admin/dictation', payload);
    return res.data;
  },

  update: async (id: string, payload: Partial<CreateDictationPayload>) => {
    const res = await apiClient.patch<ApiResponse<DictationLesson>>(`/admin/dictation/${id}`, payload);
    return res.data;
  },

  updateSegments: async (id: string, segments: DictationSegmentEditPayload[]) => {
    const res = await apiClient.patch<ApiResponse<DictationLesson>>(`/admin/dictation/${id}/segments`, { segments });
    return res.data;
  },

  generateAudio: async (id: string) => {
    const res = await apiClient.post<ApiResponse<DictationLesson>>(`/admin/dictation/${id}/generate-audio`);
    return res.data;
  },

  analyzeAudio: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post<ApiResponse<DictationLesson>>(`/admin/dictation/${id}/analyze-audio`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000,
    });
    return res.data;
  },

  publish: async (id: string) => {
    const res = await apiClient.post<ApiResponse<DictationLesson>>(`/admin/dictation/${id}/publish`);
    return res.data;
  },

  unpublish: async (id: string) => {
    const res = await apiClient.post<ApiResponse<DictationLesson>>(`/admin/dictation/${id}/unpublish`);
    return res.data;
  },

  remove: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<DictationLesson>>(`/admin/dictation/${id}`);
    return res.data;
  },
};
