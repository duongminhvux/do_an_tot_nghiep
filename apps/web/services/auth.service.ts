import apiClient from '@/lib/axios';
import {
  ApiResponse,
  AuthLoginResponse,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenResponse,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './types';

export const authService = {
  login: async (data: LoginDto) => {
    const res = await apiClient.post<ApiResponse<AuthLoginResponse>>('/auth/login', data);
    return res.data;
  },

  register: async (data: RegisterDto) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/register', data);
    return res.data;
  },

  verifyEmail: async (data: VerifyEmailDto) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/verify-email', data);
    return res.data;
  },

  resendCode: async (email: string) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/resend-code', { email });
    return res.data;
  },

  refreshToken: async () => {
    const res = await apiClient.post<ApiResponse<RefreshTokenResponse>>('/auth/refresh-token');
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
    return res.data;
  },

  getProfile: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/auth/me');
    return res.data;
  },

  changePassword: async (data: ChangePasswordDto) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/change-password', data);
    return res.data;
  },

  forgotPassword: async (data: ForgotPasswordDto) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/forgot-password', data);
    return res.data;
  },

  resetPassword: async (data: ResetPasswordDto) => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/reset-password', data);
    return res.data;
  },

  getGoogleLoginUrl: () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/auth/google/login`;
  },
};
