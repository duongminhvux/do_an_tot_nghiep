"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileText,
  Headphones,
  Loader2,
  ScanText,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { pdfAiService, type PdfAiJob } from "@/services/pdf-ai.service";
import { examService } from "@/services/assessment.service";
import type { ExamItem } from "@/types";
import { PdfAiDraftReview } from "@/components/assessment/pdf-ai-draft-review";
import { getMissingScriptQuestions, getPdfAiGroupProblems, getPdfAiReviewProblems } from "@/components/assessment/pdf-ai-review-problems";
import type { ImportDraft } from "@repo/shared-types/assessment-import";

type Role = "lc" | "rc" | "lc_answers" | "rc_answers" | "lc_script";
const slots = [
  {
    role: "lc",
    title: "Đề Listening (LC)",
    en: "Listening test (LC)",
    hint: "TEST 1 LC (1).pdf",
    icon: Headphones,
    color: "blue",
  },
  {
    role: "rc",
    title: "Đề Reading (RC)",
    en: "Reading test (RC)",
    hint: "TEST 1 RC (1).pdf",
    icon: BookOpen,
    color: "emerald",
  },
  {
    role: "lc_answers",
    title: "Đáp án Listening",
    en: "Listening answer key",
    hint: "ĐÁP ÁN ETS 2024 LC.pdf",
    icon: FileCheck2,
    color: "blue",
  },
  {
    role: "rc_answers",
    title: "Đáp án Reading",
    en: "Reading answer key",
    hint: "ĐÁP ÁN ETS 2024 RC.pdf",
    icon: FileCheck2,
    color: "emerald",
  },
  {
    role: "lc_script",
    title: "Script Listening Part 1–4 (không bắt buộc)",
    en: "Listening script Parts 1–4 (optional)",
    hint: "TEST_01.pdf · Câu hỏi, lựa chọn và lời thoại tiếng Anh",
    icon: ScanText,
    color: "blue",
  },
] as const;
const messageOf = (error: unknown) => {
  const e = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message =
    e.response?.data?.message || e.message || "Không xử lý được yêu cầu.";
  return Array.isArray(message) ? message.join("\n") : message;
};

export default function CreateExamAiPage() {
  const { locale: localeParam } = useParams();
  const locale = String(localeParam || "vi");
  const router = useRouter();
  const query = useSearchParams();
  const groupId = query.get("groupId") || undefined;
  const requestedJob = query.get("job");
  const storageKey = `toeic-ai-create:${groupId || "none"}`;
  const queryClient = useQueryClient();
  const en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const [name, setName] = useState("ETS 2024 - Test 1");
  const [testNumber, setTestNumber] = useState(1);
  const [files, setFiles] = useState<Partial<Record<Role, File>>>({});
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<PdfAiJob>();
  const [exam, setExam] = useState<ExamItem>();
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ImportDraft>>({});
  const [reviewBusy, setReviewBusy] = useState(false);
  const [focusQuestion, setFocusQuestion] = useState<{ order: number; request: number }>();
  const onDraftChange = useCallback((draft: ImportDraft, part: number) => {
    setReviewDrafts(prev => prev[part] === draft ? prev : { ...prev, [part]: draft });
  }, []);
  const running =
    busy ||
    Boolean(jobId && (!job || ["queued", "running"].includes(job.state)));
  const result = job?.result;
  const reviewProblems = useMemo(() => result ? getPdfAiReviewProblems(result, reviewDrafts, locale) : [], [result, reviewDrafts, locale]);
  const reviewErrors = reviewProblems.filter(problem => problem.error);
  const reviewWarnings = reviewProblems.filter(problem => !problem.error);
  const groupProblems = useMemo(() => result ? getPdfAiGroupProblems(result, reviewDrafts, locale) : [], [result, reviewDrafts, locale]);
  const missingScripts = result ? getMissingScriptQuestions(result) : [];
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (requestedJob && draft.jobId !== requestedJob) {
          setJobId(requestedJob);
          return;
        }
        setJobId(draft.jobId);
        setName(draft.name);
        setTestNumber(draft.testNumber);
        if (draft.exam) setExam(draft.exam);
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
    if (!saved && requestedJob && /^[a-f0-9-]{36}$/i.test(requestedJob)) setJobId(requestedJob);
  }, [storageKey, requestedJob]);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await pdfAiService.bundleStatus(jobId);
        if (cancelled) return;
        setJob(next);
        if (requestedJob && next.result?.testNumber) setTestNumber(next.result.testNumber);
        setError(
          next.state === "failed" ? next.error || "Không đọc được bộ PDF." : "",
        );
        if (next.state === "queued" || next.state === "running")
          timer = setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) setError(messageOf(err));
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, retry, requestedJob]);
  const selectFile = (role: Role, file?: File) => {
    if (!file || running) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 25 * 1024 * 1024 ||
      !file.size
    ) {
      setError(
        tr(
          "Chỉ nhận PDF có nội dung, tối đa 25 MB mỗi file.",
          "Select a non-empty PDF up to 25 MB.",
        ),
      );
      return;
    }
    setError("");
    setFiles((prev) => ({ ...prev, [role]: file }));
  };
  const start = async () => {
    if (running) return;
    if (!name.trim() || slots.some((s) => s.role !== "lc_script" && !files[s.role])) {
      setError(
        tr(
          "Nhập tên đề và tải đủ 4 file PDF.",
          "Enter a name and select all four PDFs.",
        ),
      );
      return;
    }
    for (const role of ["lc", "rc", "lc_script"] as const) {
      if (!files[role]) continue;
      const wrongRole = role === "lc" ? /\bRC\b/i : /\bLC\b/i;
      if (role !== "lc_script" && wrongRole.test(files[role]!.name)) {
        setError(tr(`File ${files[role]!.name} đang ở nhầm ô ${role.toUpperCase()}. Hãy chọn lại đúng ô Listening (LC) hoặc Reading (RC).`, `The filename does not match the ${role.toUpperCase()} slot. Select the correct Listening or Reading file.`));
        return;
      }
      const match = files[role]!.name.match(/\bTEST[ _-]*0*(\d+)\b/i);
      if (match && Number(match[1]) !== testNumber) {
        setError(
          tr(
            `File ${files[role]!.name} không khớp Test ${testNumber} đã chọn.`,
            `The ${role.toUpperCase()} filename does not match Test ${testNumber}.`,
          ),
        );
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const next = await pdfAiService.startBundle(
        testNumber,
        files as Record<Exclude<Role, "lc_script">, File> & {lc_script?: File},
      );
      setJob(undefined);
      setJobId(next.jobId);
      setExam(undefined);
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ jobId: next.jobId, name: name.trim(), testNumber }),
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  const createDraft = async () => {
    if (busy || exam || !result) return;
    if (!name.trim()) {
      setError(tr("Nhập tên đề thi.", "Enter an exam name."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await examService.create({
        name: name.trim(),
        type: "TOEIC",
        durationMinutes: 120,
        totalQuestions: 200,
        isActive: false,
        groupId,
        description: `ETS · Test ${testNumber} · AI PDF import`,
      });
      const created = response.data;
      setExam(created);
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ jobId, name: name.trim(), testNumber, exam: created }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    sessionStorage.removeItem(storageKey);
    setJobId("");
    setJob(undefined);
    setExam(undefined);
    setError("");
    setReviewDrafts({});
    setFocusQuestion(undefined);
  };
  const editProblem = async (order: number) => {
    if (busy || reviewBusy) return;
    setFocusQuestion(previous => ({ order, request: (previous?.request || 0) + 1 }));
    if (!exam) await createDraft();
  };
  const startNewExam = () => {
    reset();
    setFiles({});
    setName("ETS 2024 - Test 1");
    setTestNumber(1);
    router.replace(`/${locale}/assessment/create/ai${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ""}`);
  };
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-5 md:p-8">
      <Link
        href={`/${locale}/assessment`}
        className="inline-flex items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft className="size-4" />
        {tr("Danh sách đề thi", "Exams")}
      </Link>
      <Link href={`/${locale}/assessment/ai-learning`} className="ml-5 inline-flex text-sm text-blue-600 underline">Dữ liệu sửa lỗi bộ đọc PDF</Link>
      <header className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-600 p-3 text-white">
          <Sparkles className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr("Tạo đề TOEIC bằng AI", "Create a TOEIC exam with AI")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              "4 PDF đề/đáp án + PDF script Listening tùy chọn → kiểm tra trước khi lưu.",
              "Four test/answer PDFs + an optional Listening script → review before saving.",
            )}
          </p>
        </div>
      </header>
      <ol className="grid grid-cols-3 gap-2 text-sm">
        {[
          tr("1. Tải tài liệu", "1. Upload documents"),
          tr("2. Nhận diện & ghép", "2. Recognize & match"),
          tr("3. Kiểm tra & lưu", "3. Review & save"),
        ].map((step, i) => (
          <li
            key={step}
            className={`rounded-lg px-3 py-3 ${i === (exam ? 2 : jobId ? 1 : 0) ? "bg-blue-600 font-semibold text-white" : "bg-slate-100 text-slate-500"}`}
          >
            {step}
          </li>
        ))}
      </ol>
      {error && (
        <div
          role="alert"
          className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          {jobId && (
            <div className="mt-2 flex gap-4">
              <button
                onClick={() => setRetry((n) => n + 1)}
                className="underline"
              >
                {tr("Kiểm tra lại tiến độ", "Retry status")}
              </button>
              <button onClick={reset} disabled={busy} className="underline">
                {tr("Chọn lại tài liệu", "Start over")}
              </button>
            </div>
          )}
        </div>
      )}
      {!result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <label className="space-y-2 text-sm font-medium">
              {tr("Tên đề thi", "Exam name")}
              <input
                required
                value={name}
                disabled={running}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              {tr("Chọn Test trong PDF đáp án", "Test in answer PDFs")}
              <select
                value={testNumber}
                disabled={running}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setTestNumber(n);
                  setName(`ETS 2024 - Test ${n}`);
                }}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Test {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            {tr(
              "PDF đáp án ETS chứa nhiều Test. Hệ thống chỉ lấy đúng bảng Test bạn chọn: LC câu 1–100 và RC câu 101–200.",
              "ETS answer PDFs contain multiple Tests. Only the selected Test is used: LC 1–100 and RC 101–200.",
            )}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {slots.map((slot, index) => {
              const file = files[slot.role];
              const Icon = slot.icon;
              return (
                <label
                  key={slot.role}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    selectFile(slot.role, e.dataTransfer.files[0]);
                  }}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-5 transition ${file ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40 hover:border-blue-400"} ${running ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    aria-label={slot.title}
                    disabled={running}
                    onChange={(e) => selectFile(slot.role, e.target.files?.[0])}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  <div className="flex items-start gap-3">
                    <span
                      className={`rounded-lg p-2.5 ${slot.color === "blue" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="mr-2 text-slate-400">
                          0{index + 1}
                        </span>
                        {en ? slot.en : slot.title}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {file
                          ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
                          : slot.hint}
                      </p>
                    </div>
                    {file ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                    ) : (
                      <UploadCloud className="size-5 shrink-0 text-slate-400" />
                    )}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    {file
                      ? tr("Nhấn để thay file", "Click to replace")
                      : tr(
                          "Kéo thả hoặc nhấn để chọn PDF · tối đa 25 MB",
                          "Drop a PDF or click to browse · up to 25 MB",
                        )}
                  </p>
                  {slot.role === "lc_script" && <p className="mt-2 text-xs leading-5 text-slate-500">
                    {tr("Tự điền câu hỏi/lựa chọn Part 1–2 và lời thoại Part 3–4. Đọc lớp chữ có sẵn hoặc OCR nếu PDF là ảnh; bỏ phần dịch và lời giải. Chưa tạo audio ở bước này.", "Fills Parts 1–2 questions/choices and Parts 3–4 transcripts. Reads text or OCRs scanned pages, excluding translations and explanations. Audio is not generated here.")}
                  </p>}
                  {slot.role === "lc_script" && file && <button type="button" disabled={running} className="relative z-10 mt-2 text-xs text-red-600 underline"
                    onClick={(e) => {e.preventDefault(); e.stopPropagation(); setFiles((prev) => {const next = {...prev}; delete next.lc_script; return next;});}}>
                    {tr("Bỏ file script", "Remove script")}
                  </button>}
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ScanText className="size-4" />
              {tr(
                "Tự đọc PDF scan · chưa tạo bản ghi đề khi đang phân tích",
                "Scanned PDFs supported · no exam is created during analysis",
              )}
            </div>
            <button
              onClick={() => void start()}
              disabled={
                running || !name.trim() || slots.some((s) => s.role !== "lc_script" && !files[s.role])
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {files.lc_script ? tr("Phân tích 5 PDF", "Analyze 5 PDFs") : tr("Phân tích 4 PDF", "Analyze 4 PDFs")}
            </button>
          </div>
        </section>
      )}
      {running && (
        <section
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-5"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <Loader2 className="size-4 animate-spin" />
            {job?.message || tr("Đang gửi tài liệu…", "Uploading documents…")}
          </p>
          <progress
            max={100}
            value={
              job?.total ? Math.min(100, (100 * job.current) / job.total) : 0
            }
            className="mt-3 h-2 w-full accent-blue-600"
          />
          <p className="mt-2 text-xs text-blue-600">
            {tr(
              "Bạn có thể tải lại trang để tiếp tục theo dõi. PDF scan cần thêm thời gian nhận diện.",
              "You can reload this page to resume progress. Scanned PDFs take longer to recognize.",
            )}
          </p>
        </section>
      )}
      {result && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            {tr("Tên đề thi", "Exam name")}
            <input
              value={name}
              disabled={Boolean(exam) || busy}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
            />
          </label>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {tr(
                  `Kết quả Test ${result.testNumber || testNumber}`,
                  `Test ${result.testNumber || testNumber} results`,
                )}
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {result.total} / 200 {tr("vị trí câu hỏi", "question slots")}
              </span>
            </div>
            {exam && (
              <div className="flex justify-end">
                <button type="button" onClick={startNewExam} disabled={busy} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  {tr("+ Tạo đề AI mới", "+ Create a new AI exam")}
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {result.sections?.map((s) => (
                <div
                  key={s.section}
                  className="rounded-xl bg-slate-50 p-4 text-sm"
                >
                  <p className="font-semibold">
                    {s.section === "LC"
                      ? "Listening · 1–100"
                      : "Reading · 101–200"}
                  </p>
                  <p className="mt-2 text-slate-600">
                    {tr("Nhận diện nội dung", "Content recognized")}:{" "}
                    {s.detected}/100 · {tr("Đáp án", "Answers")}: {s.answers}
                    /100
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.ocrPages} {tr("trang OCR", "OCR pages")} ·{" "}
                    {tr("Bảng đáp án trang", "Answer key pages")}{" "}
                    {s.answerPages.join(", ")}
                  </p>
                  {s.missing.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      {s.section === "LC" && s.missing.every((n) => n <= 31)
                        ? tr("Script câu hỏi/lựa chọn chưa nhận diện được; hãy bổ sung trong ô nội dung trước khi lưu Part.", "Question/answer script was not recognized; enter it in the content field before saving the Part.")
                        : tr("Cần bổ sung nội dung", "Missing source content")}:{" "}
                      {s.missing.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {result.listeningScript ? tr(
                `Đã nhập script: ${result.listeningScript.questions}/100 câu và ${result.listeningScript.transcripts}/23 đoạn lời thoại. Nội dung đã điền vào Part 1–4 để kiểm tra/chỉnh sửa. Có thể dùng script để tạo TTS hoặc thêm audio sau.`,
                `Script imported: ${result.listeningScript.questions}/100 questions and ${result.listeningScript.transcripts}/23 transcripts. Review/edit Parts 1–4, then use TTS or add audio later.`,
              ) : tr(
                "Các PDF này không có audio Listening. Bạn có thể lưu đề nháp và thêm audio sau. Part 1–2 chỉ cần các ký tự chọn đáp án, không bắt buộc nhập chữ câu hỏi hoặc lựa chọn. Thêm audio trước khi sử dụng đề.",
                "These PDFs do not include Listening audio. Save the draft and add audio later. Parts 1–2 need only answer letters; written questions and choices are optional. Add audio before using the exam.",
              )}
            </div>
            {(reviewProblems.length > 0 || groupProblems.length > 0) && (
              <section aria-label={tr("Câu cần kiểm tra và sửa", "Questions to review and edit")} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <h3 className="font-semibold text-amber-950">{reviewErrors.length ? tr(`Cần bổ sung dữ liệu cho ${reviewErrors.length} câu trước khi lưu`, `${reviewErrors.length} questions need missing data before saving`) : tr("Không có câu thiếu dữ liệu bắt buộc.", "No questions are missing required data.")}</h3>
                <p className="text-xs text-amber-900">{tr("Các mục màu đỏ là lỗi chặn lưu. Bấm vào từng mục để chỉnh sửa. Cảnh báo OCR nằm trong mục xem thêm bên dưới.", "Red items block saving. Select an item to edit it. OCR source warnings are under the expandable section below.")}</p>
                {groupProblems.length > 0 && <div className="space-y-2">
                  <h4 className="font-semibold text-red-700">{tr(`${groupProblems.length} lỗi ghép bài đọc cần xử lý`, `${groupProblems.length} exercise grouping issues`)}</h4>
                  {groupProblems.map(problem => <button key={`${problem.part}-${problem.groupId}`} type="button" disabled={busy || reviewBusy || !problem.orders.length} onClick={() => void editProblem(problem.orders[0]!)} className="block w-full rounded border border-red-200 bg-white p-3 text-left text-red-700 disabled:opacity-50">
                    <span className="font-semibold">Part {problem.part} · {tr("Bài đọc liên kết các câu", "Exercise linked to questions")} {problem.orders.join(', ')}</span>
                    {problem.messages.map(message => <span key={message} className="mt-1 block text-xs">{message}</span>)}
                  </button>)}
                </div>}
                {reviewErrors.length > 0 && <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {reviewErrors.map(problem => <li key={problem.order}>
                    <button type="button" disabled={busy || reviewBusy} onClick={() => void editProblem(problem.order)} className="w-full rounded border border-red-200 bg-white px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-50">
                      <span className="font-semibold text-red-700">{tr(`Câu ${problem.order}`, `Question ${problem.order}`)} · Part {problem.part} · {tr("Cần sửa trước khi lưu", "Fix before saving")}</span>
                      {problem.messages.map(message => <span key={message} className="mt-1 block text-xs text-slate-700">{message}</span>)}
                    </button>
                  </li>)}
                </ul>}
                {reviewWarnings.length > 0 && <details className="rounded border border-amber-200 bg-white/60 p-3">
                  <summary className="cursor-pointer font-medium text-amber-900">{tr(`${reviewWarnings.length} cảnh báo nhận diện nguồn để tham khảo — không chặn lưu`, `${reviewWarnings.length} source recognition warnings — do not block saving`)}</summary>
                  {result.listeningScript && missingScripts.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span>{tr("Chưa đọc được từ PDF script (một số câu đã có nội dung từ đề LC):", "Not read from the script PDF (some questions already have LC booklet text):")}</span>
                    {missingScripts.map(order => <button key={order} type="button" disabled={busy || reviewBusy} onClick={() => void editProblem(order)} className="rounded border border-amber-300 bg-white px-2 py-1 text-blue-700 disabled:opacity-50">{tr(`Câu ${order}`, `Question ${order}`)}</button>)}
                  </div>}
                  <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {reviewWarnings.map(problem => <li key={problem.order}><button type="button" disabled={busy || reviewBusy} onClick={() => void editProblem(problem.order)} className="w-full rounded border border-amber-200 bg-white p-2 text-left disabled:opacity-50">
                      <span className="font-medium">{tr(`Câu ${problem.order}`, `Question ${problem.order}`)} · Part {problem.part}</span>
                      {problem.messages.map(message => <span key={message} className="mt-1 block text-xs text-slate-600">{message}</span>)}
                    </button></li>)}
                  </ul>
                </details>}
              </section>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">
                {tr(
                  "Xem cảnh báo và trang PDF nguồn",
                  "Warnings and source pages",
                )}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {result.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  {result.sourcePages?.map((p) => (
                    <a
                      key={`${p.section}-${p.page}`}
                      href={p.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-blue-600"
                    >
                      <FileText className="size-3" />
                      {p.section} · {p.page}
                    </a>
                  ))}
                </div>
              </div>
            </details>
            {!exam && (
              <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                <button
                  disabled={busy}
                  onClick={reset}
                  className="rounded-lg border px-4 py-2.5 text-sm"
                >
                  {tr("Chọn lại tài liệu", "Start over")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void createDraft()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {tr(
                    "Tạo đề nháp & duyệt câu hỏi",
                    "Create draft & review questions",
                  )}
                </button>
              </div>
            )}
          </section>
          {exam && (
            <PdfAiDraftReview
              exam={exam}
              jobId={jobId}
              result={result}
              locale={locale}
              focusQuestion={focusQuestion}
              onDraftChange={onDraftChange}
              onBusyChange={setReviewBusy}
            />
          )}
        </>
      )}
    </main>
  );
}
