import apiClient from '@/lib/axios';
import {
  ApiResponse,
  CollectionItem,
  CreateCollectionDto,
  CreateLessonDto,
  CreateWordDto,
  LessonItem,
  QueryCollectionDto,
  QueryWordDto,
  UpdateCollectionDto,
  UpdateLessonDto,
  UpdateWordDto,
  WordItem,
} from './types';

// ==========================
// COLLECTIONS
// ==========================
export const collectionService = {
  getAll: async (params?: QueryCollectionDto) => {
    const res = await apiClient.get<ApiResponse<CollectionItem[]>>('/collections', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<CollectionItem>>(`/collections/${id}`);
    return res.data;
  },

  create: async (data: CreateCollectionDto) => {
    const res = await apiClient.post<ApiResponse<CollectionItem>>('/collections', data);
    return res.data;
  },

  update: async (id: string, data: UpdateCollectionDto) => {
    const res = await apiClient.patch<ApiResponse<CollectionItem>>(`/collections/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/collections/${id}`);
    return res.data;
  },
};

// ==========================
// LESSONS
// ==========================
export const lessonService = {
  getAll: async (collectionId?: string) => {
    const res = await apiClient.get<ApiResponse<LessonItem[]>>('/lessons', {
      params: collectionId ? { collectionId } : undefined,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<LessonItem>>(`/lessons/${id}`);
    return res.data;
  },

  create: async (data: CreateLessonDto) => {
    const res = await apiClient.post<ApiResponse<LessonItem>>('/lessons', data);
    return res.data;
  },

  update: async (id: string, data: UpdateLessonDto) => {
    const res = await apiClient.patch<ApiResponse<LessonItem>>(`/lessons/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/lessons/${id}`);
    return res.data;
  },

  getWords: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<WordItem[]>>(`/lessons/${lessonId}/words`);
    return res.data;
  },

  addWords: async (lessonId: string, wordIds: string[]) => {
    const res = await apiClient.post<ApiResponse<any>>(`/lessons/${lessonId}/words`, {
      wordIds,
    });
    return res.data;
  },

  removeWord: async (lessonId: string, wordId: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(
      `/lessons/${lessonId}/words/${wordId}`
    );
    return res.data;
  },
};

// ==========================
// WORDS
// ==========================
export const wordService = {
  getAll: async (params?: QueryWordDto) => {
    const res = await apiClient.get<ApiResponse<WordItem[]>>('/words', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<WordItem>>(`/words/${id}`);
    return res.data;
  },

  create: async (data: CreateWordDto) => {
    const res = await apiClient.post<ApiResponse<WordItem>>('/words', data);
    return res.data;
  },

  update: async (id: string, data: UpdateWordDto) => {
    const res = await apiClient.patch<ApiResponse<WordItem>>(`/words/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/words/${id}`);
    return res.data;
  },

  restore: async (id: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(`/words/${id}/restore`);
    return res.data;
  },
};
