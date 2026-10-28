import apiClient from '@/lib/axios';
import {
  ApiResponse,
  CollectionItem,
  LessonItem,
  LessonWordItem,
  QueryCollectionDto,
  QueryVocabularyGroupDto,
  SectionItem,
  VocabularyGroupItem,
} from './types';

// ==========================
// VOCABULARY GROUPS
// ==========================
export const vocabularyGroupService = {
  getAll: async (params?: QueryVocabularyGroupDto) => {
    const res = await apiClient.get<ApiResponse<VocabularyGroupItem[]>>('/vocabulary-groups', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<VocabularyGroupItem>>(`/vocabulary-groups/${id}`);
    return res.data;
  },
};

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

  getBySlug: async (slug: string) => {
    const res = await apiClient.get<ApiResponse<CollectionItem>>(`/collections/slug/${slug}`);
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

  getBySlug: async (slug: string, collectionId?: string) => {
    const res = await apiClient.get<ApiResponse<LessonItem>>(`/lessons/slug/${slug}`, {
      params: collectionId ? { collectionId } : undefined,
    });
    return res.data;
  },

  getSections: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<SectionItem[]>>(`/lessons/${lessonId}/sections`);
    return res.data;
  },

  getWords: async (lessonId: string, sectionId?: string) => {
    const res = await apiClient.get<ApiResponse<LessonWordItem[]>>(`/lessons/${lessonId}/words`, {
      params: sectionId ? { sectionId } : undefined,
    });
    return res.data;
  },
};
