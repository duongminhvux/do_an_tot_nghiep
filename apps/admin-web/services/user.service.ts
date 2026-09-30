import apiClient from '@/lib/axios';
import { ApiResponse } from '@/types/common';
import {
  CreateUserPayload,
  QueryUserDto,
  UpdateProfileDto,
  UpdateUserPayload,
  UserItem,
  UserListResponse,
} from '@/types/user';

export const userService = {
  getAll: async (params?: QueryUserDto): Promise<UserListResponse> => {
    const res = await apiClient.get<ApiResponse<UserListResponse>>('/admin/users', { params });
    return (
      res?.data?.data || {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        stats: {
          totalUsers: 0,
          activeUsers: 0,
          newUsers7d: 0,
          bannedUsers: 0,
          growthTotal: 0,
          growthActive: 0,
          growthNew: 0,
          growthBanned: 0,
        },
      }
    );
  },

  getById: async (id: string): Promise<UserItem | null> => {
    const res = await apiClient.get<ApiResponse<UserItem>>(`/admin/users/${id}`);
    return res?.data?.data || null;
  },

  create: async (payload: CreateUserPayload): Promise<UserItem> => {
    const res = await apiClient.post<ApiResponse<UserItem>>('/admin/users', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateUserPayload, mongoId?: string): Promise<UserItem> => {
    const targetId = mongoId || id;
    const res = await apiClient.patch<ApiResponse<UserItem>>(`/admin/users/${targetId}`, payload);
    return res.data.data;
  },

  toggleBan: async (id: string, mongoId?: string): Promise<any> => {
    const targetId = mongoId || id;
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/users/${targetId}/toggle-ban`);
    return res.data.data;
  },

  delete: async (id: string, mongoId?: string): Promise<boolean> => {
    const targetId = mongoId || id;
    await apiClient.delete(`/admin/users/${targetId}`);
    return true;
  },

  updateProfile: async (data: UpdateProfileDto) => {
    const res = await apiClient.patch<ApiResponse<any>>('/users/profile', data);
    return res.data;
  },

  updateNotes: async (id: string, notes: string): Promise<any> => {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/users/${id}/notes`, { notes });
    return res.data;
  },
};
