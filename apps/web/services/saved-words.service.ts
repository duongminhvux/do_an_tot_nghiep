import apiClient from '@/lib/axios';
import { ApiResponse } from './types';
import {
  SavedWordItem,
  SavedWordsPagination,
  SavedWordsQuery,
} from '@/types/saved-words';
import { activityLogService } from './activity-log.service';

export interface SavedWordsListResponse {
  data: SavedWordItem[];
  pagination: SavedWordsPagination;
}

export const savedWordsService = {
  /**
   * Lấy danh sách từ đã lưu phân trang, tìm kiếm, lọc
   */
  getAll: async (params?: SavedWordsQuery) => {
    const res = await apiClient.get<ApiResponse<SavedWordsListResponse>>(
      '/learning/saved-words',
      { params },
    );
    return res.data;
  },

  /**
   * Lấy danh sách tất cả ID các từ đã lưu của user
   */
  getSavedIds: async () => {
    const res = await apiClient.get<ApiResponse<string[]>>(
      '/learning/saved-words/ids',
    );
    return res.data;
  },

  /**
   * Lấy thống kê tổng số từ đã lưu
   */
  getStats: async () => {
    const res = await apiClient.get<ApiResponse<{ total: number }>>(
      '/learning/saved-words/stats',
    );
    return res.data;
  },

  /**
   * Bật/tắt lưu từ vựng (Toggle bookmark)
   */
  toggle: async (wordId: string, wordText?: string) => {
    const res = await apiClient.post<
      ApiResponse<{ saved: boolean; wordId: string; data?: any }>
    >('/learning/saved-words/toggle', { wordId });
    if (res.data?.data) {
      activityLogService.logVocabSave(
        wordId,
        wordText || wordId,
        res.data.data.saved
      );
    }
    return res.data;
  },

  /**
   * Lưu một từ vựng
   */
  save: async (wordId: string, note?: string, wordText?: string) => {
    const res = await apiClient.post<ApiResponse<any>>(
      '/learning/saved-words',
      { wordId, note },
    );
    activityLogService.logVocabSave(wordId, wordText || wordId, true);
    return res.data;
  },

  /**
   * Bỏ lưu một từ vựng
   */
  unsave: async (wordId: string, wordText?: string) => {
    const res = await apiClient.delete<
      ApiResponse<{ success: boolean; wordId: string }>
    >(`/learning/saved-words/${wordId}`);
    activityLogService.logVocabSave(wordId, wordText || wordId, false);
    return res.data;
  },

  /**
   * Cập nhật ghi chú cho từ đã lưu
   */
  updateNote: async (wordId: string, note: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(
      `/learning/saved-words/${wordId}/note`,
      { note },
    );
    return res.data;
  },

  /**
   * Kiểm tra từ có đang được lưu không
   */
  checkIsSaved: async (wordId: string) => {
    const res = await apiClient.get<ApiResponse<{ isSaved: boolean }>>(
      `/learning/saved-words/check/${wordId}`,
    );
    return res.data;
  },
};
