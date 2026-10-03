"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  serializeImportDraft,
  validateImportDraft,
  type ImportDraft,
  type ImportGroup,
  type ImportQuestion,
  type ImportIssue,
} from "@repo/shared-types/assessment-import";
import type { ExamItem } from "@/types";
import { examService } from "@/services/assessment.service";
import { useDraftUploads } from "@/hooks/use-draft-uploads";
import { getAvailableParts } from "./import-parts-config";
import { buildImportTemplate } from "./import-template";
import {
  createTemplateBlob,
  downloadTemplateBlob,
  type TemplateFormat,
} from "./import-template-export";
import { ImageUploadField } from "./image-upload-field";
import { AutoResizeTextarea } from "./auto-resize-textarea";
import { QuestionSavingStatus } from "./question-saving-status";

const fieldClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";
const emptyDraft: ImportDraft = { groups: [], passages: [], questions: [] };
const messageOf = (error: unknown) => {
  const e = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message = e.response?.data?.message || e.message;
  return Array.isArray(message) ? message.join("\n") : message;
};

export function ImportQuestionsWizard({
  exam,
  locale = "vi",
  onSuccess,
  onBusyChange,
}: {
  exam: ExamItem;
  locale?: string;
  onSuccess?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const en = locale === "en";
  const tr = (vi: string, english: string) => (en ? english : vi);
  const queryClient = useQueryClient();
  const parts = useMemo(() => getAvailableParts(exam, locale), [exam, locale]);
  const [partId, setPartId] = useState(() => parts[0]?.id || 1);
  const part = parts.find((p) => p.id === partId) || parts[0];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ImportDraft>(emptyDraft);
  const batchId = useMemo(() => crypto.randomUUID(), [draft]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [templateMode, setTemplateMode] = useState<"sample" | "blank">(
    "sample",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<TemplateFormat | null>(null);
  const busyRef = useRef(false);
  const urls = [
    ...draft.groups.flatMap((g) => g.passages.map((p) => p.imageUrl)),
    ...draft.questions.map((q) => q.imageUrl),
  ];
  const uploads = useDraftUploads(urls);
  const isUploading = Object.values(uploading).some(Boolean);
  const locked = busy || isUploading || saved;
  useEffect(() => {
    onBusyChange?.(busy || isUploading);
  }, [busy, isUploading, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const issues = useMemo(
    () =>
      part
        ? validateImportDraft(draft, part.id, locale, part.optionsCount)
        : [],
    [draft, part, locale],
  );
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const sample = part
    ? buildImportTemplate(part, templateMode === "blank", locale)
    : "";
  const optionKeys = ["A", "B", "C", "D"].slice(0, part?.optionsCount || 4);

  const selectPart = (id: number) => {
    if (id !== partId) {
      setPartId(id);
      setDraft(emptyDraft);
      setError("");
      setSaved(false);
    }
  };
  const updateQuestion = (index: number, fields: Partial<ImportQuestion>) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, ...fields } : q,
      ),
    }));
  const updatePassage = (
    groupId: string,
    passageId: string,
    fields: Partial<ImportGroup["passages"][number]>,
  ) =>
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              passages: g.passages.map((p) =>
                p.id === passageId ? { ...p, ...fields } : p,
              ),
            }
          : g,
      ),
    }));
  const goToIssue = (issue: ImportIssue) =>
    document
      .getElementById(
        issue.questionIndex !== undefined
          ? `import-question-${issue.questionIndex}`
          : `import-group-${issue.groupId}`,
      )
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

  const analyze = async () => {
    if (!part || busyRef.current) return;
    if (mode === "text" ? !source.trim() : !file) {
      setError(
        tr(
          "Hãy nhập nội dung hoặc chọn file đề.",
          "Enter text or select a file.",
        ),
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data =
        mode === "file"
          ? new FormData()
          : { rawText: source, part: part.id, section: part.section };
      if (data instanceof FormData) {
        data.append("file", file!);
        data.append("part", String(part.id));
        data.append("section", part.section);
      }
      const response = await examService.parseQuestions(exam._id, data);
      const result = response.data;
      if (
        !result ||
        !Array.isArray(result.questions) ||
        !result.questions.length
      )
        throw new Error(
          tr(
            "Không nhận diện được câu hỏi. Mỗi câu hãy bắt đầu bằng số câu, ví dụ “101. Nội dung câu hỏi”. PDF dạng ảnh cần được chuyển thành văn bản trước.",
            "No questions found. Start each question with a number, e.g. “101. Question content”. Scanned PDFs need text recognition first.",
          ),
        );
      // Keep malformed options visible. Add empty inputs only for missing keys.
      setDraft({
        ...result,
        groups: result.groups || [],
        passages: result.passages || [],
        questions: result.questions.map((q) => ({
          ...q,
          options: [
            ...(q.options || []),
            ...optionKeys
              .filter((key) => !q.options?.some((o) => o.key === key))
              .map((key) => ({ key, text: "" })),
          ],
        })),
      });
      if (mode === "file" && result.rawText) setSource(result.rawText);
      setStep(3);
    } catch (err) {
      setError(
        messageOf(err) ||
          tr("Không thể phân tích đề.", "Unable to parse the questions."),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = async () => {
    if (!part || busyRef.current || locked || errors.length) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    uploads.startSaving();
    try {
      const response = await examService.importQuestions(exam._id, {
        part: part.id,
        section: part.section,
        batchId,
        passageGroups: draft.groups.map((g) => ({
          tempId: g.id,
          title: g.title,
          passages: g.passages.map((p) => ({
            tempId: p.id,
            type: p.type,
            content: p.content.trim(),
            audioUrl: p.audioUrl?.trim(),
            imageUrl: p.imageUrl?.trim(),
          })),
        })),
        questions: draft.questions.map((q) => ({
          content: q.content.trim(),
          options: q.options.map((o) => ({ key: o.key, text: o.text.trim() })),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation?.trim(),
          order: q.order,
          passageGroupTempId: q.passageGroupTempId,
          passageTempId: q.passageTempId,
          imageUrl: q.imageUrl?.trim(),
          audioUrl: q.audioUrl?.trim(),
          isActive: true,
        })),
      });
      const result = response.data;
      uploads.commit(urls);
      setSaved(true);
      setNotice(
        tr(
          `Đã thêm ${result?.importedCount || draft.questions.length} câu hỏi vào cuối đề.`,
          `Added ${result?.importedCount || draft.questions.length} questions to the end of the exam.`,
        ),
      );
      await Promise.all(
        ["admin-exam-questions", "admin-exam-passages", "admin-exam"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key, exam._id] }),
        ),
      );
    } catch (err) {
      const response = (err as { response?: { status?: number } }).response;
      if (!response || messageOf(err)?.includes("chưa dọn sạch dữ liệu")) {
        // A response can be lost after saving. Preserve assets that may now be referenced.
        uploads.commit(urls);
      }
      setError(
        messageOf(err) ||
          tr(
            "Lưu thất bại. Bản xem trước được giữ lại để bạn kiểm tra.",
            "Saving failed. Your preview has been kept for review.",
          ),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      uploads.finishSaving();
    }
  };

  const chooseFile = (next?: File) => {
    if (!next || locked) return;
    if (!/\.(docx|pdf|txt)$/i.test(next.name)) {
      setError(
        tr(
          "Chọn file .docx, .pdf hoặc .txt. File .doc cũ cần lưu lại thành .docx.",
          "Choose .docx, .pdf or .txt. Save legacy .doc files as .docx first.",
        ),
      );
      return;
    }
    if (next.size > 25 * 1024 * 1024 || next.size === 0) {
      setError(
        tr(
          "File phải có nội dung và không vượt quá 25 MB.",
          "The file must not be empty or exceed 25 MB.",
        ),
      );
      return;
    }
    setFile(next);
    setError("");
  };
  const download = async (format: TemplateFormat) => {
    if (!part || downloading) return;
    setDownloading(format);
    setError("");
    try {
      const blob = await createTemplateBlob(sample, format);
      downloadTemplateBlob(blob, `Part_${part.id}_${templateMode}.${format}`);
    } catch (err) {
      setError(
        messageOf(err) ||
          tr(
            "Không thể tạo file mẫu. Vui lòng thử lại.",
            "Unable to create the template file. Please try again.",
          ),
      );
    } finally {
      setDownloading(null);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample);
      setNotice(tr("Đã sao chép mẫu.", "Template copied."));
    } catch {
      setError(
        tr(
          "Không thể truy cập clipboard. Bạn có thể chọn và sao chép mẫu bên dưới.",
          "Clipboard is unavailable. Select and copy the template below.",
        ),
      );
    }
  };
  const addGroup = () => {
    const id = `group-${crypto.randomUUID()}`,
      pid = `passage-${crypto.randomUUID()}`;
    setDraft((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          id,
          tempId: id,
          title: tr("Bài tập mới", "New exercise"),
          order: prev.groups.length + 1,
          passages: [
            {
              id: pid,
              tempId: pid,
              groupTempId: id,
              type: "TEXT",
              content: "",
              inputMode: "TEXT",
            },
          ],
        },
      ],
    }));
  };
  const addQuestion = (group?: ImportGroup) => {
    const number = Math.max(0, ...draft.questions.map((q) => q.order || 0)) + 1;
    setDraft((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          order: number,
          content: "",
          options: optionKeys.map((key) => ({ key, text: "" })),
          correctAnswer: "",
          ...(group
            ? {
                passageGroupTempId: group.id,
                passageTempId: group.passages[0]?.id,
              }
            : {}),
        },
      ],
    }));
  };

  if (exam.type !== "TOEIC")
    return (
      <p>
        {tr(
          "Luồng import này hiện hỗ trợ đề TOEIC.",
          "This import workflow currently supports TOEIC exams.",
        )}
      </p>
    );
  if (!part)
    return (
      <p>
        {tr(
          "Đề này chưa có Part để import.",
          "This exam has no importable Parts.",
        )}
      </p>
    );

  const renderQuestion = (q: ImportQuestion, index: number) => {
    const questionIssues = issues.filter((i) => i.questionIndex === index);
    return (
      <article
        id={`import-question-${index}`}
        key={index}
        className={`scroll-mt-6 rounded border p-4 space-y-3 ${questionIssues.some((i) => i.severity === "error") ? "border-red-200 bg-red-50/20" : "border-slate-200 bg-white"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            {tr("Câu", "Question")}
            <input
              aria-label={tr("Số câu trong bản soạn", "Source question number")}
              type="number"
              min={1}
              value={q.order || ""}
              onChange={(e) =>
                updateQuestion(index, { order: Number(e.target.value) })
              }
              className="w-20 rounded border border-slate-200 px-2 py-1"
            />
          </label>
          <span className="text-xs text-slate-400">
            {q.sourceLine
              ? tr(
                  `Dòng ${q.sourceLine} trong bản soạn`,
                  `Source line ${q.sourceLine}`,
                )
              : ""}
          </span>
          <button
            type="button"
            aria-label={tr("Xóa câu hỏi", "Delete question")}
            className="p-2 text-red-500"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                questions: prev.questions.filter((_, i) => i !== index),
              }))
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          {tr("Nội dung câu hỏi", "Question content")}
          <AutoResizeTextarea
            minRows={2}
            value={q.content}
            onChange={(e) => updateQuestion(index, { content: e.target.value })}
            className={fieldClass}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((option, oi) => (
            <label
              key={oi}
              className={`flex items-start gap-2 rounded border p-2 ${q.correctAnswer === option.key ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
            >
              <input
                type="radio"
                name={`answer-${index}`}
                aria-label={tr(
                  `Chọn đáp án ${option.key}`,
                  `Select answer ${option.key}`,
                )}
                checked={q.correctAnswer === option.key}
                onChange={() =>
                  updateQuestion(index, { correctAnswer: option.key })
                }
                className="mt-2 accent-emerald-600"
              />
              <span className="mt-1.5 text-xs font-bold">{option.key}</span>
              <AutoResizeTextarea
                aria-label={tr(
                  `Nội dung lựa chọn ${option.key}`,
                  `Option ${option.key} content`,
                )}
                minRows={1}
                value={option.text}
                onChange={(e) =>
                  updateQuestion(index, {
                    options: q.options.map((o, i) =>
                      i === oi ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
                className="min-w-0 flex-1 bg-transparent p-1 text-sm focus:outline-none"
              />
              {q.options.filter((o) => o.key === option.key).length > 1 ||
              !optionKeys.includes(option.key) ? (
                <button
                  type="button"
                  aria-label={tr("Xóa lựa chọn dư", "Remove extra option")}
                  onClick={() =>
                    updateQuestion(index, {
                      options: q.options.filter((_, i) => i !== oi),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              ) : null}
            </label>
          ))}
        </div>
        <p
          className={`text-xs ${q.correctAnswer ? "text-emerald-700" : "text-amber-700"}`}
        >
          {q.correctAnswer
            ? tr(
                `Đáp án đã chọn: ${q.correctAnswer}`,
                `Selected answer: ${q.correctAnswer}`,
              )
            : tr(
                "Chọn nút tròn cạnh lựa chọn để xác định đáp án đúng.",
                "Select the radio button next to the correct option.",
              )}
        </p>
        {part.hasPassage && (
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            {tr("Bài đọc / bài nghe liên kết", "Linked exercise")}
            <select
              className={fieldClass}
              value={q.passageGroupTempId || ""}
              onChange={(e) => {
                const g = draft.groups.find(
                  (item) => item.id === e.target.value,
                );
                updateQuestion(index, {
                  passageGroupTempId: g?.id,
                  passageTempId: g?.passages[0]?.id,
                });
              }}
            >
              <option value="">{tr("Chọn bài tập", "Select exercise")}</option>
              {draft.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {!part.hasPassage && part.hasAudio && (
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            Audio URL
            <input
              type="url"
              className={fieldClass}
              value={q.audioUrl || ""}
              onChange={(e) =>
                updateQuestion(index, { audioUrl: e.target.value })
              }
            />
          </label>
        )}
        {!part.hasPassage && part.hasImage && (
          <ImageUploadField
            value={q.imageUrl || ""}
            onChange={(url) => updateQuestion(index, { imageUrl: url })}
            onUploaded={uploads.track}
            onBusyChange={(value) =>
              setUploading((prev) => ({ ...prev, [`q-${index}`]: value }))
            }
            onError={setError}
            disabled={locked}
          />
        )}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">
            {tr("Lời giải (tùy chọn)", "Explanation (optional)")}
          </summary>
          <AutoResizeTextarea
            minRows={2}
            value={q.explanation || ""}
            onChange={(e) =>
              updateQuestion(index, { explanation: e.target.value })
            }
            className={`${fieldClass} mt-2`}
          />
        </details>
        {questionIssues
          .filter((i) => i.severity === "error")
          .map((i, idx) => (
            <p key={idx} className="text-xs text-red-600">
              {i.message}
            </p>
          ))}
      </article>
    );
  };

  return (
    <>
    {busy && (
      <QuestionSavingStatus
        locale={locale}
        title={
          step === 2
            ? (en ? "Analyzing questions…" : "Đang phân tích đề thi…")
            : (en ? "Saving questions to exam…" : "Đang lưu câu hỏi vào đề thi…")
        }
        description={
          step === 2
            ? (en ? "Extracting and validating questions, please wait…" : "Đang trích xuất và phân tích câu hỏi, vui lòng đợi…")
            : (en ? "Saving questions and exercises to database, please wait…" : "Đang lưu câu hỏi và bài tập vào hệ thống, vui lòng đợi…")
        }
      />
    )}
    <div aria-busy={busy} className={`w-full min-w-0 max-w-none space-y-5 ${busy ? 'pointer-events-none select-none' : ''}`}>
      <ol
        className="grid grid-cols-3 gap-2"
        aria-label={tr("Các bước import", "Import steps")}
      >
        {[
          tr("Chọn Part", "Select Part"),
          tr("Soạn / tải đề", "Prepare questions"),
          tr("Kiểm tra & lưu", "Review & save"),
        ].map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? "step" : undefined}
            className={`rounded p-3 text-xs sm:text-sm font-medium ${step === i + 1 ? "bg-blue-600 text-white" : step > i + 1 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 whitespace-pre-line rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}
      {saved ? (
        <div className="rounded border border-emerald-200 bg-white p-8 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="text-lg font-bold">
            {tr("Import hoàn tất", "Import complete")}
          </h2>
          <button type="button" onClick={onSuccess} className={buttonClass}>
            {tr("Quay về đề thi", "Return to exam")}
          </button>
        </div>
      ) : (
        <>
          {step === 1 && (
            <section className="rounded border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                {tr(
                  "Bạn muốn thêm câu hỏi cho Part nào?",
                  "Which Part are you adding questions to?",
                )}
              </h2>
              <p className="text-sm text-slate-500">
                {tr(
                  "Import một Part mỗi lần. Câu mới sẽ được thêm vào cuối đề, không ghi đè câu đã có.",
                  "Import one Part at a time. New questions are appended without overwriting existing questions.",
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {parts.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectPart(p.id)}
                    aria-pressed={part.id === p.id}
                    className={`rounded border-2 p-4 text-left space-y-2 ${part.id === p.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}
                  >
                    <span className="text-xs font-bold text-blue-600">
                      Part {p.id} · {p.section}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {p.optionsCount}{" "}
                      {tr("lựa chọn mỗi câu", "options per question")} ·{" "}
                      {p.hasPassage
                        ? tr(
                            "Câu hỏi chung bài đọc / bài nghe",
                            "Questions share an exercise",
                          )
                        : tr("Câu hỏi độc lập", "Standalone questions")}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setError("");
                  }}
                  className={`${buttonClass} !bg-blue-600 !text-white`}
                >
                  {tr("Tiếp tục soạn đề", "Prepare questions")}
                </button>
              </div>
            </section>
          )}
          {step === 2 && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 xl:col-span-9 min-w-0 rounded border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold">
                    Part {part.id} · {tr("Nhập nội dung đề", "Question source")}
                  </h2>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setStep(1)}
                    className={buttonClass}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {tr("Đổi Part", "Change Part")}
                  </button>
                </div>
                <div className="flex gap-2">
                  {(["text", "file"] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      disabled={locked}
                      aria-pressed={mode === value}
                      onClick={() => {
                        setMode(value);
                        setError("");
                      }}
                      className={`${buttonClass} ${mode === value ? "!bg-blue-50 !border-blue-300 !text-blue-700" : ""}`}
                    >
                      {value === "text" ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {value === "text"
                        ? tr("Dán / soạn văn bản", "Paste / type text")
                        : tr("Tải file", "Upload file")}
                    </button>
                  ))}
                </div>
                {mode === "text" ? (
                  <label className="block space-y-2 text-sm text-slate-600">
                    {tr("Nội dung đề", "Question text")}
                    <textarea
                      disabled={locked}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      rows={22}
                      placeholder={buildImportTemplate(part, true, locale)}
                      className={`${fieldClass} min-h-[560px] font-mono text-base leading-7`}
                    />
                    <span className="block text-xs text-slate-400">
                      {source.split("\n").length} {tr("dòng", "lines")} ·{" "}
                      {source.length.toLocaleString()}{" "}
                      {tr("ký tự", "characters")}
                    </span>
                  </label>
                ) : (
                  <div
                    className="rounded border-2 border-dashed border-slate-300 bg-slate-50 p-6 space-y-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      chooseFile(e.dataTransfer.files[0]);
                    }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".docx,.pdf,.txt"
                      disabled={locked}
                      onChange={(e) => {
                        chooseFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                    <Upload className="h-8 w-8 text-blue-500" />
                    <p className="text-sm font-semibold">
                      {file?.name ||
                        tr(
                          "Kéo thả file đề vào đây",
                          "Drop your question file here",
                        )}
                    </p>
                    <p className="text-xs text-slate-500">
                      .docx, .pdf, .txt ·{" "}
                      {tr(
                        "Tối đa 25 MB. PDF cần có văn bản chọn được. Ảnh và audio được gắn ở bước xem trước.",
                        "Up to 25 MB. PDF must contain selectable text. Attach images and audio in the preview.",
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => fileRef.current?.click()}
                      className={buttonClass}
                    >
                      {file
                        ? tr("Chọn file khác", "Replace file")
                        : tr("Chọn file từ thiết bị", "Choose file")}
                    </button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={
                      locked || (mode === "text" ? !source.trim() : !file)
                    }
                    onClick={() => void analyze()}
                    className={`${buttonClass} !bg-blue-600 !text-white`}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy
                      ? tr("Đang phân tích…", "Analyzing…")
                      : tr("Phân tích & xem trước", "Analyze & preview")}
                  </button>
                </div>
              </div>
              <aside className="lg:col-span-4 xl:col-span-3 min-w-0 rounded border border-slate-200 bg-white p-5 space-y-4 h-fit">
                <h3 className="text-sm font-bold">
                  {tr("Soạn đúng format", "Formatting guide")}
                </h3>
                <ol className="list-decimal pl-4 space-y-2 text-xs leading-5 text-slate-600">
                  <li>
                    {tr(
                      "Mỗi câu bắt đầu bằng số câu, rồi A., B., C.",
                      "Start with the question number, followed by A., B., C.",
                    )}{" "}
                    {part.optionsCount === 4 && "D."}
                  </li>
                  <li>
                    {tr(
                      "Answer: A là bắt buộc. Explanation: là tùy chọn.",
                      "Answer: A is required. Explanation: is optional.",
                    )}
                  </li>
                  {part.hasPassage && (
                    <li>
                      {tr(
                        "Đặt [EXERCISE] và [PASSAGE] trước nhóm câu hỏi. Part 7 có thể đặt 2–3 [PASSAGE] liên tiếp.",
                        "Place [EXERCISE] and [PASSAGE] before linked questions. Part 7 may have 2–3 consecutive [PASSAGE] blocks.",
                      )}
                    </li>
                  )}
                  {[6, 7].includes(part.id) && (
                    <li>
                      {tr(
                        "Mỗi passage chỉ có Content: hoặc Image:, không dùng cả hai.",
                        "Each passage uses Content: or Image:, never both.",
                      )}
                    </li>
                  )}
                  <li>
                    {tr(
                      "Số câu trong bản soạn dùng để đối chiếu. Khi lưu, hệ thống đánh số tiếp theo các câu đã có.",
                      "Source numbers are for review. Saved questions are numbered after existing questions.",
                    )}
                  </li>
                </ol>
                <div className="flex gap-2">
                  {(["sample", "blank"] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setTemplateMode(value)}
                      className={`${buttonClass} !text-xs ${templateMode === value ? "!bg-blue-50 !text-blue-700" : ""}`}
                    >
                      {value === "sample"
                        ? tr("Ví dụ", "Example")
                        : tr("Khung trống", "Blank template")}
                    </button>
                  ))}
                </div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-sm leading-6 text-slate-100">
                  {sample}
                </pre>
                <p className="text-xs text-slate-500">
                  {tr(
                    "Mẫu chỉ để tham khảo. Thay nội dung và link media bằng đề thật của bạn.",
                    "Examples are for reference. Replace text and media links with your own questions.",
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className={buttonClass}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {tr("Sao chép", "Copy")}
                  </button>
                  {(["pdf", "docx", "txt"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      disabled={downloading !== null}
                      onClick={() => void download(format)}
                      className={buttonClass}
                      aria-label={tr(
                        `Tải mẫu ${format === "docx" ? "Word" : format.toUpperCase()}`,
                        `Download ${format === "docx" ? "Word" : format.toUpperCase()} template`,
                      )}
                    >
                      {downloading === format ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {format === "docx"
                        ? "Word (.docx)"
                        : format.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setSource((prev) =>
                      prev.trim()
                        ? `${prev.trim()}\n\n---\n\n${sample}`
                        : sample,
                    );
                    setMode("text");
                  }}
                  className={`${buttonClass} w-full`}
                >
                  <Plus className="h-4 w-4" />
                  {tr(
                    "Chèn mẫu vào cuối nội dung",
                    "Append template to editor",
                  )}
                </button>
              </aside>
            </section>
          )}
          {step === 3 && (
            <section className="space-y-4">
              <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">
                      {tr("Kiểm tra trước khi lưu", "Review before saving")}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Part {part.id} · {draft.questions.length}{" "}
                      {tr("câu hỏi", "questions")} · {draft.groups.length}{" "}
                      {tr("bài tập", "exercises")}
                    </p>
                  </div>
                  <span
                    className={`rounded px-3 py-1 text-xs font-semibold ${errors.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {errors.length
                      ? tr(
                          `${errors.length} lỗi cần sửa`,
                          `${errors.length} errors to fix`,
                        )
                      : tr("Sẵn sàng import", "Ready to import")}
                  </span>
                </div>
                {errors.length > 0 && (
                  <div role="alert" className="rounded bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-700">
                      {tr(
                        "Sửa các lỗi sau để mở nút lưu:",
                        "Fix these errors to enable saving:",
                      )}
                    </p>
                    <ul className="mt-2 max-h-48 overflow-auto space-y-1">
                      {errors.map((issue, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="text-left text-xs text-red-700 underline underline-offset-2"
                            onClick={() => goToIssue(issue)}
                          >
                            {issue.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {warnings.length > 0 || draft.warnings?.length ? (
                  <details className="rounded bg-amber-50 p-3 text-amber-800">
                    <summary className="cursor-pointer text-sm font-semibold">
                      {tr("Lưu ý cần kiểm tra", "Review notes")} (
                      {warnings.length + (draft.warnings?.length || 0)})
                    </summary>
                    <ul className="mt-2 max-h-40 overflow-auto space-y-1 text-xs">
                      {[...warnings, ...(draft.warnings || [])].map(
                        (issue, i) => (
                          <li key={i}>{issue.message}</li>
                        ),
                      )}
                    </ul>
                  </details>
                ) : null}
                <p className="text-xs text-slate-500">
                  {tr(
                    "Có thể sửa trực tiếp bên dưới. Nút lưu chỉ mở khi hết lỗi; các lưu ý không chặn import.",
                    "Edit directly below. Saving is enabled when all errors are fixed; review notes do not block import.",
                  )}
                </p>
              </div>
              <fieldset
                disabled={busy || isUploading || saved}
                className="space-y-5"
              >
                {draft.groups.map((g) => (
                  <section
                    key={g.id}
                    id={`import-group-${g.id}`}
                    className="scroll-mt-6 rounded border border-blue-200 bg-blue-50/40 p-4 space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        aria-label={tr("Tên bài tập", "Exercise title")}
                        className={`${fieldClass} font-semibold`}
                        value={g.title}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            groups: prev.groups.map((item) =>
                              item.id === g.id
                                ? { ...item, title: e.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={isUploading}
                        aria-label={tr(
                          "Xóa bài tập và câu hỏi liên kết",
                          "Delete exercise and linked questions",
                        )}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            groups: prev.groups.filter(
                              (item) => item.id !== g.id,
                            ),
                            questions: prev.questions.filter(
                              (q) =>
                                q.passageGroupTempId !== g.id &&
                                !g.passages.some(
                                  (p) => p.id === q.passageTempId,
                                ),
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {g.passages.map((p, pi) => (
                        <div
                          key={p.id}
                          className="rounded border border-slate-200 bg-white p-3 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">
                              {tr("Đoạn", "Passage")} {pi + 1}
                            </h3>
                            {g.passages.length > 1 && (
                              <button
                                type="button"
                                disabled={isUploading}
                                aria-label={tr("Xóa đoạn", "Delete passage")}
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    groups: prev.groups.map((item) =>
                                      item.id === g.id
                                        ? {
                                            ...item,
                                            passages: item.passages.filter(
                                              (passage) => passage.id !== p.id,
                                            ),
                                          }
                                        : item,
                                    ),
                                    questions: prev.questions.map((q) =>
                                      q.passageTempId === p.id
                                        ? {
                                            ...q,
                                            passageTempId: g.passages.find(
                                              (other) => other.id !== p.id,
                                            )?.id,
                                          }
                                        : q,
                                    ),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            )}
                          </div>
                          {[6, 7].includes(part.id) && (
                            <label className="block space-y-1 text-xs text-slate-600">
                              {tr(
                                "Loại nội dung (đổi loại sẽ xóa nội dung cũ)",
                                "Content type (switching clears current content)",
                              )}
                              <select
                                disabled={isUploading}
                                className={fieldClass}
                                value={
                                  p.inputMode || (p.imageUrl ? "IMAGE" : "TEXT")
                                }
                                onChange={(e) =>
                                  updatePassage(g.id, p.id, {
                                    inputMode: e.target.value as
                                      "TEXT" | "IMAGE",
                                    content: "",
                                    imageUrl: "",
                                  })
                                }
                              >
                                <option value="TEXT">Text</option>
                                <option value="IMAGE">Image</option>
                              </select>
                            </label>
                          )}
                          {part.hasAudio && (
                            <label className="block space-y-1 text-xs text-slate-600">
                              Audio URL
                              <input
                                className={fieldClass}
                                type="url"
                                value={p.audioUrl || ""}
                                onChange={(e) =>
                                  updatePassage(g.id, p.id, {
                                    audioUrl: e.target.value,
                                  })
                                }
                              />
                              {p.audioUrl && (
                                <audio
                                  controls
                                  src={p.audioUrl}
                                  className="mt-2 h-9 w-full"
                                />
                              )}
                            </label>
                          )}
                          {p.inputMode === "IMAGE" &&
                          [6, 7].includes(part.id) ? (
                            <ImageUploadField
                              value={p.imageUrl || ""}
                              onChange={(url) =>
                                updatePassage(g.id, p.id, {
                                  imageUrl: url,
                                  content: "",
                                })
                              }
                              onUploaded={uploads.track}
                              onBusyChange={(value) =>
                                setUploading((prev) => ({
                                  ...prev,
                                  [p.id]: value,
                                }))
                              }
                              onError={setError}
                              disabled={locked}
                            />
                          ) : (
                            <label className="block space-y-1 text-xs text-slate-600">
                              {part.hasAudio
                                ? tr("Transcript", "Transcript")
                                : tr("Nội dung bài đọc", "Passage text")}
                              <AutoResizeTextarea
                                minRows={5}
                                value={p.content}
                                onChange={(e) =>
                                  updatePassage(g.id, p.id, {
                                    content: e.target.value,
                                  })
                                }
                                className={fieldClass}
                              />
                            </label>
                          )}
                          {issues
                            .filter(
                              (i) =>
                                i.passageId === p.id && i.severity === "error",
                            )
                            .map((i, idx) => (
                              <p key={idx} className="text-xs text-red-600">
                                {i.message}
                              </p>
                            ))}
                        </div>
                      ))}
                    </div>
                    {part.id === 7 && g.passages.length < 3 && (
                      <button
                        type="button"
                        disabled={isUploading}
                        className={buttonClass}
                        onClick={() => {
                          const id = `passage-${crypto.randomUUID()}`;
                          setDraft((prev) => ({
                            ...prev,
                            groups: prev.groups.map((item) =>
                              item.id === g.id
                                ? {
                                    ...item,
                                    passages: [
                                      ...item.passages,
                                      {
                                        id,
                                        tempId: id,
                                        groupTempId: g.id,
                                        type: "TEXT",
                                        content: "",
                                        inputMode: "TEXT",
                                      },
                                    ],
                                  }
                                : item,
                            ),
                          }));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {tr("Thêm đoạn vào bài tập", "Add passage to exercise")}
                      </button>
                    )}
                    {draft.questions.map((q, index) =>
                      q.passageGroupTempId === g.id
                        ? renderQuestion(q, index)
                        : null,
                    )}
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => addQuestion(g)}
                    >
                      <Plus className="h-4 w-4" />
                      {tr(
                        "Thêm câu hỏi cho bài tập này",
                        "Add question to this exercise",
                      )}
                    </button>
                  </section>
                ))}
                {draft.questions.map((q, index) =>
                  !draft.groups.some((g) => g.id === q.passageGroupTempId)
                    ? renderQuestion(q, index)
                    : null,
                )}
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => (part.hasPassage ? addGroup() : addQuestion())}
                >
                  <Plus className="h-4 w-4" />
                  {part.hasPassage
                    ? tr("Thêm bài tập", "Add exercise")
                    : tr("Thêm câu hỏi", "Add question")}
                </button>
              </fieldset>
              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setSource(serializeImportDraft(draft));
                    setStep(2);
                    setMode("text");
                    setError("");
                  }}
                  className={buttonClass}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {tr("Quay lại bản soạn", "Back to source")}
                </button>
                <button
                  type="button"
                  disabled={locked || errors.length > 0}
                  onClick={() => void save()}
                  className={`${buttonClass} !bg-emerald-600 !text-white`}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {busy
                    ? tr("Đang lưu…", "Saving…")
                    : tr(
                        `Lưu ${draft.questions.length} câu vào đề`,
                        `Save ${draft.questions.length} questions`,
                      )}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
    </>
  );
}
