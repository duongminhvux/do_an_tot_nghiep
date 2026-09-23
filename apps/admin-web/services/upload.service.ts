import apiClient from '@/lib/axios';
import { ApiResponse } from './types';

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

  deleteFile: async (identifier: string, resourceType?: string): Promise<any> => {
    if (!identifier) return;
    try {
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

