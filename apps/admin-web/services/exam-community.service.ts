import apiClient from "@/lib/axios";
import type { ApiResponse } from "@/types";
export interface CommunityPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ExamRank {
  rank: number;
  userId: string;
  username: string | null;
  correct: number;
  total: number;
  durationSpent: number;
  completedAt: string;
  estimatedScore: number | null;
}
export interface ExamComment {
  id: string;
  rootId: string | null;
  body: string | null;
  deleted: boolean;
  isPinned: boolean;
  createdAt: string;
  authorId: string | null;
  username: string | null;
  replyCount: number;
  replyToName: string | null;
}
export const examCommunityService = {
  async leaderboard(exam: string, page: number) {
    return (
      await apiClient.get<ApiResponse<CommunityPage<ExamRank>>>(
        `/admin/exams/${exam}/leaderboard`,
        { params: { page } },
      )
    ).data.data;
  },
  async comments(exam: string, page: number, root?: string) {
    return (
      await apiClient.get<ApiResponse<CommunityPage<ExamComment>>>(
        `/admin/exams/${exam}/comments${root ? `/${root}/replies` : ""}`,
        { params: { page } },
      )
    ).data.data;
  },
  async pin(exam: string, id: string, pinned: boolean) {
    await apiClient.patch(`/admin/exams/${exam}/comments/${id}/pin`, {
      pinned,
    });
  },
  async remove(exam: string, id: string) {
    await apiClient.delete(`/admin/exams/${exam}/comments/${id}`);
  },
};
