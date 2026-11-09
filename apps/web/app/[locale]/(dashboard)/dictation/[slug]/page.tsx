"use client";

import { useTranslation } from "react-i18next";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dictationService } from "@/services/dictation.service";
import { savedWordsService } from "@/services/saved-words.service";
import {
  YoutubePlayer,
  type YoutubePlayerHandle,
} from "@repo/ui/youtube-player";
import {
  DictationStudio,
  type StudioShortcutAction,
} from "@repo/ui/dictation-studio";
import {
  DICTATION_SHORTCUT_ACTIONS,
  comboFromEvent,
  comboLabel,
  normalizeDictationSettings,
} from "@repo/shared-types/dictation-settings";
import { sentenceAtTime } from "@repo/ui/dictation-timeline";
import { dictationDictionaryEntry } from "@repo/ui/dictation-dictionary";
import type {
  DictationLessonDetail,
  DictationProgress,
} from "@/types/dictation";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
} from "@/components/ui/page";


function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function DictationPracticePage() {
  const { t } = useTranslation("dictation");
  const params = useParams();
  const requestedSegmentRaw = useSearchParams().get("segment");
  const requestedSegment =
    requestedSegmentRaw === null ? -1 : Number(requestedSegmentRaw);
  const locale = (params?.locale as string) || "vi";
  const slug = String(params?.slug || "");
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dictation-detail", slug],
    queryFn: () => dictationService.getBySlug(slug),
    enabled: Boolean(slug),
  });
  const lesson = unwrap<DictationLessonDetail>(data);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [tab, setTab] = useState<"dictation" | "transcript">("dictation");
  const [showTranscriptPrompt, setShowTranscriptPrompt] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  /** A single sentence is playing (dictation mode). */
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState<DictationProgress | null>(null);

  const lessonAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeRef = useRef<YoutubePlayerHandle>(null);
  const [grading, setGrading] = useState<{
    score: number;
    isCorrect: boolean;
    errors: number;
    totalWords: number;
  } | null>(null);
  const [checkError, setCheckError] = useState("");
  const legacyAudioRef = useRef<HTMLAudioElement | null>(null);
  const segmentEndMsRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = useMemo(() => lesson?.segments || [], [lesson?.segments]);
  const current = segments[currentIndex];
  const live = useRef({ index: currentIndex, answer, grading, showAnswer });
  live.current = { index: currentIndex, answer, grading, showAnswer };
  const drafts = useRef(
    new Map<
      number,
      { answer: string; grading: typeof grading; showAnswer: boolean }
    >(),
  );
  const completed = progress?.completedSegments || [];
  const revealed = progress?.revealedSegments || [];
  const currentSegmentProgress = progress?.segmentProgress?.find(
    (item) => item.segmentIndex === currentIndex,
  );
  // Admin "Cấu hình Dictation" settings, sent with the lesson (defaults when missing).
  const settings = useMemo(
    () => normalizeDictationSettings(lesson?.practiceSettings),
    [lesson?.practiceSettings],
  );
  const maxAttempts = settings.practice.maxAttemptsBeforeReveal;
  const autoNextDelay = settings.practice.autoNextDelayMs;
  const enabledShortcuts = useMemo(
    () =>
      DICTATION_SHORTCUT_ACTIONS.filter(
        (action) =>
          settings.shortcuts[action].enabled &&
          (action !== "reveal" || settings.practice.allowReveal),
      ).map((action) => ({
        action,
        key: settings.shortcuts[action].key,
        label: comboLabel(settings.shortcuts[action].key),
      })),
    [settings],
  );
  const resolveShortcut = useCallback(
    (event: KeyboardEvent): StudioShortcutAction | null => {
      const combo = comboFromEvent(event);
      return enabledShortcuts.find((item) => item.key === combo)?.action ?? null;
    },
    [enabledShortcuts],
  );
  const wrongAttempts = currentSegmentProgress?.wrongAttempts || 0;
  const currentIsCompleted = completed.includes(currentIndex);
  const handledCount = new Set([...(completed || []), ...(revealed || [])])
    .size;
  const percent = segments.length
    ? Math.round((handledCount / segments.length) * 100)
    : 0;

  useEffect(() => {
    if (!lesson) return;
    setProgress(lesson.progress || null);
    const nextIndex = lesson.progress?.completed
      ? 0
      : Math.min(
          lesson.progress?.currentSegment || 0,
          Math.max((lesson.segments?.length || 1) - 1, 0),
        );
    setCurrentIndex(
      Number.isInteger(requestedSegment) &&
        requestedSegment >= 0 &&
        requestedSegment < lesson.segments.length
        ? requestedSegment
        : nextIndex,
    );
  }, [lesson?._id, requestedSegment]);

  // Start each lesson with the admin defaults for speed and auto-play.
  useEffect(() => {
    if (!lesson?._id) return;
    setPlaybackRate(settings.playback.defaultSpeed);
    setAutoPlayNext(settings.practice.autoPlayNext);
  }, [lesson?._id, settings]);

  useEffect(
    () => () => {
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    },
    [],
  );

  const updateProgressCaches = (next: DictationProgress) => {
    setProgress(next);
    queryClient.invalidateQueries({ queryKey: ["dictation-topics"] });
    queryClient.invalidateQueries({ queryKey: ["dictation-topic"] });
    queryClient.invalidateQueries({
      queryKey: ["dictation-progress-overview"],
    });
  };

  const attemptMutation = useMutation({
    mutationFn: ({ index, answer }: { index: number; answer: string }) =>
      dictationService.checkAnswer(lesson._id, index, answer),
  });
  const revealMutation = useMutation({
    mutationFn: (index: number) =>
      dictationService.revealSegment(lesson._id, index),
  });
  const transcriptMutation = useMutation({
    mutationFn: () => dictationService.revealTranscript(lesson._id),
  });

  const goTo = useCallback(
    (index: number) => {
      if (!segments.length) return;
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
      const safe = Math.max(0, Math.min(index, segments.length - 1));
      const previous = live.current;
      drafts.current.set(previous.index, {
        answer: previous.answer,
        grading: previous.grading,
        showAnswer: previous.showAnswer,
      });
      const saved = drafts.current.get(safe);
      lessonAudioRef.current?.pause();
      youtubeRef.current?.pause();
      legacyAudioRef.current?.pause();
      segmentEndMsRef.current = null;
      setIsPlaying(false);
      setCurrentIndex(safe);
      setAnswer(saved?.answer || "");
      setGrading(saved?.grading || null);
      setCheckError("");
      setResult(null);
      const isRevealed = Boolean(
        progress?.revealedSegments?.includes(safe) ||
        progress?.segmentProgress?.find((item) => item.segmentIndex === safe)
          ?.revealed,
      );
      setShowAnswer(saved?.showAnswer || isRevealed);
      live.current = {
        index: safe,
        answer: saved?.answer || "",
        grading: saved?.grading || null,
        showAnswer: saved?.showAnswer || isRevealed,
      };
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [segments.length, progress],
  );

  const followVideo = (timeMs: number) => {
    const next = sentenceAtTime(segments, timeMs),
      previous = live.current;
    if (next < 0 || next === previous.index) return;
    drafts.current.set(previous.index, {
      answer: previous.answer,
      grading: previous.grading,
      showAnswer: previous.showAnswer,
    });
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    const saved = drafts.current.get(next),
      revealed = Boolean(progress?.revealedSegments?.includes(next));
    live.current = {
      index: next,
      answer: saved?.answer || "",
      grading: saved?.grading || null,
      showAnswer: saved?.showAnswer || revealed,
    };
    setCurrentIndex(next);
    setAnswer(saved?.answer || "");
    setGrading(saved?.grading || null);
    setShowAnswer(saved?.showAnswer || revealed);
    setCheckError("");
    setResult(null);
  };

  // Audio element wiring: stop at the end of the sentence being played.
  useEffect(() => {
    const audio = lessonAudioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      const endMs = segmentEndMsRef.current;
      if (endMs !== null && audio.currentTime * 1000 >= endMs) {
        audio.pause();
        segmentEndMsRef.current = null;
      }
    };
    const handlePlay = () => setIsPlaying(segmentEndMsRef.current !== null);
    const handlePause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [lesson?.fullAudioUrl]);

  useEffect(() => {
    if (lessonAudioRef.current) lessonAudioRef.current.playbackRate = playbackRate;
    if (legacyAudioRef.current) legacyAudioRef.current.playbackRate = playbackRate;
  }, [playbackRate, lesson?.fullAudioUrl]);

  const playCurrent = useCallback(
    (track = true) => {
      if (lesson?.youtubeVideoId && current) {
        youtubeRef.current?.play(current.startMs, current.endMs);
        if (track) void dictationService.recordReplay(lesson._id, currentIndex);
        return;
      }
      const hasUnifiedTiming =
        current?.startMs !== undefined &&
        current?.endMs !== undefined &&
        current.endMs > current.startMs;
      if (!hasUnifiedTiming && current?.audioUrl) {
        lessonAudioRef.current?.pause();
        youtubeRef.current?.pause();
        if (
          !legacyAudioRef.current ||
          legacyAudioRef.current.src !== current.audioUrl
        ) {
          legacyAudioRef.current?.pause();
          const legacy = new Audio(current.audioUrl);
          legacy.playbackRate = playbackRate;
          legacy.addEventListener("play", () => setIsPlaying(true));
          legacy.addEventListener("pause", () => setIsPlaying(false));
          legacy.addEventListener("ended", () => setIsPlaying(false));
          legacyAudioRef.current = legacy;
        }
        const legacy = legacyAudioRef.current;
        if (legacy.paused) {
          legacy.currentTime = 0;
          legacy.play().catch(() => setIsPlaying(false));
        } else legacy.pause();
        if (track && lesson?._id)
          dictationService
            .recordReplay(lesson._id, currentIndex)
            .catch(() => undefined);
        return;
      }

      const audio = lessonAudioRef.current;
      if (!audio || !lesson?.fullAudioUrl || !hasUnifiedTiming) return;
      legacyAudioRef.current?.pause();
      const sameSegmentPlaying =
        !audio.paused && segmentEndMsRef.current === current.endMs;
      if (sameSegmentPlaying) {
        audio.pause();
        return;
      }
      segmentEndMsRef.current = current.endMs;
      audio.currentTime = Math.max(0, current.startMs) / 1000;
      audio.playbackRate = playbackRate;
      audio.play().catch(() => {
        segmentEndMsRef.current = null;
        setIsPlaying(false);
      });
      if (track)
        dictationService
          .recordReplay(lesson._id, currentIndex)
          .catch(() => undefined);
    },
    [
      current,
      currentIndex,
      lesson?._id,
      lesson?.fullAudioUrl,
      lesson?.youtubeVideoId,
      playbackRate,
    ],
  );

  const playSegmentAtIndex = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (lesson?.youtubeVideoId && segment) {
        youtubeRef.current?.play(segment.startMs, segment.endMs);
        void dictationService.recordReplay(lesson._id, index);
        return;
      }
      const audio = lessonAudioRef.current;
      if (
        !segment ||
        !audio ||
        !lesson?.fullAudioUrl ||
        segment.endMs <= segment.startMs
      )
        return;
      segmentEndMsRef.current = segment.endMs;
      audio.currentTime = segment.startMs / 1000;
      audio.playbackRate = playbackRate;
      audio.play().catch(() => undefined);
      dictationService.recordReplay(lesson._id, index).catch(() => undefined);
    },
    [
      segments,
      lesson?._id,
      lesson?.fullAudioUrl,
      lesson?.youtubeVideoId,
      playbackRate,
    ],
  );

  const scheduleNext = useCallback(
    (fromIndex: number) => {
      if (
        !settings.practice.autoNextEnabled ||
        !autoPlayNext ||
        fromIndex >= segments.length - 1
      )
        return;
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = setTimeout(() => {
        goTo(fromIndex + 1);
        if (autoPlayNext)
          setTimeout(() => playSegmentAtIndex(fromIndex + 1), 160);
      }, autoNextDelay);
    },
    [
      segments.length,
      autoNextDelay,
      autoPlayNext,
      goTo,
      playSegmentAtIndex,
      settings.practice.autoNextEnabled,
    ],
  );

  const checkAnswer = useCallback(async () => {
    if (!current || !answer.trim() || attemptMutation.isPending || showAnswer)
      return;
    setCheckError("");
    try {
      const response = await attemptMutation.mutateAsync({
        index: currentIndex,
        answer,
      });
      const next = unwrap<DictationProgress>(response);
      const grade = unwrap<{
        grading: {
          score: number;
          isCorrect: boolean;
          errors: number;
          totalWords: number;
        };
      }>(response).grading;
      const correct = grade.isCorrect;
      if (live.current.index !== currentIndex) {
        drafts.current.set(currentIndex, {
          answer,
          grading: grade,
          showAnswer:
            correct || Boolean(next.revealedSegments?.includes(currentIndex)),
        });
        updateProgressCaches(next);
        return;
      }
      setGrading(grade);
      setResult(correct ? "correct" : "incorrect");
      updateProgressCaches(next);
      const state = next.segmentProgress?.find(
        (item) => item.segmentIndex === currentIndex,
      );
      if (correct) {
        setShowAnswer(true);
        scheduleNext(currentIndex);
      } else if (
        state?.revealed ||
        next.revealedSegments?.includes(currentIndex)
      ) {
        setShowAnswer(true);
        setTimeout(() => playCurrent(false), 180);
      } else {
        setTimeout(() => playCurrent(false), 180);
      }
    } catch {
      setCheckError("Chưa chấm được câu trả lời. Hãy thử lại.");
    }
  }, [
    answer,
    attemptMutation,
    current,
    currentIndex,
    playCurrent,
    scheduleNext,
    showAnswer,
  ]);

  const revealCurrent = useCallback(async () => {
    if (!current || revealMutation.isPending || showAnswer) return;
    try {
      const response = await revealMutation.mutateAsync(currentIndex);
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
      setShowAnswer(true);
      setResult("incorrect");
      setTimeout(() => playCurrent(false), 180);
    } catch {
      // no-op
    }
  }, [current, currentIndex, playCurrent, revealMutation, showAnswer]);

  const requestTranscript = useCallback(() => {
    if (!settings.transcript.enabled) return;
    if (progress?.transcriptRevealed || progress?.completed) {
      lessonAudioRef.current?.pause();
      youtubeRef.current?.pause();
      legacyAudioRef.current?.pause();
      setTab("transcript");
      return;
    }
    if (!settings.transcript.requireConfirm) {
      void confirmTranscript();
      return;
    }
    setShowTranscriptPrompt(true);
    // confirmTranscript is recreated every render; it only reads refs and mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.completed, progress?.transcriptRevealed, settings.transcript]);

  const confirmTranscript = async () => {
    try {
      const response = await transcriptMutation.mutateAsync();
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
    } finally {
      lessonAudioRef.current?.pause();
      youtubeRef.current?.pause();
      legacyAudioRef.current?.pause();
      setShowTranscriptPrompt(false);
      setTab("transcript");
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t("loading_lesson")} className="min-h-[60vh]" />
      </PageShell>
    );
  }
  if (isError || !lesson || !current) {
    return (
      <PageShell>
        <PageHeader
          back={{ href: `/${locale}/dictation`, label: t("all_topics") }}
          title="Dictation"
        />
        <ErrorState message={t("lesson_not_found")} />
      </PageShell>
    );
  }

  return (
    <>
      <audio
        ref={lessonAudioRef}
        src={lesson.fullAudioUrl || undefined}
        className="hidden"
      />
      <DictationStudio
        title={lesson.title}
        level={lesson.level}
        locale={locale}
        backHref={
          lesson.topicInfo
            ? `/${locale}/dictation/topic/${lesson.topicInfo.slug}`
            : `/${locale}/dictation`
        }
        segments={segments.map((segment) => ({
          id: segment._id,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
        }))}
        currentIndex={currentIndex}
        completed={completed}
        revealed={revealed}
        answer={answer}
        onAnswer={(value) => {
          setAnswer(value);
          if (result === "incorrect" && !showAnswer) setResult(null);
        }}
        answerRef={inputRef}
        onSelect={(index) => {
          goTo(index);
          playSegmentAtIndex(index);
        }}
        onPlay={() => playCurrent()}
        onPause={() => {
          lessonAudioRef.current?.pause();
          youtubeRef.current?.pause();
          legacyAudioRef.current?.pause();
          setIsPlaying(false);
        }}
        onCheck={() => void checkAnswer()}
        onReveal={() => void revealCurrent()}
        onHint={async () => {
          await dictationService.recordHint(lesson._id, currentIndex);
        }}
        onPronounce={(entry, accent) =>
          savedWordsService.pronunciation(entry.word, accent)
        }
        onLookup={async (value) => {
          const word = value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
          const found = (await savedWordsService.lookup(word)).data;
          return dictationDictionaryEntry(found, word);
        }}
        onSaveWord={async (entry) => {
          const note =
            `Dictation: ${lesson.title}\n${current?.text || ""}`.slice(0, 2000);
          await savedWordsService.savePersonal(
            entry.word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
            [note, entry.note].filter(Boolean).join("\n").slice(0, 2000),
            { ipa: entry.ipa, translation: entry.meanings.join("\n") },
          );
          void queryClient.invalidateQueries({ queryKey: ["saved-words"] });
        }}
        onTranscript={() => {
          if (tab === "transcript") setTab("dictation");
          else requestTranscript();
        }}
        transcriptVisible={tab === "transcript"}
        media={
          lesson.youtubeVideoId ? (
            <YoutubePlayer
              aspectRatio
              ref={youtubeRef}
              onTimeChange={followVideo}
              segments={segments}
              videoId={lesson.youtubeVideoId}
              playbackRate={playbackRate}
              onPlayingChange={setIsPlaying}
            />
          ) : undefined
        }
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onPlaybackRate={setPlaybackRate}
        autoPlayNext={autoPlayNext}
        onAutoPlayNext={setAutoPlayNext}
        showAnswer={showAnswer}
        pending={attemptMutation.isPending || revealMutation.isPending}
        grading={grading}
        error={checkError}
        wrongAttempts={wrongAttempts}
        maxAttempts={
          settings.practice.autoRevealEnabled ? maxAttempts : undefined
        }
        speeds={settings.playback.speeds}
        shortcuts={enabledShortcuts}
        resolveShortcut={resolveShortcut}
        showShortcutCard={settings.display.showShortcutCard}
        allowHint={settings.practice.allowHint}
        transcriptEnabled={settings.transcript.enabled}
        played={Boolean(
          progress?.segmentProgress?.some((s) => s.replayCount > 0),
        )}
      />
      {showTranscriptPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transcript-confirm-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"
        >
          <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 id="transcript-confirm-title" className="text-lg font-semibold">
              {t("view_transcript_title")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {t("transcript_help")}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm"
                onClick={() => setShowTranscriptPrompt(false)}
              >
                {t("continue_practice")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                disabled={transcriptMutation.isPending}
                onClick={() => void confirmTranscript()}
              >
                {t("view_transcript")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
