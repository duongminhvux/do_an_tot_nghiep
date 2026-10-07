import apiClient from '@/lib/axios';
import { ApiResponse } from '@/types/common';
import {
  ActivityLogFilterResponse,
  ActivityLogsResponse,
  QueryActivityLogsParams,
} from '@/types/activity-log';

export const activityLogService = {
  getAll: async (params?: QueryActivityLogsParams): Promise<ActivityLogsResponse> => {
    const res = await apiClient.get<ApiResponse<ActivityLogsResponse>>('/admin/activity-logs', { params });
    return res?.data?.data || { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  },

  getByUserId: async (
    userId: string,
    params?: Omit<QueryActivityLogsParams, 'userId'>,
  ): Promise<ActivityLogsResponse> => {
    const res = await apiClient.get<ApiResponse<ActivityLogsResponse>>('/admin/activity-logs', {
      params: { ...params, userId },
    });
    return res?.data?.data || { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  },

  getFilters: async (lang?: string): Promise<ActivityLogFilterResponse> => {
    const res = await apiClient.get<ApiResponse<ActivityLogFilterResponse>>('/admin/activity-logs/filters', {
      params: { lang },
    });
    return res?.data?.data || { categories: [], actions: [] };
  },

  getStats: async (params?: { days?: number; startDate?: string; endDate?: string; lang?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>('/admin/activity-logs/stats', { params });
    return res?.data?.data;
  },

  getI18n: async (lang?: string) => {
    const res = await apiClient.get<ApiResponse<any>>('/admin/activity-logs/i18n', { params: { lang } });
    return res?.data?.data;
  },
};
