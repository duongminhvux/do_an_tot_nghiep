import apiClient from "@/lib/axios";
export type QualityCategory = "DATA" | "MEDIA" | "DUPLICATE" | "FEEDBACK";
export interface QualityReport {
  items: {
    id: string;
    kind: "exams" | "words" | "lessons" | "dictation";
    resourceId: string;
    title: string;
    category: QualityCategory;
    code: string;
    path: string;
    severity: "error" | "warning";
    message: string;
    editPath: string;
    updatedAt: string | null;
    checkedAt: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    needsReview: number;
    missingAudio: number;
    duplicates: number;
    feedback: number;
  };
  job: {
    id: string;
    state: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    phase: number;
    scanned_count: number;
    failures: number;
    error: string | null;
    updated_at: string;
  } | null;
  snapshotAt: string | null;
  stale: boolean;
  feedbackAvailable: boolean;
}
export const contentQualityService = {
  async list(
    category: QualityCategory | undefined,
    page: number,
    lang: string,
  ): Promise<QualityReport> {
    return (
      await apiClient.get("/admin/content-quality", {
        params: { category, page, lang },
      })
    ).data.data;
  },
  async scan() {
    return (await apiClient.post("/admin/content-quality/scans")).data.data;
  },
};
