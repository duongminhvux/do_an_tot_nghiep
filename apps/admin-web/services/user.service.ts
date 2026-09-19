import apiClient from '@/lib/axios';
import { ApiResponse, UpdateProfileDto } from './types';

export const userService = {
  updateProfile: async (data: UpdateProfileDto) => {
    const res = await apiClient.patch<ApiResponse<any>>('/users/profile', data);
    return res.data;
  },
};
