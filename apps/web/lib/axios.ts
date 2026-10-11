import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '@/redux/store';
import { logout, updateAccessToken } from '@/redux/features/auth/authSlice';
import { isAccessTokenValid } from './access-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios.post(
      `${API_URL}/auth/refresh-token`,
      {},
      { withCredentials: true }
    ).then((response) => {
      const token = response.data?.data?.accessToken || response.data?.accessToken;
      if (!isAccessTokenValid(token)) {
        throw new Error('Refresh token failed: Invalid access token returned');
      }
      store.dispatch(updateAccessToken(token));
      return token;
    }).catch((error) => {
      store.dispatch(logout());
      throw error;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    let token = store.getState().auth.accessToken;
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('accessToken');
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.headers) {
      const currentLang = typeof window !== 'undefined' ? (localStorage.getItem('i18nextLng') || 'vi') : 'vi';
      config.headers['Accept-Language'] = currentLang;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Data Unwrapping & Auto Refresh Token
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Check if error is 401 and request is not authentication endpoints
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
