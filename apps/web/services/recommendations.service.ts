import apiClient from "@/lib/axios";
import type { RecommendationResult } from "@repo/shared-types/recommendations";

export async function getRecommendations(
  lang: string,
): Promise<RecommendationResult> {
  const response = await apiClient.get<{ data: RecommendationResult }>(
    "/learning/recommendations",
    { params: { lang } },
  );
  return response.data.data;
}
