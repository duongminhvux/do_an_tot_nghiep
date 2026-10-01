import apiClient from '@/lib/axios';
import {
  ApiResponse,
  CreateExamDto,
  ExamItem,
  ExamListResponse,
  PassageItem,
  QueryExamDto,
  QuestionItem,
  UpdateExamDto,
} from '@/types';

export const examService = {
  getAll: async (params?: QueryExamDto) => {
    const res = await apiClient.get<ApiResponse<ExamListResponse>>('/admin/exams', {
      params,
    });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await apiClient.get<ApiResponse<ExamItem>>(`/admin/exams/${id}`);
    return res.data;
  },

  create: async (data: CreateExamDto) => {
    const res = await apiClient.post<ApiResponse<ExamItem>>('/admin/exams', data);
    return res.data;
  },

  update: async (id: string, data: UpdateExamDto) => {
    const res = await apiClient.patch<ApiResponse<ExamItem>>(`/admin/exams/${id}`, data);
    return res.data;
  },

  toggleActive: async (id: string, isActive?: boolean) => {
    const res = await apiClient.patch<ApiResponse<ExamItem>>(`/admin/exams/${id}/active`, {
      isActive,
    });
    return res.data;
  },

  delete: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/exams/${id}`);
    return res.data;
  },

  restore: async (id: string) => {
    const res = await apiClient.patch<ApiResponse<ExamItem>>(`/admin/exams/${id}/restore`);
    return res.data;
  },

  reorder: async (items: { id: string; order: number }[]) => {
    const res = await apiClient.patch<ApiResponse<{ success: boolean }>>('/admin/exams/reorder', {
      items,
    });
    return res.data;
  },

  getQuestions: async (examId: string, params?: any) => {
    const res = await apiClient
      .get<ApiResponse<{ data: QuestionItem[]; total: number }>>(`/admin/questions/exam/${examId}`, {
        params,
      })
      .catch(() => null);
    return res?.data;
  },

  getPassages: async (examId: string) => {
    const res = await apiClient
      .get<ApiResponse<PassageItem[]>>(`/admin/questions/exam/${examId}/passages`)
      .catch(() => null);
    return res?.data;
  },

  createPassage: async (data: any) => {
    const res = await apiClient.post<ApiResponse<PassageItem>>('/admin/questions/passages', data);
    return res.data;
  },

  createQuestion: async (data: any) => {
    const res = await apiClient.post<ApiResponse<QuestionItem>>('/admin/questions', data);
    return res.data;
  },

  updateQuestion: async (id: string, data: any) => {
    const res = await apiClient.patch<ApiResponse<QuestionItem>>(`/admin/questions/${id}`, data);
    return res.data;
  },

  deleteQuestion: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/admin/questions/${id}`);
    return res.data;
  },

  parseQuestions: async (examId: string, data: FormData | any) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const res = await apiClient.post<ApiResponse<{
      passage?: PassageItem;
      questions: QuestionItem[];
      total: number;
      rawText?: string;
    }>>(`/admin/questions/exam/${examId}/parse`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return res.data;
  },

  importQuestions: async (examId: string, data: FormData | any) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const res = await apiClient.post<ApiResponse<{
      importedCount: number;
      passageId?: string;
      data: QuestionItem[];
    }>>(`/admin/questions/exam/${examId}/import`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return res.data;
  },
};
