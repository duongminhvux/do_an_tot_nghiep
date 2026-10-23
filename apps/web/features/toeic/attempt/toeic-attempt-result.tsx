"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Headphones,
  History,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  toeicAttemptService,
  type AnswerFeedback,
  type AttemptQuestion,
  type ExamMode,
} from "@/services/toeic-attempt.service";
import { toeicService, type RawToeicResult } from "@/services/toeic.service";
import { dateLocale, formatDuration } from "@/features/toeic/format";
import { estimateToeicScore } from "@/features/toeic/score";
import { useToeicAttempt } from "./use-toeic-attempt";
import { groupByPassage } from "./group-by-passage";
import { QuestionMedia, ToeicQuestion } from "./toeic-question";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  Panel,
  Segmented,
  Tabs,
  surface,
  tones,
} from "@/components/ui/page";
import { cn } from "@/lib/utils";

// Parts scoring below this accuracy are suggested for more practice.
const WEAK_PART_ACCURACY = 70;

type ReviewStatus = "correct" | "incorrect" | "unanswered";
type ReviewFilter = ReviewStatus | "all";

interface ReviewRow {
  question: AttemptQuestion;
  index: number;
  answer?: string;
  status: ReviewStatus;
}

const statusCell: Record<ReviewStatus, string> = {
  correct: "border-emerald-500 bg-emerald-500 text-white",
  incorrect: "border-red-400 bg-red-400 text-white",
  unanswered: "border-slate-300 bg-white text-slate-500",
};

// Fallback when an older attempt was graded without per-section results.
function statsOf(items: ReviewRow[]): RawToeicResult {
  const total = items.length;
  const answered = items.filter((row) => row.status !== "unanswered").length;
  const correct = items.filter((row) => row.status === "correct").length;
  return {
    total,
    answered,
    correct,
    incorrect: answered - correct,
    unanswered: total - answered,
    accuracy: total ? Math.round((correct / total) * 10000) / 100 : 0,
  };
}

function ScoreRing({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-36 shrink-0">
      <svg aria-hidden="true" viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-slate-100" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-blue-600"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
          <p className="text-xs font-semibold text-slate-400">/ {max}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SectionBox({
  title,
  icon: Icon,
  tone,
  score,
  result,
}: {
  title: string;
  icon: LucideIcon;
  tone: "blue" | "emerald";
  score: number | null;
  result: RawToeicResult;
}) {
  const { t } = useTranslation("toeic");
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {score ?? result.correct}
        {score != null && <span className="text-sm font-semibold text-slate-400"> / 495</span>}
      </p>
      <p className="text-xs text-slate-500">
        {t("result.correct_count", { correct: result.correct, total: result.total })} ·{" "}
        {result.accuracy}%
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: ReviewStatus;
  labels: Record<ReviewStatus, string>;
}) {
  const tone = status === "correct" ? "emerald" : status === "incorrect" ? "red" : "slate";
  const Icon = status === "correct" ? Check : status === "incorrect" ? X : Clock3;
  return (
    <Badge tone={tone}>
      <Icon className="size-3" />
      {labels[status]}
    </Badge>
  );
}

export function ToeicAttemptResult() {
  const { attemptId, locale } = useParams<{
    attemptId: string;
    locale: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation("toeic");
  const state = useToeicAttempt(attemptId);
  const attempt = state.attempt;
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [activePart, setActivePart] = useState<number | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<"retry" | "weak" | null>(null);
  const [retryError, setRetryError] = useState(false);
  const reviewRef = useRef<HTMLElement | null>(null);

  // The attempt can hold either a plain id or the legacy exam snapshot.
  const examRef = attempt?.examId as unknown as
    | string
    | { _id?: string; name?: string }
    | null;
  const examId =
    typeof examRef === "object" && examRef ? (examRef._id ?? "") : examRef ?? "";
  const examNameFromAttempt =
    typeof examRef === "object" && examRef ? examRef.name : undefined;
  const examQuery = useQuery({
    queryKey: ["toeic-exam", examId],
    queryFn: () => toeicService.getExamById(examId),
    enabled: Boolean(examId),
  });

  useEffect(() => {
    if (!scrollTarget) return;
    document
      .getElementById(`result-question-${scrollTarget}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTarget(null);
  }, [scrollTarget, filter, activePart]);

  const labels: Record<ReviewStatus, string> = {
    correct: t("result.status_correct"),
    incorrect: t("result.status_incorrect"),
    unanswered: t("result.status_unanswered"),
  };

  if (state.loading)
    return (
      <PageShell>
        <LoadingState className="min-h-[60vh]" label={t("attempt.loading")} />
      </PageShell>
    );
  if (!attempt || state.error)
    return (
      <PageShell width="narrow">
        <PageHeader
          back={{ href: `/${locale}/toeic/history`, label: t("attempt.history") }}
          title={t("result.page_title")}
        />
        <ErrorState
          message={t("attempt.load_error")}
          onRetry={() => window.location.reload()}
          retryLabel={t("attempt.retry")}
        />
      </PageShell>
    );

  const finished = attempt.status === "FINISHED";
  const inProgress = attempt.status === "IN_PROGRESS";

  if (!finished)
    return (
      <PageShell width="narrow">
        <PageHeader
          back={{ href: `/${locale}/toeic/history`, label: t("result.back") }}
          title={t("result.page_title")}
        />
        <EmptyState
          icon={Clock3}
          title={t("result.not_finished_title")}
          description={t("result.not_finished_desc")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {inProgress && (
                <Button asChild>
                  <Link href={`/${locale}/toeic/attempts/${attemptId}`}>
                    {t("result.continue_attempt")}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={`/${locale}/toeic/history`}>
                  <History />
                  {t("attempt.history")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/toeic`}>
                  <BookOpen />
                  {t("result.btn_new_exam")}
                </Link>
              </Button>
            </div>
          }
        />
      </PageShell>
    );

  const total = attempt.totalQuestions || attempt.questions.length;
  const correct = attempt.correctAnswers ?? 0;
  const dateLabel = new Date(attempt.submittedAt || attempt.startedAt).toLocaleString(
    dateLocale(locale),
  );

  const rows: ReviewRow[] = attempt.questions.map((question, index) => {
    const answer = attempt.answers[question._id];
    const status: ReviewStatus = !answer
      ? "unanswered"
      : answer === question.correctAnswer
        ? "correct"
        : "incorrect";
    return { question, index, answer, status };
  });
  const counts = {
    correct: rows.filter((row) => row.status === "correct").length,
    incorrect: rows.filter((row) => row.status === "incorrect").length,
    unanswered: rows.filter((row) => row.status === "unanswered").length,
  };
  const listeningResult =
    attempt.listeningResult ?? statsOf(rows.filter((r) => r.question.part <= 4));
  const readingResult =
    attempt.readingResult ?? statsOf(rows.filter((r) => r.question.part >= 5));
  const partResults = attempt.partResults?.length
    ? attempt.partResults
    : attempt.selectedParts.map((part) => ({
        part,
        ...statsOf(rows.filter((row) => row.question.part === part)),
      }));
  // Practice sessions keep the raw count; full tests get the estimated scale.
  const score =
    attempt.mode === "TEST" ? estimateToeicScore(listeningResult, readingResult) : null;
  const weakParts = partResults.filter((p) => p.total && p.accuracy < WEAK_PART_ACCURACY);

  const parts = [...new Set(rows.map((row) => row.question.part))].sort((a, b) => a - b);
  const reviewPart = activePart ?? parts[0] ?? null;
  const visibleRows = rows.filter(
    (row) =>
      (reviewPart == null || row.question.part === reviewPart) &&
      (filter === "all" || row.status === filter),
  );
  const groups = groupByPassage(visibleRows, (row) => row.question.passageGroupId);

  const chips: { key: ReviewFilter; label: string }[] = [
    { key: "all", label: t("result.filter_all") },
    { key: "correct", label: t("result.filter_correct") },
    { key: "incorrect", label: t("result.filter_incorrect") },
    { key: "unanswered", label: t("result.filter_unanswered") },
  ];

  const examName =
    examNameFromAttempt || examQuery.data?.data?.name || t("attempt.exam_title");

  async function startAttempt(kind: "retry" | "weak", mode: ExamMode, selectedParts: number[]) {
    if (retrying || !examId) return;
    setRetrying(kind);
    setRetryError(false);
    try {
      const created = await toeicAttemptService.create(examId, mode, selectedParts);
      router.push(`/${locale}/toeic/attempts/${created._id}`);
    } catch {
      setRetryError(true);
      setRetrying(null);
    }
  }

  function jumpTo(row: ReviewRow) {
    setActivePart(row.question.part);
    setFilter("all");
    setScrollTarget(row.question._id);
  }

  return (
    <PageShell>
        <PageHeader
          back={{ href: `/${locale}/toeic/history`, label: t("result.back") }}
          title={t("result.page_title")}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-700">{examName}</span>
              <span>
                {t(attempt.mode === "TEST" ? "history.badge_test" : "history.badge_practice")} ·{" "}
                {t("history.parts", { parts: attempt.selectedParts.join(", ") })}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {dateLabel}
              </span>
            </span>
          }
        />

        {retryError && <ErrorState message={t("result.retry_error")} />}

        {/* Score */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col items-center gap-5">
            {score ? (
              <ScoreRing value={score.total} max={score.max} label={t("result.total_score")} />
            ) : (
              <ScoreRing value={correct} max={total} label={t("result.score_suffix")} />
            )}
            <div
              className={`grid w-full gap-3 ${
                listeningResult.total > 0 && readingResult.total > 0
                  ? "max-w-2xl sm:grid-cols-2"
                  : "max-w-sm"
              }`}
            >
              {listeningResult.total > 0 && (
                <SectionBox
                  title="Listening"
                  icon={Headphones}
                  tone="blue"
                  score={score?.listening ?? null}
                  result={listeningResult}
                />
              )}
              {readingResult.total > 0 && (
                <SectionBox
                  title="Reading"
                  icon={BookOpen}
                  tone="emerald"
                  score={score?.reading ?? null}
                  result={readingResult}
                />
              )}
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" />
                {t("result.duration_label", { value: formatDuration(attempt.durationSpent, t) })}
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="size-3.5" /> {counts.correct} {t("result.legend_correct")}
              </span>
              <span className="inline-flex items-center gap-1 text-red-600">
                <X className="size-3.5" /> {counts.incorrect} {t("result.legend_incorrect")}
              </span>
              <span className="inline-flex items-center gap-1">
                {counts.unanswered} {t("result.legend_unanswered")}
              </span>
            </p>
            {score && (
              <p className="text-center text-[11px] text-slate-400">{t("history.estimated_hint")}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <ListChecks />
                {t("result.btn_review")}
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(retrying) || !examId}
                onClick={() => void startAttempt("retry", attempt.mode, attempt.selectedParts)}
              >
                {retrying === "retry" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {retrying === "retry" ? t("result.retrying") : t("result.btn_retry")}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/toeic`}>
                  <BookOpen />
                  {t("result.btn_new_exam")}
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Per part */}
        <Panel title={t("result.part_results")}>
          <ul className="space-y-3">
            {partResults.map((result) => {
              const width = result.total ? (result.correct / result.total) * 100 : 0;
              return (
                <li
                  key={result.part}
                  className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[64px_200px_minmax(0,1fr)_auto]"
                >
                  <span className="font-semibold text-slate-800">Part {result.part}</span>
                  <span className="hidden truncate text-xs text-slate-500 sm:block">
                    {t(`structure.part${result.part}`)}
                  </span>
                  <div
                    role="progressbar"
                    aria-label={`Part ${result.part}`}
                    aria-valuemin={0}
                    aria-valuemax={result.total || 100}
                    aria-valuenow={result.correct}
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className={`h-full rounded-full ${result.accuracy < WEAK_PART_ACCURACY ? "bg-amber-400" : "bg-blue-600"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs tabular-nums text-slate-600">
                    <b className="text-slate-900">{result.correct}/{result.total}</b> · {Math.round(result.accuracy)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Weak points & suggestions */}
        <section className="grid gap-6 md:grid-cols-2">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Target className="size-4 text-amber-500" /> {t("result.weak_title")}
              </span>
            }
          >
            {weakParts.length ? (
              <div className="flex flex-wrap gap-2">
                {weakParts.map((p) => (
                  <Badge key={p.part} tone="amber">
                    Part {p.part} · {t(`structure.part${p.part}`)} · {Math.round(p.accuracy)}%
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("result.weak_empty")}</p>
            )}
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <Lightbulb className="size-4 text-blue-600" /> {t("result.suggest_title")}
              </span>
            }
          >
            <div className="space-y-2">
              {weakParts.length > 0 && (
                <button
                  type="button"
                  disabled={Boolean(retrying) || !examId}
                  onClick={() =>
                    void startAttempt("weak", "PRACTICE", weakParts.map((p) => p.part))
                  }
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones.emerald)}>
                    {retrying === "weak" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {t("result.suggest_practice", {
                        parts: weakParts.map((p) => `Part ${p.part}`).join(", "),
                      })}
                    </span>
                    <span className="block text-xs text-slate-500">{t("result.suggest_practice_desc")}</span>
                  </span>
                  <ChevronRight className="size-4 text-slate-300" />
                </button>
              )}
              <Link
                href={`/${locale}/vocabulary`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones.violet)}>
                  <BookOpen className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{t("result.suggest_vocab")}</span>
                  <span className="block text-xs text-slate-500">{t("result.suggest_vocab_desc")}</span>
                </span>
                <ChevronRight className="size-4 text-slate-300" />
              </Link>
            </div>
          </Panel>
        </section>

        {/* Question map */}
        <Panel title={t("result.map_title")} description={t("result.jump_hint")}>
          <div className="space-y-4">
            {parts.map((part) => {
              const partRows = rows.filter((row) => row.question.part === part);
              return (
                <div key={part}>
                  <p className="mb-2 text-xs font-semibold text-slate-600">
                    Part {part}{" "}
                    <span className="font-normal text-slate-400">
                      ({t("result.questions_count", { count: partRows.length })})
                    </span>
                  </p>
                  <nav aria-label={`Part ${part}`} className="flex flex-wrap gap-1.5">
                    {partRows.map((row) => (
                      <button
                        key={row.question._id}
                        type="button"
                        aria-label={`${t("attempt.question")} ${row.index + 1} · ${labels[row.status]}`}
                        onClick={() => jumpTo(row)}
                        className={`flex size-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${statusCell[row.status]}`}
                      >
                        {row.index + 1}
                      </button>
                    ))}
                  </nav>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {(["correct", "incorrect", "unanswered"] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-sm border ${statusCell[status]}`} />
                {t(`result.legend_${status}`)} ({counts[status]})
              </span>
            ))}
          </div>
        </Panel>

        {/* Answer review */}
        <section id="review" ref={reviewRef} className={cn(surface, "scroll-mt-6 space-y-4 p-5 sm:p-6")}>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t("result.review_title")}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{t("result.review_desc")}</p>
          </div>

          {reviewPart != null && (
            <Tabs
              value={String(reviewPart)}
              onChange={(value) => setActivePart(Number(value))}
              items={parts.map((part) => ({ value: String(part), label: `Part ${part}` }))}
            />
          )}

          <Segmented
            value={filter}
            onChange={setFilter}
            className="max-w-full flex-wrap"
            items={chips.map((chip) => ({
              value: chip.key,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {chip.label}
                  <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {chip.key === "all"
                      ? rows.filter((r) => r.question.part === reviewPart).length
                      : rows.filter((r) => r.question.part === reviewPart && r.status === chip.key).length}
                  </span>
                </span>
              ),
            }))}
          />

          <div className="min-w-0 space-y-5">
            {visibleRows.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                {t("result.filter_empty")}
              </p>
            )}
            {groups.map((group) => {
              const first = group[0]!;
              const shared = Boolean(first.question.passageGroupId);
              const hasContext = Boolean(
                first.question.imageUrl ||
                  first.question.passages.some(
                    (passage) =>
                      passage.imageUrl ||
                      passage.audioUrl ||
                      (first.question.part >= 5 && passage.content),
                  ) ||
                  (shared && first.question.audioUrl),
              );
              return (
                <section
                  key={first.question._id}
                  className={
                    shared
                      ? "space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                      : "space-y-5"
                  }
                >
                  {shared && (
                    <h3 className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-700">
                      {t("attempt.passage_questions", {
                        from: first.index + 1,
                        to: group[group.length - 1]!.index + 1,
                      })}
                    </h3>
                  )}
                  {hasContext && (
                    <div className="min-w-0 space-y-4">
                      <QuestionMedia
                        imageUrl={first.question.imageUrl}
                        audioUrl={first.question.audioUrl}
                        audioIdentity={{ questionId: first.question._id }}
                      />
                      {first.question.passages.map((passage, index) => (
                        <div
                          key={passage._id ?? index}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <QuestionMedia
                            {...passage}
                            content={first.question.part <= 4 ? undefined : passage.content}
                            audioIdentity={{
                              questionId: first.question._id,
                              passageId: passage._id,
                              ...(passage._id
                                ? {}
                                : {
                                    passageIndex: index,
                                    passageGroupId: first.question.passageGroupId,
                                  }),
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Questions of one passage share its card, split by dividers. */}
                  <div
                    className={
                      shared
                        ? "min-w-0 divide-y divide-slate-100 border-t border-slate-100"
                        : "min-w-0 space-y-5"
                    }
                  >
                    {group.map((row) => {
                      const feedback: AnswerFeedback | undefined = row.question.correctAnswer
                        ? {
                            correct: row.status === "correct",
                            correctAnswer: row.question.correctAnswer,
                            explanation: row.question.explanation,
                            transcript: row.question.transcript,
                          }
                        : undefined;
                      return (
                        <article
                          id={`result-question-${row.question._id}`}
                          key={row.question._id}
                          className={
                            shared
                              ? "scroll-mt-6 space-y-4 py-5 last:pb-0"
                              : "scroll-mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                          }
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {t("attempt.question")} {row.index + 1}
                            </span>
                            <StatusBadge status={row.status} labels={labels} />
                          </div>
                          <ToeicQuestion
                            question={
                              hasContext
                                ? {
                                    ...row.question,
                                    imageUrl: undefined,
                                    passages: [],
                                    audioUrl:
                                      row.question.audioUrl === first.question.audioUrl
                                        ? undefined
                                        : row.question.audioUrl,
                                  }
                                : row.question
                            }
                            answer={row.answer}
                            disabled
                            feedback={feedback}
                            onAnswer={() => {}}
                          />
                          {!row.answer && (
                            <p className="text-sm font-medium text-slate-500">{t("result.no_answer")}</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
    </PageShell>
  );
}
