import apiClient from "@/lib/axios";
export const COMMENT_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔", "😢"] as const;
export interface ExamComment {
  id: string;
  rootId: string | null;
  replyToId: string | null;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  authorId: string | null;
  username: string | null;
  replyToName: string | null;
  isMine: boolean;
  replyCount: number;
  reactions: Record<string, number>;
  myReaction: string | null;
}
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
  isMe: boolean;
}
export type ExamRanking = CommunityPage<ExamRank> & { mine: ExamRank | null };
const base = (examId: string) => `/exams/${encodeURIComponent(examId)}`;
export const toeicCommunityService = {
  async leaderboard(exam: string, page: number): Promise<ExamRanking> {
    return (
      await apiClient.get(`${base(exam)}/leaderboard`, { params: { page } })
    ).data.data;
  },
  async comments(
    exam: string,
    page: number,
    root?: string,
  ): Promise<CommunityPage<ExamComment>> {
    return (
      await apiClient.get(
        `${base(exam)}/comments${root ? `/${root}/replies` : ""}`,
        { params: { page } },
      )
    ).data.data;
  },
  async post(
    exam: string,
    body: string,
    replyToId?: string,
  ): Promise<{ id: string; rootId: string | null }> {
    return (
      await apiClient.post(`${base(exam)}/comments`, {
        body,
        ...(replyToId ? { replyToId } : {}),
      })
    ).data.data;
  },
  async remove(exam: string, id: string) {
    await apiClient.delete(`${base(exam)}/comments/${id}`);
  },
  async react(exam: string, id: string, emoji: string | null) {
    if (emoji)
      await apiClient.put(`${base(exam)}/comments/${id}/reaction`, { emoji });
    else await apiClient.delete(`${base(exam)}/comments/${id}/reaction`);
  },
};
