import apiClient from '@/lib/axios';
import { ApiResponse } from './types';
import { store } from '@/redux/store';

export interface UploadResponse {
  url: string;
  public_id: string;
}

export const uploadService = {
  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<UploadResponse>>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  deleteFile: async (identifier: string, resourceType?: string, keepalive = false): Promise<any> => {
    if (!identifier) return;
    try {
      if (keepalive) {
        const token = store.getState().auth.accessToken || localStorage.getItem('adminAccessToken');
        return await fetch(`${apiClient.defaults.baseURL}/upload/delete`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url: identifier, resource_type: resourceType }),
        });
      }
      const res = await apiClient.post<ApiResponse<any>>('/upload/delete', {
        public_id: identifier,
        url: identifier,
        resource_type: resourceType,
      });
      return res.data;
    } catch (err) {
      console.warn('Could not delete Cloudinary asset:', err);
    }
  },
};

