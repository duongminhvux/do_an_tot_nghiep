import apiClient from '@/lib/axios';
import {
  ApiResponse,
  CollectionItem,
  CollectionListResponse,
  CreateCollectionDto,
  CreateLessonDto,
  CreateWordDto,
  LessonItem,
  QueryCollectionDto,
  QueryWordDto,
  UpdateCollectionDto,
  UpdateLessonDto,
  UpdateWordDto,
  WordDetail,
  WordItem,
  WordListItem,
  WordListResponse,
} from './types';

// ==========================
// COLLECTIONS
// ==========================
export const collectionService = {
  getAll: async (params?: QueryCollectionDto) => {
    const res = await apiClient.get<ApiResponse<CollectionListResponse>>('/admin/collections', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<CollectionItem>>(`/admin/collections/${id}`);
    return res.data;
  },

  create: async (data: CreateCollectionDto) => {
    const res = await apiClient.post<ApiResponse<CollectionItem>>('/admin/collections', data);
    return res.data;
  },

  update: async (id: string, data: UpdateCollectionDto) => {
    const res = await apiClient.patch<ApiResponse<CollectionItem>>(`/admin/collections/${id}`, data);
    return res.data;
  },

  toggleActive: async (id: string, isActive?: boolean) => {
    const res = await apiClient.patch<ApiResponse<CollectionItem>>(`/admin/collections/${id}/active`, {
      isActive,
    });
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/collections/${id}`);
    return res.data;
  },

  restore: async (id: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/collections/${id}/restore`);
    return res.data;
  },

  reorder: async (items: { id: string; order: number }[]) => {
    const res = await apiClient.patch<ApiResponse<{ success: boolean }>>('/admin/collections/reorder', { items });
    return res.data;
  },
};

// ==========================
// LESSONS
// ==========================
export const lessonService = {
  getAll: async (collectionId?: string) => {
    const res = await apiClient.get<ApiResponse<LessonItem[]>>('/admin/lessons', {
      params: collectionId ? { collectionId } : undefined,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<LessonItem>>(`/admin/lessons/${id}`);
    return res.data;
  },

  create: async (data: CreateLessonDto) => {
    const res = await apiClient.post<ApiResponse<LessonItem>>('/admin/lessons', data);
    return res.data;
  },

  update: async (id: string, data: UpdateLessonDto) => {
    const res = await apiClient.patch<ApiResponse<LessonItem>>(`/admin/lessons/${id}`, data);
    return res.data;
  },

  toggleActive: async (id: string, isActive?: boolean) => {
    const res = await apiClient.patch<ApiResponse<LessonItem>>(`/admin/lessons/${id}/active`, {
      isActive,
    });
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/lessons/${id}`);
    return res.data;
  },

  restore: async (id: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/lessons/${id}/restore`);
    return res.data;
  },

  reorder: async (items: { id: string; order: number }[]) => {
    const res = await apiClient.patch<ApiResponse<{ success: boolean }>>('/admin/lessons/reorder', { items });
    return res.data;
  },

  // Sections
  getSections: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/admin/lessons/${lessonId}/sections`);
    return res.data;
  },

  createSection: async (lessonId: string, data: { name: string; slug?: string; order?: number }) => {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/lessons/${lessonId}/sections`, data);
    return res.data;
  },

  updateSection: async (sectionId: string, data: { name?: string; slug?: string; order?: number }) => {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/lessons/sections/${sectionId}`, data);
    return res.data;
  },

  deleteSection: async (sectionId: string) => {
    const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
      `/admin/lessons/sections/${sectionId}`
    );
    return res.data;
  },

  reorderSections: async (lessonId: string, items: { id: string; order: number }[]) => {
    const res = await apiClient.patch<ApiResponse<{ success: boolean }>>(
      `/admin/lessons/${lessonId}/sections/reorder`,
      { items }
    );
    return res.data;
  },

  // Lesson Words
  getWords: async (lessonId: string, sectionId?: string) => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/admin/lessons/${lessonId}/words`, {
      params: sectionId ? { sectionId } : undefined,
    });
    return res.data;
  },

  addWords: async (lessonId: string, wordIds: string[], sectionId?: string) => {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/lessons/${lessonId}/words`, {
      wordIds,
      sectionId,
    });
    return res.data;
  },

  updateWord: async (
    lessonId: string,
    wordId: string,
    data: { sectionId?: string | null; order?: number; customNote?: string }
  ) => {
    const res = await apiClient.patch<ApiResponse<any>>(
      `/admin/lessons/${lessonId}/words/${wordId}`,
      data
    );
    return res.data;
  },

  reorderWords: async (
    lessonId: string,
    items: { wordId: string; order: number; sectionId?: string | null }[]
  ) => {
    const res = await apiClient.patch<ApiResponse<{ success: boolean }>>(
      `/admin/lessons/${lessonId}/words/reorder`,
      { items }
    );
    return res.data;
  },

  removeWord: async (lessonId: string, wordId: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(
      `/admin/lessons/${lessonId}/words/${wordId}`
    );
    return res.data;
  },
};

// ==========================
// WORDS
// ==========================
export const wordService = {
  getAll: async (params?: QueryWordDto) => {
    const res = await apiClient.get<ApiResponse<WordListResponse>>('/admin/words', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<WordDetail>>(`/admin/words/${id}`);
    return res.data;
  },

  create: async (data: CreateWordDto) => {
    const res = await apiClient.post<ApiResponse<WordDetail>>('/admin/words', data);
    return res.data;
  },

  update: async (id: string, data: UpdateWordDto) => {
    const res = await apiClient.patch<ApiResponse<WordDetail>>(`/admin/words/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/words/${id}`);
    return res.data;
  },

  restore: async (id: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/words/${id}/restore`);
    return res.data;
  },

  toggleActive: async (id: string, isActive?: boolean) => {
    const res = await apiClient.patch<ApiResponse<WordDetail>>(`/admin/words/${id}/active`, {
      isActive,
    });
    return res.data;
  },

  bulkToggleActive: async (ids: string[], isActive: boolean) => {
    const res = await apiClient.patch<ApiResponse<any>>('/admin/words/bulk-active', {
      ids,
      isActive,
    });
    return res.data;
  },
};
