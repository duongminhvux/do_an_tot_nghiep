import apiClient from "@/lib/axios";
import type {
  ImportDraft,
  ImportIssue,
} from "@repo/shared-types/assessment-import";

export interface PdfAiPart extends ImportDraft {
  part: number;
  issues?: ImportIssue[];
}
export interface PdfAiJob {
  id: string;
  state: "queued" | "running" | "completed" | "failed";
  current: number;
  total: number;
  message?: string;
  error?: string;
  result?: {
    parts: PdfAiPart[];
    warnings: string[];
    total: number;
    pages: number;
    model: string;
    testNumber?: number;
    listeningScript?: { questions: number; missingQuestions?: number[]; transcripts: number; pages: number; ocrPages: number } | null;
    sections?: {
      section: "LC" | "RC";
      detected: number;
      expected: number;
      missing: number[];
      answers: number;
      answerPages: number[];
      pages: number;
      ocrPages: number;
      photos: number;
      conflicts?: number[];
    }[];
    sourcePages?: { section: "LC" | "RC" | "SCRIPT"; page: number; imageUrl: string }[];
  };
}

export const pdfAiService = {
  async startBundle(
    testNumber: number,
    files: Record<"lc" | "rc" | "lc_answers" | "rc_answers", File> & {lc_script?: File},
  ) {
    const form = new FormData();
    form.set("testNumber", String(testNumber));
    for (const [field, file] of Object.entries(files)) form.set(field, file);
    const response = await apiClient.post<{ data: { jobId: string } }>(
      "/admin/pdf-ai/bundle-jobs",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60_000,
      },
    );
    return response.data.data;
  },
  async bundleStatus(jobId: string) {
    const response = await apiClient.get<{ data: PdfAiJob; message?: string }>(
      `/admin/pdf-ai/bundle-jobs/${jobId}`,
      { timeout: 35_000 },
    );
    return { ...response.data.data, message: response.data.message || response.data.data.message };
  },
  async start(examId: string, file: File, answers?: File) {
    const form = new FormData();
    form.set("file", file);
    if (answers) form.set("answers", answers);
    const response = await apiClient.post<{ data: { jobId: string } }>(
      `/admin/exams/${examId}/pdf-ai/jobs`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 45_000,
      },
    );
    return response.data.data;
  },
  async status(examId: string, jobId: string) {
    const response = await apiClient.get<{ data: PdfAiJob; message?: string }>(
      `/admin/exams/${examId}/pdf-ai/jobs/${jobId}`,
      { timeout: 35_000 },
    );
    return { ...response.data.data, message: response.data.message || response.data.data.message };
  },
};
