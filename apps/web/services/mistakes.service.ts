import apiClient from "@/lib/axios";
import type {
  MistakeDetail,
  MistakeList,
  MistakeSource,
} from "@repo/shared-types/mistakes";
export const mistakesService = {
  async list(query: {
    source?: MistakeSource;
    status?: "PENDING" | "REVIEWED";
    q?: string;
    page: number;
    limit: number;
  }): Promise<MistakeList> {
    return (
      await apiClient.get<{ data: MistakeList }>("/learning/mistakes", {
        params: query,
      })
    ).data.data;
  },
  async detail(id: string): Promise<MistakeDetail> {
    return (
      await apiClient.get<{ data: MistakeDetail }>(`/learning/mistakes/${id}`)
    ).data.data;
  },
  async markReviewed(id: string, seenWrongCount: number) {
    return (
      await apiClient.patch(`/learning/mistakes/${id}/reviewed`, {
        seenWrongCount,
      })
    ).data.data;
  },
  async reviewWord(id: string) {
    return (await apiClient.get(`/learning/mistakes/${id}/review-word`)).data;
  },
};
