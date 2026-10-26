import apiClient from "@/lib/axios";
import type {
  RecommendationResult,
  RecommendationRules,
} from "@repo/shared-types/recommendations";

const base = "/admin/site-settings/recommendations";
export const recommendationsService = {
  async read(): Promise<RecommendationRules> {
    return (await apiClient.get<{ data: RecommendationRules }>(base)).data.data;
  },
  async save(rules: RecommendationRules): Promise<RecommendationRules> {
    return (await apiClient.put<{ data: RecommendationRules }>(base, rules))
      .data.data;
  },
  async preview(
    rules: RecommendationRules,
    scenario: string,
    lang: string,
  ): Promise<RecommendationResult> {
    return (
      await apiClient.post<{ data: RecommendationResult }>(
        `${base}/preview`,
        rules,
        { params: { scenario, lang } },
      )
    ).data.data;
  },
};
