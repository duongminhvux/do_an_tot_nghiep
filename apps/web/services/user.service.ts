import apiClient from "@/lib/axios";
import { ApiResponse, UpdateProfileDto, UserProfile } from "./types";

export const userService = {
  updateProfile: async (data: UpdateProfileDto) => {
    const res = await apiClient.patch<
      ApiResponse<{ message: string; profile: UserProfile }>
    >("/users/profile", data);
    return res.data;
  },
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post<
      ApiResponse<{ message: string; profile: UserProfile }>
    >("/users/profile/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
