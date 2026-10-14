import apiClient from '@/lib/axios';

export type AudioAccent = 'us' | 'uk' | 'both';

export interface AudioJobStatus {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: any;
  result?: any;
  failedReason?: string;
  timestamp?: string;
  startedAt?: string;
  finishedAt?: string;
}

export const audioService = {
  getVoices: async () => {
    const res = await apiClient.get('/admin/audio/voices');
    return res.data;
  },

  generateVocabulary: async (wordId: string, accent: AudioAccent = 'us', voiceId?: string) => {
    const res = await apiClient.post(`/admin/audio/vocabulary/${wordId}/generate`, { accent, voiceId });
    return res.data;
  },

  uploadVocabulary: async (wordId: string, accent: 'us' | 'uk', file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/vocabulary/${wordId}/upload/${accent}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  bulkVocabulary: async (ids: string[], accent: AudioAccent = 'us') => {
    const res = await apiClient.post('/admin/audio/vocabulary/bulk', { ids, accent });
    return res.data;
  },

  generateToeicQuestion: async (questionId: string, payload?: { primaryVoiceId?: string; secondaryVoiceId?: string }) => {
    const res = await apiClient.post(`/admin/audio/toeic/questions/${questionId}/generate`, payload || {});
    return res.data;
  },

  uploadToeicQuestion: async (questionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/toeic/questions/${questionId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  generateToeicPassage: async (passageId: string, payload?: { primaryVoiceId?: string; secondaryVoiceId?: string }) => {
    const res = await apiClient.post(`/admin/audio/toeic/passages/${passageId}/generate`, payload || {});
    return res.data;
  },

  uploadToeicPassage: async (passageId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/toeic/passages/${passageId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  generateToeicExam: async (examId: string, parts: number[] = [1, 2, 3, 4]) => {
    const res = await apiClient.post(`/admin/audio/toeic/exams/${examId}/generate`, { parts });
    return res.data;
  },

  getJob: async (jobId: string) => {
    const res = await apiClient.get(`/admin/audio/jobs/${jobId}`);
    return res.data;
  },
};
