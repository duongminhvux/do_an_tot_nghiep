"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Copy,
  FileWarning,
  Headphones,
  ImageOff,
  ListChecks,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type { ExamCheckIssue } from "@repo/shared-types/exam-checks";
import { TOEIC_PART_COUNTS } from "@repo/shared-types/exam-checks";
import type { QuestionItem } from "@/types/assessment";
import { cn } from "@/lib/utils";

type Severity = "ALL" | "error" | "warning";

const CODE_META: Record<
  string,
  { vi: string; en: string; icon: typeof CircleAlert; tone: string }
> = {
  IMAGE_REQUIRED: { vi: "Thiếu ảnh", en: "No photo", icon: ImageOff, tone: "bg-red-50 text-red-700 ring-red-200" },
  AUDIO_REQUIRED: { vi: "Thiếu audio", en: "No audio", icon: Headphones, tone: "bg-red-50 text-red-700 ring-red-200" },
  AUDIO_STALE: { vi: "Audio cũ", en: "Stale audio", icon: RefreshCw, tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  TOEIC_STRUCTURE: { vi: "Nội dung / đáp án", en: "Content / answer", icon: FileWarning, tone: "bg-red-50 text-red-700 ring-red-200" },
  DUPLICATE: { vi: "Trùng câu", en: "Duplicate", icon: Copy, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
};

/** Remove the "Câu 12: " prefix: the row already shows the number. */
const detail = (issue: ExamCheckIssue) =>
  issue.message.replace(/^(Câu|Question)\s+\S+:\s*/, "").replace(/^Part \d+:\s*/, "");

export function ExamChecksTab({
  issues,
  questionsList,
  totalQuestions,
  isFullToeic,
  locale,
  onEditQuestion,
  onOpenPart,
  toolbar,
}: {
  issues: ExamCheckIssue[];
  questionsList: QuestionItem[];
  totalQuestions?: number;
  isFullToeic: boolean;
  locale: string;
  onEditQuestion: (question: QuestionItem) => void;
  onOpenPart: (part: number) => void;
  /** Quick fixes shown above the results (e.g. listening audio generation). */
  toolbar?: ReactNode;
}) {
  const en = locale === "en";
  const [part, setPart] = useState<number | "ALL">("ALL");
  const [severity, setSeverity] = useState<Severity>("ALL");

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const active = questionsList.filter((q) => q.isActive !== false);
  const byId = useMemo(() => new Map(questionsList.map((q) => [String(q._id), q])), [questionsList]);

  const examIssues = issues.filter((i) => i.scope === "exam" || i.scope === "part");
  const visible = issues.filter(
    (i) =>
      (i.scope === "question" || i.scope === "group") &&
      (part === "ALL" || i.part === part) &&
      (severity === "ALL" || i.severity === severity),
  );
  const rows = useMemo(() => {
    const map = new Map<string, { key: string; order?: number; part?: number; question?: QuestionItem; items: ExamCheckIssue[] }>();
    for (const issue of visible) {
      const key = issue.scope === "question" ? `q:${issue.questionId}` : `g:${issue.groupId}:${issue.passageId ?? ""}`;
      const row = map.get(key) ?? {
        key,
        order: issue.order,
        part: issue.part,
        question: issue.questionId ? byId.get(issue.questionId) : undefined,
        items: [],
      };
      row.items.push(issue);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => (a.part ?? 0) - (b.part ?? 0) || (a.order ?? 0) - (b.order ?? 0));
  }, [visible, byId]);
  const questionsWithIssues = new Set(issues.filter((i) => i.questionId).map((i) => i.questionId)).size;

  const parts = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    part: n,
    have: active.filter((q) => Number(q.part) === n).length,
    need: isFullToeic ? TOEIC_PART_COUNTS[n] : undefined,
    errors: issues.filter((i) => i.part === n && i.severity === "error" && i.scope !== "part").length,
    warnings: issues.filter((i) => i.part === n && i.severity === "warning").length,
  }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <section
        className={cn(
          "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-white p-4",
          errors ? "border-red-200" : warnings ? "border-amber-200" : "border-emerald-200",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              errors ? "bg-red-50 text-red-600" : warnings ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
            )}
          >
            {errors ? <CircleAlert className="size-5" /> : warnings ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              {errors
                ? en ? "This exam is not ready to publish" : "Đề chưa đủ điều kiện xuất bản"
                : warnings
                  ? en ? "Ready, with some warnings" : "Đủ điều kiện, còn vài cảnh báo"
                  : en ? "All checks passed" : "Đề đã đạt toàn bộ kiểm tra"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {en
                ? "Checked live against the same rules used for publishing and the quality scan."
                : "Kiểm tra trực tiếp theo cùng bộ luật dùng khi xuất bản và khi quét chất lượng."}
            </p>
          </div>
        </div>
        <dl className="flex gap-6 text-center">
          {[
            [en ? "Errors" : "Lỗi", errors, "text-red-600"],
            [en ? "Warnings" : "Cảnh báo", warnings, "text-amber-600"],
            [en ? "Questions to fix" : "Câu cần sửa", questionsWithIssues, "text-slate-900"],
            [en ? "Questions" : "Số câu", `${active.length}${totalQuestions ? `/${totalQuestions}` : ""}`, "text-slate-900"],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
              <dd className={cn("text-xl font-bold tabular-nums", tone as string)}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {toolbar}

      {/* Parts overview */}
      <section aria-label={en ? "Parts" : "Theo Part"} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <button
          type="button"
          aria-pressed={part === "ALL"}
          onClick={() => setPart("ALL")}
          className={cn(
            "rounded-lg border bg-white px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
            part === "ALL" ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200 hover:border-slate-300",
          )}
        >
          <p className="text-xs font-semibold text-slate-700">{en ? "All parts" : "Tất cả Part"}</p>
          <p className="mt-1 text-[11px] text-slate-500">{issues.filter((i) => i.scope === "question" || i.scope === "group").length} {en ? "issues" : "vấn đề"}</p>
        </button>
        {parts.map((p) => {
          const short = p.need !== undefined && p.have !== p.need;
          return (
            <button
              key={p.part}
              type="button"
              aria-pressed={part === p.part}
              onClick={() => setPart(p.part)}
              className={cn(
                "rounded-lg border bg-white px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                part === p.part ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-slate-700">Part {p.part}</p>
                {p.errors > 0 ? (
                  <span className="rounded-full bg-red-50 px-1.5 text-[10px] font-bold tabular-nums text-red-700">{p.errors}</span>
                ) : p.warnings > 0 ? (
                  <span className="rounded-full bg-amber-50 px-1.5 text-[10px] font-bold tabular-nums text-amber-700">{p.warnings}</span>
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-500" />
                )}
              </div>
              <p className={cn("mt-1 text-[11px] tabular-nums", short ? "font-semibold text-red-600" : "text-slate-500")}>
                {p.have}
                {p.need !== undefined ? `/${p.need}` : ""} {en ? "questions" : "câu"}
              </p>
            </button>
          );
        })}
      </section>

      {/* Exam-level */}
      {examIssues.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700">
            {en ? "Exam size" : "Số lượng câu của đề"}
          </h3>
          <ul className="divide-y divide-slate-100">
            {examIssues.map((issue, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {issue.severity === "error" ? (
                  <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-red-500" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                )}
                <span className="min-w-0 flex-1 text-slate-700">{issue.message}</span>
                {issue.part !== undefined && (
                  <button
                    type="button"
                    onClick={() => onOpenPart(issue.part!)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    {en ? "Open Part" : "Mở Part"} {issue.part}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Question-level */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-xs font-semibold text-slate-700">
            {en ? "Questions that need fixing" : "Câu cần sửa"}
            {part !== "ALL" && ` · Part ${part}`} ({rows.length})
          </h3>
          <div role="group" aria-label={en ? "Severity" : "Mức độ"} className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(["ALL", "error", "warning"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={severity === value}
                onClick={() => setSeverity(value)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                  severity === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {value === "ALL" ? (en ? "All" : "Tất cả") : value === "error" ? (en ? "Errors" : "Lỗi") : en ? "Warnings" : "Cảnh báo"}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <ListChecks aria-hidden="true" className="size-8 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              {en ? "No question issues here." : "Không có câu nào cần sửa ở mục này."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const chips = [...new Set(row.items.map((i) => i.code))];
              return (
                <li key={row.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                    <span className="text-sm font-bold tabular-nums text-slate-900">
                      {row.order !== undefined ? `${en ? "Question" : "Câu"} ${row.order}` : en ? "Exercise" : "Bài nghe / đọc"}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">Part {row.part}</span>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((code) => {
                        const meta = CODE_META[code] ?? CODE_META.TOEIC_STRUCTURE!;
                        const Icon = meta.icon;
                        return (
                          <span key={code} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", meta.tone)}>
                            <Icon aria-hidden="true" className="size-3" />
                            {en ? meta.en : meta.vi}
                          </span>
                        );
                      })}
                    </div>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {row.items.map((issue, index) => (
                        <li key={index} className="flex gap-2">
                          <span aria-hidden="true" className={cn("mt-2 size-1.5 shrink-0 rounded-full", issue.severity === "error" ? "bg-red-500" : "bg-amber-500")} />
                          <span className="first-letter:uppercase">{detail(issue)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    {row.question ? (
                      <button
                        type="button"
                        onClick={() => onEditQuestion(row.question!)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        {en ? "Fix question" : "Sửa câu"}
                      </button>
                    ) : row.part !== undefined ? (
                      <button
                        type="button"
                        onClick={() => onOpenPart(row.part!)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {en ? "Open Part" : "Mở Part"} {row.part}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
