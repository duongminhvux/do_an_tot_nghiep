// Định dạng phản hồi chuẩn từ NestJS API
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// User model dùng chung cho DB, API response và UI Next.js
export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  createdAt: string;
}

// DTO gửi từ Next.js lên NestJS
export interface LoginDto {
  email: string;
  password?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}
