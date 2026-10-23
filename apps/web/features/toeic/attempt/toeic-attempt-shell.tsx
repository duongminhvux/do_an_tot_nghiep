"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Headphones,
  LayoutGrid,
  LockKeyhole,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tones } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { useToeicAttempt } from "./use-toeic-attempt";
import { groupByPassage } from "./group-by-passage";
import { QuestionMedia, ToeicQuestion } from "./toeic-question";
import { ToeicAudioPolicyProvider } from "./toeic-audio-policy";
import { TestCountdown } from "./test-countdown";

function ElapsedTime({ start, end }: { start: string; end?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (end) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [end]);
  const seconds = Math.max(
    0,
    Math.floor(
      ((end ? new Date(end).getTime() : now) - new Date(start).getTime()) /
        1000,
    ),
  );
  return (
    <span className="tabular-nums">
      {String(Math.floor(seconds / 3600)).padStart(2, "0")}:
      {String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

export function ToeicAttemptShell() {
  const { attemptId, locale } = useParams<{
    attemptId: string;
    locale: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation("toeic");
  const state = useToeicAttempt(attemptId);
  const { attempt } = state;
  const [confirm, setConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [scrollTarget, setScrollTarget] = useState<{ id: string } | null>(null);
  const current =
    attempt?.questions[attempt.currentQuestionIndex] || attempt?.questions[0];

  useEffect(() => {
    if (!scrollTarget) return;
    document
      .getElementById(`question-${scrollTarget.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [scrollTarget, current?.part]);

  // Finished attempts are graded on the dedicated result page, which also
  // hosts the answer review; leave the session as soon as it is known.
  useEffect(() => {
    if (attempt?.status === "FINISHED")
      router.replace(`/${locale}/toeic/attempts/${attemptId}/result`);
  }, [attempt?.status, attemptId, locale, router]);

  if (state.loading)
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-slate-500">
        <p className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-blue-600" />
          {t("attempt.loading")}
        </p>
      </div>
    );
  if (!attempt)
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p role="alert" className="text-sm text-red-700">
            {t("attempt.load_error")}
          </p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/toeic/history`}>{t("attempt.history")}</Link>
          </Button>
        </div>
      </div>
    );

  const finished = attempt.status === "FINISHED";
  if (finished)
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-slate-500">
        <p className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-blue-600" />
          {t("attempt.opening_result")}
        </p>
      </div>
    );
  const restrictedAudio = attempt.mode === "TEST";
  const locked = attempt.status !== "IN_PROGRESS";
  const busy = state.checking || state.submitting;
  const answered = attempt.questions.filter((q) =>
    Boolean(attempt.answers[q._id]),
  ).length;
  const progress = attempt.totalQuestions
    ? Math.round((answered / attempt.totalQuestions) * 100)
    : 0;
  const activeQuestions = attempt.questions.filter(
    (q) => q.part === current?.part,
  );
  const goTo = (index: number) => {
    const question = attempt.questions[index];
    if (!question || busy) return;
    state.goToQuestion(index);
    setScrollTarget({ id: question._id });
    setMobilePaletteOpen(false);
  };
  // Out of time: close any dialog and submit; retry while another request
  // (e.g. a pending answer save) still holds the attempt.
  const submitOnTimeUp = async () => {
    setConfirm(false);
    setTimeUp(true);
    for (let tries = 0; tries < 5; tries++) {
      if (await state.submitAttempt()) return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    window.location.reload();
  };
  const submitLabel = t(
    attempt.mode === "PRACTICE" ? "attempt.finish_practice" : "attempt.submit",
  );

  const palette = (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <h2 className="text-sm font-semibold text-slate-800">
            {t("attempt.progress")}
          </h2>
          <span>
            {answered}/{attempt.totalQuestions} ({progress}%)
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("attempt.progress")}
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={attempt.totalQuestions}
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {attempt.selectedParts.map((part) => {
        const questions = attempt.questions
          .map((question, index) => ({ question, index }))
          .filter(({ question }) => question.part === part);
        return (
          <section key={part} className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-600">
              Part {part}{" "}
              <span className="text-slate-400">({questions.length})</span>
            </h3>
            <nav aria-label={`Part ${part}`} className="grid grid-cols-5 gap-2">
              {questions.map(({ question: q, index }) => {
                const flagged = attempt.flaggedQuestions.includes(q._id);
                const selected = current?._id === q._id;
                return (
                  <button
                    key={q._id}
                    type="button"
                    disabled={busy}
                    aria-current={selected ? "step" : undefined}
                    aria-label={`${t("attempt.question")} ${index + 1}${flagged ? ` · ${t("attempt.flag")}` : ""}`}
                    onClick={() => goTo(index)}
                    className={cn(
                      "relative flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50",
                      flagged
                        ? "bg-amber-400 text-white"
                        : attempt.answers[q._id]
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                      selected && "ring-2 ring-blue-600 ring-offset-2",
                    )}
                  >
                    {index + 1}
                    {flagged && (
                      <Flag
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 size-3 fill-amber-500 text-amber-600"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </section>
        );
      })}
      <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-blue-600" />
          {t("attempt.answered_label")} ({answered})
        </p>
        <p className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-slate-100 ring-1 ring-inset ring-slate-200" />
          {t("attempt.unanswered_label")} ({attempt.totalQuestions - answered})
        </p>
        <p className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-amber-400" />
          {t("attempt.flag")} ({attempt.flaggedQuestions.length})
        </p>
        <p className="flex items-center gap-2">
          <span className="size-3 rounded-sm ring-2 ring-blue-600" />
          {t("attempt.current_question")}
        </p>
      </div>
    </div>
  );

  return (
    <ToeicAudioPolicyProvider
      value={{
        restricted: restrictedAudio,
        disabled: locked || busy,
        counts: attempt.audioPlayCounts ?? {},
        requestPlay: state.playAudio,
      }}
    >
      <main className="flex h-dvh flex-col overflow-hidden bg-background text-slate-800">
        <header className="z-20 shrink-0 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild variant="outline" size="icon" className="size-9 shrink-0">
                <Link href={`/${locale}/toeic`} aria-label={t("attempt.exit")}>
                  <ArrowLeft />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-slate-900">
                  {t("attempt.exam_title")}{" "}
                  <span className="ml-1 text-xs font-medium text-slate-400">
                    · {attempt.mode}
                  </span>
                </h1>
                <p
                  aria-live="polite"
                  className={`mt-0.5 flex items-center gap-1 text-xs ${state.error ? "text-amber-600" : "text-slate-400"}`}
                >
                  {state.saving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : !state.error ? (
                    <Check className="size-3" />
                  ) : null}
                  {t(
                    state.saving
                      ? "attempt.saving"
                      : state.error
                        ? "attempt.save_error"
                        : "attempt.saved",
                  )}
                </p>
              </div>
            </div>
            <div
              title={t(attempt.expiresAt ? "attempt.time_left" : "attempt.time")}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold"
            >
              <Clock3 className="size-4 text-slate-500" />
              <span className="sr-only">
                {t(attempt.expiresAt ? "attempt.time_left" : "attempt.time")}:{" "}
              </span>
              {attempt.expiresAt && !locked ? (
                <TestCountdown
                  deadline={attempt.expiresAt}
                  onExpire={() => void submitOnTimeUp()}
                />
              ) : (
                <ElapsedTime
                  start={attempt.startedAt}
                  end={attempt.submittedAt}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {!restrictedAudio && (
                <label className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus-within:ring-2 focus-within:ring-blue-500/30">
                  <Headphones className="size-4" />
                  <span className="sr-only">{t("attempt.audio_speed")}</span>
                  <select
                    aria-label={t("attempt.audio_speed")}
                    value={playbackRate}
                    onChange={(event) =>
                      setPlaybackRate(Number(event.target.value))
                    }
                    className="max-w-16 cursor-pointer bg-transparent outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}x
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!locked && (
                <Button disabled={busy} onClick={() => setConfirm(true)}>
                  {submitLabel}
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="hidden border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
              >
                <Link href={`/${locale}/toeic/history`}>{t("attempt.exit")}</Link>
              </Button>
            </div>
          </div>
          {!finished && (
            <nav
              aria-label={t("attempt.parts")}
              className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:px-5"
            >
              {attempt.selectedParts.map((part) => {
                const questions = attempt.questions.filter(
                  (q) => q.part === part,
                );
                const partAnswered = questions.filter(
                  (q) => attempt.answers[q._id],
                ).length;
                const active = current?.part === part;
                const Icon = part <= 4 ? Headphones : BookOpen;
                return (
                  <button
                    key={part}
                    disabled={busy || !questions.length}
                    aria-current={active ? "page" : undefined}
                    onClick={() =>
                      goTo(attempt.questions.findIndex((q) => q.part === part))
                    }
                    className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
                  >
                    <Icon className="size-3.5" />P{part}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}
                    >
                      {partAnswered}/{questions.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </header>

        {state.error && (
          <div
            role="alert"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <p>{t("attempt.save_error")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void state.flush().catch(() => {})}
            >
              {t("attempt.retry")}
            </Button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          <div
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
            id="exam-scroll-container"
          >
            {!finished && current && (
              <div className="mx-auto w-full max-w-[1600px] space-y-8 p-4 pb-24 lg:p-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className={cn("flex size-10 items-center justify-center rounded-xl", tones.blue)}>
                    {current.part <= 4 ? (
                      <Headphones className="size-5" />
                    ) : (
                      <BookOpen className="size-5" />
                    )}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Part {current.part}{" "}
                      <span className="font-normal text-slate-400">
                        · {t(`structure.part${current.part}`)}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t("attempt.part_questions", {
                        count: activeQuestions.length,
                      })}
                    </p>
                  </div>
                </div>
                {current.part <= 4 &&
                  activeQuestions.every(
                    (q) =>
                      !q.audioUrl &&
                      !q.passages.some((passage) => passage.audioUrl),
                  ) && (
                    <p
                      role="status"
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                    >
                      {t("attempt.audio_missing")}
                    </p>
                  )}
                {groupByPassage(activeQuestions, (q) => q.passageGroupId).map((group) => {
                  const first = group[0]!;
                  const shared = Boolean(first.passageGroupId);
                  const hasVisualContext = Boolean(
                    first.imageUrl ||
                    first.passages.some(
                      (passage) =>
                        passage.imageUrl ||
                        (first.part >= 5 && passage.content),
                    ),
                  );
                  const hasContext = Boolean(
                    first.imageUrl ||
                    first.passages.some(
                      (passage) =>
                        passage.imageUrl ||
                        passage.audioUrl ||
                        (first.part >= 5 && passage.content),
                    ) ||
                    (shared && first.audioUrl),
                  );
                  return (
                    <section
                      key={first._id}
                      aria-labelledby={
                        shared ? `passage-group-${first._id}` : undefined
                      }
                      className={
                        shared
                          ? "space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                          : undefined
                      }
                    >
                      {shared && (
                        <h3
                          id={`passage-group-${first._id}`}
                          className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-700"
                        >
                          {t("attempt.passage_questions", {
                            from: attempt.questions.indexOf(first) + 1,
                            to:
                              attempt.questions.indexOf(
                                group[group.length - 1]!,
                              ) + 1,
                          })}
                        </h3>
                      )}
                      <div
                        className={
                          hasVisualContext
                            ? "grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] 2xl:gap-8"
                            : "space-y-6"
                        }
                      >
                        {hasContext && (
                          <div
                            className={`min-w-0 space-y-4 ${
                              !hasVisualContext
                                ? ""
                                : shared
                                  ? // Long shared passages scroll inside their own column.
                                    "xl:sticky xl:top-4 xl:max-h-[calc(100dvh-240px)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
                                  : // A single photo + audio (Part 1) must stay fully visible.
                                    "xl:sticky xl:top-4 xl:self-start"
                            }`}
                          >
                            <QuestionMedia
                              imageUrl={first.imageUrl}
                              audioUrl={first.audioUrl}
                              playbackRate={playbackRate}
                              audioIdentity={{ questionId: first._id }}
                            />
                            {first.passages.map((passage, index) => (
                              <div
                                key={passage._id ?? index}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                              >
                                <QuestionMedia
                                  {...passage}
                                  content={
                                    first.part <= 4
                                      ? undefined
                                      : passage.content
                                  }
                                  playbackRate={playbackRate}
                                  audioIdentity={{
                                    questionId: first._id,
                                    passageId: passage._id,
                                    ...(passage._id
                                      ? {}
                                      : {
                                          passageIndex: index,
                                          passageGroupId: first.passageGroupId,
                                        }),
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          className={`min-w-0 space-y-5 ${shared && hasVisualContext ? "xl:pt-8" : ""}`}
                        >
                          {group.map((question) => {
                            const index = attempt.questions.indexOf(question);
                            const flagged = attempt.flaggedQuestions.includes(
                              question._id,
                            );
                            const feedback = state.feedback[question._id];
                            return (
                              <article
                                id={`question-${question._id}`}
                                key={question._id}
                                className={`scroll-mt-4 space-y-4 rounded-xl border p-4 transition-colors ${current._id === question._id ? "border-blue-200 bg-blue-50/40 ring-1 ring-blue-200" : "border-slate-200 bg-white"}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-slate-900">
                                    {t("attempt.question")} {index + 1}
                                  </h3>
                                  {!locked && (
                                    <button
                                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${flagged ? "bg-amber-50 text-amber-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                                      aria-pressed={flagged}
                                      disabled={busy}
                                      onClick={() =>
                                        state.toggleFlag(question._id)
                                      }
                                    >
                                      <Flag
                                        className={`size-3.5 ${flagged ? "fill-current" : ""}`}
                                      />
                                      {t("attempt.flag")}
                                    </button>
                                  )}
                                </div>
                                <ToeicQuestion
                                  question={
                                    hasContext
                                      ? {
                                          ...question,
                                          imageUrl: undefined,
                                          passages: [],
                                          audioUrl:
                                            question.audioUrl === first.audioUrl
                                              ? undefined
                                              : question.audioUrl,
                                        }
                                      : question
                                  }
                                  answer={attempt.answers[question._id]}
                                  disabled={
                                    locked ||
                                    busy ||
                                    (attempt.mode === "PRACTICE" &&
                                      Boolean(feedback))
                                  }
                                  feedback={feedback}
                                  playbackRate={playbackRate}
                                  onAnswer={(answer) => {
                                    state.goToQuestion(index);
                                    state.selectAnswer(question._id, answer);
                                  }}
                                />
                                {!locked && attempt.mode === "PRACTICE" && !feedback && (
                                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={busy || !attempt.answers[question._id]}
                                      onClick={() => void state.checkAnswer(question._id)}
                                    >
                                      {state.checkingQuestionId === question._id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                      {t(state.checkingQuestionId === question._id ? "attempt.checking" : "attempt.check")}
                                    </Button>
                                    <p className="flex-1 text-xs leading-5 text-slate-500">{t("attempt.reveal_hint")}</p>
                                  </div>
                                )}
                                {!locked && attempt.mode === "PRACTICE" && feedback && (
                                  <p className="flex items-center gap-2 text-xs text-slate-500">
                                    <LockKeyhole className="size-3.5 shrink-0" />
                                    {t("attempt.answer_locked")}
                                  </p>
                                )}
                                {!locked && attempt.mode === "TEST" &&
                                  attempt.answers[question._id] &&
                                  !feedback && (
                                    <p className="text-xs text-slate-400">
                                      {t("attempt.answer_changeable")}
                                    </p>
                                  )}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
          {!finished && (
            <>
              {paletteOpen && (
                <aside
                  aria-label={t("attempt.questions")}
                  className="hidden w-64 shrink-0 overflow-y-auto overscroll-contain border-l border-slate-200 bg-white lg:block"
                >
                  {palette}
                </aside>
              )}
              <button
                className={`absolute top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer rounded-l-lg border border-r-0 border-slate-200 bg-white px-1 py-3 text-slate-500 shadow-sm hover:bg-slate-50 hover:text-blue-600 lg:block ${paletteOpen ? "right-64" : "right-0"}`}
                aria-label={t(
                  paletteOpen
                    ? "attempt.hide_questions"
                    : "attempt.show_questions",
                )}
                aria-expanded={paletteOpen}
                onClick={() => setPaletteOpen((value) => !value)}
              >
                {paletteOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
              </button>
              <button
                className="absolute bottom-5 right-4 flex size-12 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 lg:hidden"
                aria-label={t("attempt.show_questions")}
                onClick={() => setMobilePaletteOpen(true)}
              >
                <LayoutGrid className="size-5" />
              </button>
            </>
          )}
        </div>
        {!finished && current && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-6">
            <Button
              variant="outline"
              disabled={attempt.currentQuestionIndex === 0 || busy}
              onClick={() => goTo(attempt.currentQuestionIndex - 1)}
            >
              <ChevronLeft />
              {t("attempt.previous")}
            </Button>
            <span className="text-xs text-slate-500">
              {t("attempt.question")}{" "}
              <strong className="text-slate-700">
                {attempt.currentQuestionIndex + 1}
              </strong>{" "}
              / {attempt.totalQuestions}
            </span>
            <Button
              variant="outline"
              disabled={
                attempt.currentQuestionIndex >= attempt.questions.length - 1 ||
                busy
              }
              onClick={() => goTo(attempt.currentQuestionIndex + 1)}
            >
              {t("attempt.next")}
              <ChevronRight />
            </Button>
          </footer>
        )}

        <Dialog open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
          <DialogContent
            className="max-h-[80dvh] overflow-y-auto rounded-2xl p-0 pt-6"
            closeLabel={t("attempt.continue")}
          >
            <DialogTitle className="px-4">{t("attempt.questions")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("attempt.show_questions")}
            </DialogDescription>
            {palette}
          </DialogContent>
        </Dialog>
        <Dialog open={timeUp}>
          <DialogContent
            showCloseButton={false}
            className="rounded-2xl border-slate-200"
          >
            <DialogTitle>{t("attempt.time_up_title")}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {t("attempt.time_up_desc")}
            </DialogDescription>
          </DialogContent>
        </Dialog>
        <Dialog
          open={confirm}
          onOpenChange={(open) => {
            if (!state.submitting) setConfirm(open);
          }}
        >
          <DialogContent
            closeLabel={t("attempt.continue")}
            showCloseButton={!state.submitting}
            className="rounded-2xl border-slate-200"
          >
            <DialogTitle>{t("attempt.confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("attempt.unanswered", {
                count: attempt.totalQuestions - answered,
              })}
            </DialogDescription>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="flex items-center justify-between">
                <span>{t("attempt.answered_label")}</span>
                <strong className="text-blue-600">
                  {answered}/{attempt.totalQuestions}
                </strong>
              </p>
              <p className="flex items-center justify-between">
                <span>{t("attempt.flag")}</span>
                <strong className="text-amber-600">
                  {attempt.flaggedQuestions.length}
                </strong>
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={state.submitting}
                onClick={() => setConfirm(false)}
              >
                {t("attempt.continue")}
              </Button>
              <Button
                disabled={state.submitting}
                onClick={async () => {
                  if (await state.submitAttempt()) setConfirm(false);
                }}
              >
                {state.submitting && <Loader2 className="animate-spin" />}
                {state.submitting ? t("attempt.submitting") : submitLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </ToeicAudioPolicyProvider>
  );
}
