import apiClient from "@/lib/axios";
export type QualityCategory = "DATA" | "MEDIA" | "DUPLICATE" | "FEEDBACK";
export type QualityGroup =
  | "REQUIRED"
  | "MEDIA_BROKEN"
  | "MEDIA_UNVERIFIED"
  | "DUPLICATE"
  | "RELATION"
  | "OPTIONAL";
export const QUALITY_GROUPS: QualityGroup[] = [
  "REQUIRED",
  "MEDIA_BROKEN",
  "MEDIA_UNVERIFIED",
  "DUPLICATE",
  "RELATION",
  "OPTIONAL",
];
export type QualityArea = "toeic" | "dictation" | "vocabulary";
export type QualityKind =
  | "exams"
  | "words"
  | "lessons"
  | "dictation"
  | "collections"
  | "dictationTopics";
export interface QualityFinding {
  code: string;
  path: string;
  severity: "error" | "warning";
  group: QualityGroup;
  category: QualityCategory;
  message: string;
}
/** One content item and all its current findings. */
export interface QualityReportItem {
  kind: QualityKind;
  resourceId: string;
  title: string;
  editPath: string;
  errors: number;
  warnings: number;
  checkedAt: string;
  updatedAt: string | null;
  /** Edited after it was checked. */
  stale: boolean;
  /** Result comes from a single-content recheck newer than the last scan. */
  rechecked: boolean;
  findings: QualityFinding[];
}
export interface QualityReport {
  items: QualityReportItem[];
  /** Number of content items matching the filters. */
  total: number;
  page: number;
  pageSize: number;
  stats: {
    scanned: number;
    resourcesWithIssues: number;
    resourcesWithErrors: number;
    resourcesWithWarnings: number;
    errorFindings: number;
    warningFindings: number;
    brokenMedia: number;
    unverifiedMedia: number;
    staleResources: number;
    externalMedia: number;
  };
  groups: Partial<Record<QualityGroup, { resources: number; findings: number }>>;
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
export interface QualityFilters {
  area?: QualityArea;
  severity?: "error" | "warning";
  group?: QualityGroup;
  q?: string;
  sort?: "severity" | "recent";
  page: number;
  lang: string;
}
export const contentQualityService = {
  async list(filters: QualityFilters): Promise<QualityReport> {
    return (
      await apiClient.get("/admin/content-quality", {
        params: { ...filters, q: filters.q?.trim() || undefined },
      })
    ).data.data;
  },
  async scan() {
    return (await apiClient.post("/admin/content-quality/scans")).data.data;
  },
  async recheck(
    kind: QualityKind,
    id: string,
    lang: string,
  ): Promise<{ resolved: number; errors: number; warnings: number }> {
    return (
      await apiClient.post(
        `/admin/content-quality/items/${kind}/${id}/recheck`,
        undefined,
        { params: { lang } },
      )
    ).data.data;
  },
};
