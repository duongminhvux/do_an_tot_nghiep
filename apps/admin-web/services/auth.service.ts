import apiClient from '@/lib/axios';
import {
  ApiResponse,
  AuthLoginResponse,
  LoginDto,
  RefreshTokenResponse,
  UserProfile,
} from './types';

export const authService = {
  login: async (data: LoginDto) => {
    const res = await apiClient.post<ApiResponse<AuthLoginResponse>>('/admin/auth/login', data);
    return res.data;
  },

  refreshToken: async () => {
    const res = await apiClient.post<ApiResponse<RefreshTokenResponse>>('/admin/auth/refresh-token');
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/admin/auth/logout');
    return res.data;
  },

  getProfile: async () => {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/admin/auth/me');
    return res.data;
  },
};
