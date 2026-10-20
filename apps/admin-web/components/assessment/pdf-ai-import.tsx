"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import type { ExamItem } from "@/types";
import { pdfAiService, type PdfAiJob } from "@/services/pdf-ai.service";
import { ImportQuestionsWizard } from "./import-questions-wizard";

const button =
  "rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50";
const errorMessage = (error: unknown) => {
  const e = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message =
    e.response?.data?.message || e.message || "Không kết nối được AI local.";
  return Array.isArray(message) ? message.join("\n") : message;
};

export function PdfAiImport({
  exam,
  locale,
  onSuccess,
  onBusyChange,
}: {
  exam: ExamItem;
  locale: string;
  onSuccess: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const [file, setFile] = useState<File>();
  const [answers, setAnswers] = useState<File>();
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<PdfAiJob>();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [activePart, setActivePart] = useState<number>();
  const [saved, setSaved] = useState<number[]>([]);
  const running =
    starting ||
    Boolean(jobId && (!job || ["queued", "running"].includes(job.state)));
  const busy = running || editing;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const editorBusy = useCallback((value: boolean) => setEditing(value), []);

  useEffect(() => {
    const previous = sessionStorage.getItem(`pdf-ai:${exam._id}`);
    if (previous) setJobId(previous);
  }, [exam._id]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await pdfAiService.status(exam._id, jobId);
        if (cancelled) return;
        setError("");
        setJob(next);
        if (next.state === "completed")
          setActivePart(next.result?.parts[0]?.part);
        else if (next.state === "failed")
          setError(next.error || "AI không xử lý được PDF.");
        else timer = setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exam._id, jobId, retry]);

  const start = async () => {
    if (!file || busy) return;
    if (
      [file, answers].some(
        (f) =>
          f &&
          (f.size > 25 * 1024 * 1024 || !f.name.toLowerCase().endsWith(".pdf")),
      )
    ) {
      setError(
        tr(
          "Chỉ chọn PDF, tối đa 25 MB mỗi file.",
          "Select PDF files up to 25 MB each.",
        ),
      );
      return;
    }
    setStarting(true);
    setError("");
    try {
      const next = await pdfAiService.start(exam._id, file, answers);
      sessionStorage.setItem(`pdf-ai:${exam._id}`, next.jobId);
      setJob(undefined);
      setSaved([]);
      setJobId(next.jobId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(job?.result, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "toeic-ai-draft.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reset = () => {
    sessionStorage.removeItem(`pdf-ai:${exam._id}`);
    setJobId("");
    setJob(undefined);
    setError("");
    setSaved([]);
    setActivePart(undefined);
  };
  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-5 text-blue-600" />
          {tr(
            "Nhập đề TOEIC từ PDF bằng AI local",
            "Import TOEIC PDF with local AI",
          )}
        </h2>
        <p className="text-sm text-slate-600">
          {tr(
            "Tải PDF có thể sao chép chữ. AI tự phân loại Part và trích câu hỏi, lựa chọn, bài đọc. Bạn kiểm tra rồi lưu từng Part; câu mới được thêm vào cuối đề.",
            "Upload a text-based PDF. AI detects Parts, questions, options and passages. Review and save each Part; questions are appended to the exam.",
          )}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            {tr("PDF đề thi", "Exam PDF")}
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={busy || Boolean(job?.result)}
              className="block w-full"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          <label className="space-y-2 text-sm">
            {tr("PDF đáp án (nếu có file riêng)", "Answer key PDF (optional)")}
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={busy || Boolean(job?.result)}
              className="block w-full"
              onChange={(e) => setAnswers(e.target.files?.[0])}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {tr(
            "Không có đáp án trong PDF thì AI để trống để bạn kiểm tra. Audio và ảnh cần bổ sung ở bước duyệt. Lượt nhận diện được giữ 24 giờ; tải bản JSON để giữ lại kết quả.",
            "Missing answer keys stay blank for review. Add audio and images during review. Results are retained for 24 hours; download the JSON draft to keep a copy.",
          )}
        </p>
        {!job?.result && (
          <button
            className={`${button} !bg-blue-600 text-white inline-flex items-center gap-2`}
            disabled={!file || busy}
            onClick={() => void start()}
          >
            {running && <Loader2 className="size-4 animate-spin" />}
            {tr("Đọc PDF bằng AI", "Analyze PDF")}
          </button>
        )}
        {running && (
          <p role="status" className="text-sm">
            {job?.message || tr("Đang khởi động AI…", "Starting AI…")}{" "}
            {job?.total ? `(${job.current}/${job.total})` : ""}
          </p>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-line"
        >
          {error}
          {jobId && job?.state !== "failed" && (
            <button
              className="ml-3 underline"
              onClick={() => setRetry((n) => n + 1)}
            >
              {tr("Kiểm tra lại tiến độ", "Retry status check")}
            </button>
          )}
          {jobId && (
            <button
              className="ml-3 underline"
              disabled={starting || editing}
              onClick={reset}
            >
              {tr("Nhận diện lại PDF", "Start a new PDF import")}
            </button>
          )}
        </div>
      )}
      {job?.result && (
        <>
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
            <p className="font-medium">
              {job.result.total} {tr("câu hỏi", "questions")} ·{" "}
              {job.result.pages} {tr("trang", "pages")} · {job.result.model}
            </p>
            {job.result.warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
            <button
              className={`${button} inline-flex items-center gap-2`}
              onClick={download}
            >
              <Download className="size-4" />
              {tr("Tải bản nhận diện JSON", "Download JSON draft")}
            </button>
            <button className={`${button} ml-2`} disabled={editing} onClick={reset}>
              {tr("Nhập PDF khác", "Import another PDF")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {job.result.parts.map((part) => (
              <button
                key={part.part}
                className={`${button} ${activePart === part.part ? "!border-blue-500 !bg-blue-50 text-blue-700" : ""}`}
                disabled={editing}
                onClick={() => setActivePart(part.part)}
              >
                Part {part.part} · {part.questions.length}{" "}
                {tr("câu", "questions")}
                {saved.includes(part.part) ? " ✓" : ""}
              </button>
            ))}
          </div>
          {/* Keep editors mounted so edits, save state and idempotency IDs survive switching Parts. */}
          {job.result.parts.map((part) => (
            <div
              key={`${jobId}-${part.part}`}
              hidden={activePart !== part.part}
            >
              <ImportQuestionsWizard
                exam={exam}
                locale={locale}
                initialPart={part.part}
                initialDraft={part}
                initialBatchId={`${jobId}-p${part.part}`}
                onSuccess={onSuccess}
                onBusyChange={editorBusy}
                onImported={() =>
                  setSaved((prev) =>
                    prev.includes(part.part) ? prev : [...prev, part.part],
                  )
                }
              />
            </div>
          ))}
        </>
      )}
    </section>
  );
}
