import apiClient from "@/lib/axios";
import type { MistakeStatistic } from "@repo/shared-types/mistakes";
export async function getMistakeStatistics(): Promise<{
  minimumLearners: number;
  items: MistakeStatistic[];
}> {
  return (await apiClient.get("/admin/learning/mistakes/statistics")).data.data;
}
