import apiClient from '@/lib/axios';
import { apiPayload } from '@/lib/api-payload';

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
  getServiceHealth: async (): Promise<{ checkedAt: string; services: {name:string; state:string; status?:number}[] }> => {
    const response = await apiClient.get('/admin/infrastructure/services');
    const result=apiPayload<{checkedAt:string;services:{name:string;state:string;status?:number}[]}>(response.data);
    if(!Array.isArray(result?.services))throw new Error('Invalid service health response');
    return result;
  },
  getWorkerConfig: async (): Promise<{maxWorkers:number; backlogThreshold:number;note:string}> => {
    const res = await apiClient.get('/admin/audio/workers/config');
    const result=apiPayload<{maxWorkers:number;backlogThreshold:number;note:string}>(res.data);
    if(!result||![1,2].includes(result.maxWorkers)||!Number.isInteger(result.backlogThreshold)||result.backlogThreshold<1||result.backlogThreshold>1000)throw new Error('Invalid worker configuration response');
    return result;
  },
  setWorkerConfig: async (settings: {maxWorkers:number;backlogThreshold:number}) => {
    const res = await apiClient.post('/admin/audio/workers/config', settings);
    return apiPayload(res.data);
  },
  getQueueMetrics: async (): Promise<{backend:string;waiting:number;retrying?:number;dead?:number;consumers?:number}> => {
    const res = await apiClient.get('/admin/audio/workers/metrics');
    return apiPayload(res.data);
  },
  getVoices: async () => {
    const res = await apiClient.get('/admin/audio/voices');
    return apiPayload(res.data);
  },

  generateVocabulary: async (wordId: string, accent: AudioAccent = 'us', voiceId?: string) => {
    const res = await apiClient.post(`/admin/audio/vocabulary/${wordId}/generate`, { accent, voiceId });
    return apiPayload(res.data);
  },

  uploadVocabulary: async (wordId: string, accent: 'us' | 'uk', file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/vocabulary/${wordId}/upload/${accent}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return apiPayload(res.data);
  },

  bulkVocabulary: async (ids: string[], accent: AudioAccent = 'us') => {
    const res = await apiClient.post('/admin/audio/vocabulary/bulk', { ids, accent });
    return apiPayload(res.data);
  },

  generateToeicQuestion: async (questionId: string, payload?: { primaryVoiceId?: string; secondaryVoiceId?: string }) => {
    const res = await apiClient.post(`/admin/audio/toeic/questions/${questionId}/generate`, payload || {});
    return apiPayload(res.data);
  },

  uploadToeicQuestion: async (questionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/toeic/questions/${questionId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return apiPayload(res.data);
  },

  generateToeicPassage: async (passageId: string, payload?: { primaryVoiceId?: string; secondaryVoiceId?: string }) => {
    const res = await apiClient.post(`/admin/audio/toeic/passages/${passageId}/generate`, payload || {});
    return apiPayload(res.data);
  },

  uploadToeicPassage: async (passageId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post(`/admin/audio/toeic/passages/${passageId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return apiPayload(res.data);
  },

  generateToeicExam: async (examId: string, parts: number[] = [1, 2, 3, 4]) => {
    const res = await apiClient.post(`/admin/audio/toeic/exams/${examId}/generate`, { parts });
    return apiPayload(res.data);
  },

  getJob: async (jobId: string) => {
    const res = await apiClient.get(`/admin/audio/jobs/${jobId}`);
    return apiPayload(res.data);
  },
};
