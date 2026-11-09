"use client";

import { createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  ImageOff,
  Loader2,
  X,
} from "lucide-react";
import { estimateToeicScore } from "@repo/shared-types/toeic-score";
import { examService } from "@/services/assessment.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserNameLink } from "@/components/users/user-name-link";
import { cn } from "@/lib/utils";

/** Render stored rich text with formatting only; no scripts, event attributes or embedded frames. */
function AttemptText({ value, className }: { value?: string; className?: string }) {
  const content = useMemo(() => {
    if (!value || typeof DOMParser === "undefined") return value;
    const doc = new DOMParser().parseFromString(value, "text/html");
    const allowed = new Set([
      "p", "div", "span", "strong", "b", "em", "i", "u", "br", "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td", "blockquote", "sup", "sub",
    ]);
    const render = (node: Node, index: number): ReactNode => {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return null;
      const element = node as Element,
        tag = element.tagName.toLowerCase();
      if (["script", "style", "iframe", "object", "svg", "form"].includes(tag)) return null;
      const children = Array.from(node.childNodes).map(render);
      return allowed.has(tag)
        ? createElement(tag, { key: index }, tag === "br" ? undefined : children)
        : children;
    };
    return Array.from(doc.body.childNodes).map(render);
  }, [value]);
  return (
    <div
      className={cn(
        "min-w-0 whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere] [&_p+p]:mt-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2",
        className,
      )}
    >
      {content}
    </div>
  );
}

function mediaUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, new URL(process.env.NEXT_PUBLIC_API_URL || "/api", window.location.origin));
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function QuestionMedia({ imageUrl, audioUrl, label, en }: { imageUrl?: string; audioUrl?: string; label: string; en: boolean }) {
  const picture = mediaUrl(imageUrl),
    audio = mediaUrl(audioUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [picture]);
  if (!picture && !audio) return null;
  return (
    <div className="space-y-2">
      {picture &&
        (failed ? (
          <div className="flex h-24 w-full max-w-sm items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
            <ImageOff aria-hidden="true" className="size-4" />
            {en ? "Image could not be loaded" : "Không tải được ảnh"}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt={label}
            loading="lazy"
            onError={() => setFailed(true)}
            className="max-h-72 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
          />
        ))}
      {audio && <audio controls preload="none" src={audio} aria-label={label} className="h-9 w-full max-w-md" />}
    </div>
  );
}

type Verdict = "correct" | "wrong" | "blank" | "pending" | "unknown";
type Filter = "ALL" | "wrong" | "correct" | "blank" | "flagged";

const VERDICT_STYLE: Record<Verdict, string> = {
  correct: "border-emerald-300 bg-emerald-50 text-emerald-800",
  wrong: "border-red-300 bg-red-50 text-red-700",
  blank: "border-slate-200 bg-white text-slate-500",
  pending: "border-blue-200 bg-blue-50 text-blue-700",
  unknown: "border-dashed border-slate-300 bg-slate-50 text-slate-400",
};

const formatDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

export function AttemptDetailDialog({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { locale } = useParams();
  const en = locale === "en";
  const { t } = useTranslation("assessment");
  const text = (vi: string, english: string) => (en ? english : vi);
  const [part, setPart] = useState<number | "ALL">("ALL");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-attempt-detail", attemptId],
    queryFn: () => examService.getAttempt(attemptId),
    staleTime: 0,
    retry: false,
  });
  const detail = query.data?.data as
    | (NonNullable<typeof query.data>["data"] & { activeSeconds?: number; flaggedQuestions?: string[] })
    | undefined;
  const user = detail?.userId && typeof detail.userId === "object" ? detail.userId : null;
  const finished = detail?.status === "FINISHED" || detail?.status === "COMPLETED";
  const flagged = useMemo(() => new Set(detail?.flaggedQuestions ?? []), [detail?.flaggedQuestions]);

  // Attempts saved before the PostgreSQL migration keep answers under the old
  // question IDs, which no longer match the saved exam snapshot. Nothing maps
  // them back reliably, so per-question results are shown as unknown.
  const legacyAnswers = useMemo(() => {
    const keys = Object.keys(detail?.answers ?? {});
    if (!keys.length) return false;
    const ids = new Set((detail?.questions ?? []).map((q) => q._id));
    return !keys.some((key) => ids.has(key));
  }, [detail]);
  const questions = useMemo(
    () =>
      (detail?.questions ?? []).map((q, index) => {
        const answer = legacyAnswers ? "" : detail?.answers?.[q._id] || "";
        const verdict: Verdict = legacyAnswers
          ? "unknown"
          : !answer ? "blank" : !finished ? "pending" : answer === q.correctAnswer ? "correct" : "wrong";
        const order = (q as { order?: number }).order;
        return { ...q, number: Number.isInteger(order) && order! > 0 ? order! : index + 1, answer, verdict };
      }),
    [detail, finished, legacyAnswers],
  );
  const parts = useMemo(() => [...new Set(questions.map((q) => q.part))].sort((a, b) => a - b), [questions]);
  const visible = questions.filter(
    (q) =>
      (part === "ALL" || q.part === part) &&
      (filter === "ALL" ||
        (filter === "flagged" ? flagged.has(q._id) : q.verdict === filter)),
  );
  const selected = questions.find((q) => q._id === selectedId) ?? visible[0] ?? questions[0];
  const position = visible.findIndex((q) => q._id === selected?._id);
  const go = (step: number) => {
    const next = visible[position + step];
    if (next) setSelectedId(next._id);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["SELECT", "INPUT", "TEXTAREA", "AUDIO"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stored = (value: number | undefined, fallback: number) => (Number.isFinite(value) ? (value as number) : fallback);
  const counts = {
    correct: stored(detail?.correctAnswers, questions.filter((q) => q.verdict === "correct").length),
    wrong: stored(detail?.incorrectAnswers, questions.filter((q) => q.verdict === "wrong").length),
    blank: stored(detail?.unansweredQuestions, questions.filter((q) => q.verdict === "blank").length),
    flagged: questions.filter((q) => flagged.has(q._id)).length,
  };
  const estimate =
    finished && detail?.listeningResult && detail?.readingResult
      ? estimateToeicScore(detail.listeningResult, detail.readingResult)
      : null;
  const submitted = detail?.submittedAt || detail?.completedAt || detail?.createdAt;
  const seconds = detail?.activeSeconds ?? detail?.durationSpent;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-slate-50 p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-base">{text("Chi tiết bài làm", "Attempt details")}</DialogTitle>
          <DialogDescription className="sr-only">
            {text("Kết quả và câu trả lời của học viên.", "The learner's results and answers.")}
          </DialogDescription>
          {detail && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <UserNameLink
                userId={user?._id || (typeof detail.userId === "string" ? detail.userId : null)}
                name={user?.username || user?.email}
              />
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">{typeof detail.examId === "object" && detail.examId?.name}</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {detail.mode === "TEST" ? text("Thi thử", "Test") : detail.mode === "PRACTICE" ? text("Luyện tập", "Practice") : "—"}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  finished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
                )}
              >
                {t(`detailPage.attemptStatus_${detail.status}`)}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-slate-600">
              <Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin" />
              {text("Đang tải bài làm…", "Loading attempt…")}
            </div>
          ) : query.isError || !detail ? (
            <div role="alert" className="m-6 space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              <p>{text("Không tải được bài làm. Vui lòng thử lại.", "Could not load attempt. Please retry.")}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>{text("Thử lại", "Retry")}</Button>
            </div>
          ) : (
            <div className="space-y-4 p-4 sm:p-6">
              {/* Summary */}
              <section className="grid gap-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {estimate ? text("Điểm TOEIC ước tính", "Estimated TOEIC score") : text("Câu đúng", "Correct")}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                    {estimate ? estimate.total : finished ? `${detail.correctAnswers ?? 0}/${detail.totalQuestions}` : "—"}
                    {estimate && <span className="text-base font-medium text-slate-400">/{estimate.max}</span>}
                  </p>
                  {estimate && (
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {text("Nghe", "Listening")} {estimate.listening ?? "—"} · {text("Đọc", "Reading")} {estimate.reading ?? "—"}
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    [text("Đúng", "Correct"), finished ? counts.correct : "—", "text-emerald-700"],
                    [text("Sai", "Wrong"), finished ? counts.wrong : "—", "text-red-600"],
                    [text("Bỏ trống", "Blank"), counts.blank, "text-slate-700"],
                    [text("Đánh dấu", "Flagged"), counts.flagged, "text-amber-700"],
                    [text("Thời gian làm", "Active time"), formatDuration(seconds), "text-slate-900"],
                    [
                      text("Nộp lúc", "Submitted"),
                      submitted ? new Date(submitted).toLocaleString(en ? "en-US" : "vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—",
                      "text-slate-900",
                    ],
                  ].map(([label, value, tone]) => (
                    <div key={label as string} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
                      <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone as string)}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {!finished && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {text(
                    "Bài làm chưa hoàn tất. Câu trả lời hiện tại chưa phải kết quả cuối cùng.",
                    "This attempt is unfinished. Current answers are not final results.",
                  )}
                </p>
              )}

              {/* Per-part results */}
              {finished && !!detail.partResults?.length && (
                <section aria-label={text("Kết quả theo Part", "Results by part")} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {detail.partResults.map((r) => {
                    const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
                    return (
                      <button
                        key={r.part}
                        type="button"
                        aria-pressed={part === r.part}
                        onClick={() => setPart(part === r.part ? "ALL" : r.part)}
                        className={cn(
                          "rounded-lg border bg-white px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                          part === r.part ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-slate-700">Part {r.part}</span>
                          <span className="text-[11px] tabular-nums text-slate-500">{pct}%</span>
                        </div>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                          {r.correct}/{r.total}
                        </p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full", pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </section>
              )}

              {legacyAnswers && (
                <p role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {text(
                    "Lượt làm này được lưu trước khi chuyển dữ liệu: câu trả lời gắn với mã câu hỏi cũ nên không ghép được với nội dung đề. Điểm và kết quả theo Part ở trên là kết quả đã chấm lúc nộp bài; không xem được học viên chọn gì ở từng câu.",
                    "This attempt predates the data migration: its answers use old question IDs and cannot be matched to the saved exam. The score and part results above were graded at submission; per-question choices are unavailable.",
                  )}
                </p>
              )}
              {!detail.hasSnapshot || !questions.length ? (
                <p role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {text(
                    "Lượt làm bài cũ không có bản đề lưu kèm. Chỉ có thể xem kết quả tổng hợp, không thể khôi phục chính xác nội dung từng câu.",
                    "This legacy attempt has no saved question snapshot. Only its summary is available; exact question content cannot be restored.",
                  )}
                </p>
              ) : (
                <section className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                  {/* Answer sheet */}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 lg:sticky lg:top-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-700">{text("Phiếu đáp án", "Answer sheet")}</h3>
                      <select
                        aria-label={text("Phần thi", "Part")}
                        value={part}
                        onChange={(e) => setPart(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <option value="ALL">{text("Tất cả Part", "All parts")}</option>
                        {parts.map((value) => (
                          <option key={value} value={value}>Part {value}</option>
                        ))}
                      </select>
                    </div>
                    <div role="group" aria-label={text("Lọc câu", "Filter")} className="flex flex-wrap gap-1">
                      {([
                        ["ALL", text("Tất cả", "All"), questions.length],
                        ...(finished && !legacyAnswers
                          ? ([
                              ["wrong", text("Sai", "Wrong"), counts.wrong],
                              ["correct", text("Đúng", "Correct"), counts.correct],
                            ] as const)
                          : []),
                        ...(legacyAnswers ? [] : ([["blank", text("Bỏ trống", "Blank"), counts.blank]] as const)),
                        ["flagged", text("Đánh dấu", "Flagged"), counts.flagged],
                      ] as const).map(([value, label, count]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={filter === value}
                          onClick={() => setFilter(value)}
                          className={cn(
                            "h-7 rounded-md px-2 text-[11px] font-semibold transition-colors",
                            filter === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                          )}
                        >
                          {label} <span className="tabular-nums opacity-70">{count}</span>
                        </button>
                      ))}
                    </div>
                    {visible.length ? (
                      <div className="grid max-h-[22rem] grid-cols-6 gap-1 overflow-y-auto pr-1 sm:grid-cols-10 lg:grid-cols-6">
                        {visible.map((q) => (
                          <button
                            key={q._id}
                            type="button"
                            onClick={() => setSelectedId(q._id)}
                            aria-current={selected?._id === q._id ? "true" : undefined}
                            aria-label={`${text("Câu", "Question")} ${q.number}`}
                            className={cn(
                              "relative h-8 rounded-md border text-xs font-semibold tabular-nums outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500",
                              VERDICT_STYLE[q.verdict],
                              selected?._id === q._id && "ring-2 ring-slate-900 ring-offset-1",
                            )}
                          >
                            {q.number}
                            {flagged.has(q._id) && (
                              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="py-6 text-center text-xs text-slate-500">{text("Không có câu nào.", "No questions.")}</p>
                    )}
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      {finished && (
                        <>
                          <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-emerald-300 bg-emerald-50" />{text("Đúng", "Correct")}</li>
                          <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-red-300 bg-red-50" />{text("Sai", "Wrong")}</li>
                        </>
                      )}
                      {!legacyAnswers && (
                        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-slate-200 bg-white" />{text("Bỏ trống", "Blank")}</li>
                      )}
                      <li className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />{text("Đánh dấu", "Flagged")}</li>
                    </ul>
                  </div>

                  {/* Selected question */}
                  {selected && (
                    <article className="min-w-0 rounded-xl border border-slate-200 bg-white">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold tabular-nums text-slate-900">
                            {text("Câu", "Question")} {selected.number}
                          </h3>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">Part {selected.part}</span>
                          {flagged.has(selected._id) && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              <Flag aria-hidden="true" className="size-3" />
                              {text("Đã đánh dấu", "Flagged")}
                            </span>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                              selected.verdict === "correct"
                                ? "bg-emerald-50 text-emerald-700"
                                : selected.verdict === "wrong"
                                  ? "bg-red-50 text-red-700"
                                  : selected.verdict === "pending"
                                    ? "bg-blue-50 text-blue-700"
                                    : selected.verdict === "unknown"
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {selected.verdict === "correct" && <Check aria-hidden="true" className="size-3" />}
                            {selected.verdict === "wrong" && <X aria-hidden="true" className="size-3" />}
                            {selected.verdict === "correct"
                              ? text("Đúng", "Correct")
                              : selected.verdict === "wrong"
                                ? text("Sai", "Wrong")
                                : selected.verdict === "pending"
                                  ? text("Đã trả lời · chưa chấm", "Answered · not graded")
                                  : selected.verdict === "unknown"
                                    ? text("Không có dữ liệu câu trả lời", "Answer unavailable")
                                    : text("Bỏ trống", "Unanswered")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="mr-1 text-xs tabular-nums text-slate-500">
                            {position + 1}/{visible.length}
                          </span>
                          <Button type="button" variant="outline" size="icon" className="size-8" disabled={position <= 0} onClick={() => go(-1)} aria-label={text("Câu trước", "Previous")}>
                            <ChevronLeft className="size-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="size-8" disabled={position < 0 || position >= visible.length - 1} onClick={() => go(1)} aria-label={text("Câu sau", "Next")}>
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </header>

                      <div className="space-y-4 p-4">
                        {!!selected.passages?.length && (
                          <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                            {selected.passages.map((passage, index) => (
                              <div key={index} className="space-y-2">
                                <AttemptText value={passage.content} />
                                <QuestionMedia imageUrl={passage.imageUrl} audioUrl={passage.audioUrl} label={text("Bài đọc / bài nghe", "Passage")} en={en} />
                              </div>
                            ))}
                          </div>
                        )}
                        <QuestionMedia imageUrl={selected.imageUrl} audioUrl={selected.audioUrl} label={`${text("Câu", "Question")} ${selected.number}`} en={en} />
                        {selected.content && <AttemptText value={selected.content} className="font-medium text-slate-900" />}

                        <ul className="space-y-2">
                          {selected.options.map((option) => {
                            const isCorrect = option.key === selected.correctAnswer;
                            const isChosen = option.key === selected.answer;
                            return (
                              <li
                                key={option.key}
                                className={cn(
                                  "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                                  isCorrect ? "border-emerald-300 bg-emerald-50/60" : isChosen ? "border-red-300 bg-red-50/60" : "border-slate-200",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                    isCorrect ? "bg-emerald-600 text-white" : isChosen ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  {option.key}
                                </span>
                                <div className="min-w-0 flex-1">
                                  {option.text?.trim() ? (
                                    <AttemptText value={option.text} />
                                  ) : (
                                    <p className="text-sm italic text-slate-400">{text("(Phương án được đọc trong audio)", "(Choice is spoken in the audio)")}</p>
                                  )}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold">
                                  {isChosen && <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>{text("Học viên chọn", "Learner's choice")}</span>}
                                  {isCorrect && <span className="text-emerald-700">{text("Đáp án đúng", "Correct answer")}</span>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {(selected.explanation || selected.transcript) && (
                          <div className="space-y-2">
                            {selected.explanation && (
                              <details className="rounded-lg bg-slate-50 p-3" open>
                                <summary className="cursor-pointer text-sm font-semibold text-slate-700">{text("Giải thích đáp án", "Explanation")}</summary>
                                <div className="mt-2"><AttemptText value={selected.explanation} /></div>
                              </details>
                            )}
                            {selected.transcript && (
                              <details className="rounded-lg bg-slate-50 p-3">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Transcript</summary>
                                <div className="mt-2"><AttemptText value={selected.transcript} /></div>
                              </details>
                            )}
                          </div>
                        )}
                        <p className="hidden text-[11px] text-slate-400 lg:block">
                          {text("Mẹo: dùng phím ← → để chuyển câu.", "Tip: use ← → to move between questions.")}
                        </p>
                      </div>
                    </article>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
