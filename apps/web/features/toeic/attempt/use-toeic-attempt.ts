"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  toeicAttemptService as api,
  ToeicAttempt,
  AnswerFeedback,
  AudioIdentity,
  AttemptClock,
} from "@/services/toeic-attempt.service";

const HEARTBEAT_MS = 15_000;

/** Server clock plus the moment it was received, for local ticking. */
export interface ClockState extends AttemptClock {
  syncedAt: number;
}

// PRACTICE returns keys only for questions whose feedback was revealed.
function initialFeedback(attempt: ToeicAttempt) {
  const feedback: Record<string, AnswerFeedback> = {};
  if (attempt.mode !== "PRACTICE") return feedback;
  for (const q of attempt.questions) {
    const answer = attempt.answers[q._id];
    if (answer && q.correctAnswer)
      feedback[q._id] = {
        selectedAnswer: answer,
        correct: answer === q.correctAnswer,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        transcript: q.transcript,
      };
  }
  return feedback;
}

export function useToeicAttempt(id: string) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<ToeicAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingQuestionId, setCheckingQuestionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>({});
  const pending = useRef(new Map<string, string>());
  const progress = useRef<{
    flaggedQuestions: string[];
    currentQuestionIndex: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(attempt);
  const busy = useRef(false);
  const revealed = useRef<Record<string, AnswerFeedback>>({});
  const [clock, setClock] = useState<ClockState | null>(null);
  const [clockBusy, setClockBusy] = useState(false);
  // The learner pressed Pause: showing the page again must not resume.
  const manualPause = useRef(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const clockQueue = useRef<Promise<unknown>>(Promise.resolve());

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const work = queue.current
      .catch(() => {})
      .then(async () => {
        setSaving(true);
        try {
          for (const [questionId, answer] of pending.current) {
            await api.saveAnswer(id, questionId, answer);
            if (pending.current.get(questionId) === answer)
              pending.current.delete(questionId);
          }
          const value = progress.current;
          if (value) {
            await api.progress(id, value);
            if (progress.current === value) progress.current = null;
          }
          setError(false);
        } catch (e) {
          setError(true);
          throw e;
        } finally {
          setSaving(false);
        }
      });
    queue.current = work;
    return work;
  }, [id]);

  const schedule = () => {
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 650);
  };

  useEffect(() => {
    let active = true;
    api
      .get(id)
      .then((value) => {
        if (!active) return;
        latest.current = value;
        setAttempt(value);
        const restored = initialFeedback(value);
        revealed.current = restored;
        setFeedback(restored);
        setError(false);
        if (value.status === "IN_PROGRESS")
          setClock({
            status: value.status,
            activeSeconds: value.activeSeconds,
            remainingSeconds: value.remainingSeconds,
            paused: true,
            syncedAt: Date.now(),
          });
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current.size || progress.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      active = false;
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      // flush reads the latest queue and makes no request when it is empty.
      void flush().catch(() => {});
    };
  }, [id, flush]);

  // Clock requests run one at a time so a pause never overtakes a resume.
  const runClock = useCallback(
    (request: () => Promise<AttemptClock>) => {
      const work = clockQueue.current
        .catch(() => {})
        .then(request)
        .then(async (next) => {
          setClock({ ...next, syncedAt: Date.now() });
          // A timed attempt that ran out was graded by the server.
          if (next.status !== "IN_PROGRESS") {
            const value = await api.get(id);
            latest.current = value;
            setAttempt(value);
          }
          return next;
        });
      clockQueue.current = work;
      return work;
    },
    [id],
  );

  const inProgress = attempt?.status === "IN_PROGRESS";
  useEffect(() => {
    if (!inProgress) return;
    const visible = () => document.visibilityState === "visible";
    const start = () => {
      if (!manualPause.current && visible())
        void runClock(() => api.resume(id)).catch(() => {});
    };
    const stop = (keepalive: boolean) =>
      void runClock(() => api.pause(id, { keepalive })).catch(() => {});
    const onVisibility = () => {
      if (visible()) start();
      else {
        void flush().catch(() => {});
        stop(true);
      }
    };
    const onPageHide = () => stop(true);
    start();
    const beat = setInterval(() => {
      if (!manualPause.current && visible())
        void runClock(() => api.heartbeat(id)).catch(() => {});
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // Leaving the attempt page (in-app navigation) stops the clock; a
      // submitted attempt has nothing left to pause.
      if (latest.current?.status === "IN_PROGRESS") stop(true);
      // Lists elsewhere (exam page, history) must show the attempt as unfinished.
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("toeic-"),
      });
    };
  }, [id, inProgress, flush, runClock, queryClient]);

  async function pauseAttempt() {
    if (manualPause.current) return;
    manualPause.current = true;
    setPausedByUser(true);
    setClockBusy(true);
    try {
      await flush().catch(() => {});
      await runClock(() => api.pause(id));
    } catch {
      setError(true);
    } finally {
      setClockBusy(false);
    }
  }

  async function resumeAttempt() {
    setClockBusy(true);
    try {
      await runClock(() => api.resume(id));
      manualPause.current = false;
      setPausedByUser(false);
    } catch {
      setError(true);
    } finally {
      setClockBusy(false);
    }
  }

  function change(update: (value: ToeicAttempt) => ToeicAttempt) {
    if (
      !latest.current ||
      latest.current.status !== "IN_PROGRESS" ||
      busy.current
    )
      return;
    const next = update(latest.current);
    latest.current = next;
    setAttempt(next);
    progress.current = {
      flaggedQuestions: next.flaggedQuestions,
      currentQuestionIndex: next.currentQuestionIndex,
    };
    schedule();
  }

  // Choices stay editable until feedback is revealed or the attempt is locked.
  function selectAnswer(questionId: string, answer: string) {
    const value = latest.current;
    if (busy.current || value?.status !== "IN_PROGRESS") return;
    if (value.mode === "PRACTICE" && revealed.current[questionId]) return;
    if (value.answers[questionId] === answer) return;
    pending.current.set(questionId, answer);
    change((current) => ({
      ...current,
      answers: { ...current.answers, [questionId]: answer },
    }));
  }

  function goToQuestion(index: number) {
    if (latest.current?.status !== "IN_PROGRESS") {
      setAttempt((value) =>
        value ? { ...value, currentQuestionIndex: index } : value,
      );
      return;
    }
    change((value) => ({
      ...value,
      currentQuestionIndex: Math.max(
        0,
        Math.min(value.questions.length - 1, index),
      ),
    }));
  }

  function toggleFlag(questionId: string) {
    change((value) => ({
      ...value,
      flaggedQuestions: value.flaggedQuestions.includes(questionId)
        ? value.flaggedQuestions.filter((id) => id !== questionId)
        : [...value.flaggedQuestions, questionId],
    }));
  }

  async function checkAnswer(questionId: string) {
    if (busy.current || latest.current?.mode !== "PRACTICE") return;
    busy.current = true;
    setChecking(true);
    setCheckingQuestionId(questionId);
    try {
      await flush();
      const result = await api.check(id, questionId);
      revealed.current = { ...revealed.current, [questionId]: result };
      const value = latest.current;
      if (value && result.selectedAnswer) {
        const next = { ...value, answers: { ...value.answers, [questionId]: result.selectedAnswer } };
        latest.current = next;
        setAttempt(next);
      }
      setFeedback((value) => ({ ...value, [questionId]: result }));
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setChecking(false);
      setCheckingQuestionId(null);
    }
  }

  async function submitAttempt() {
    if (busy.current) return false;
    busy.current = true;
    setSubmitting(true);
    try {
      await flush();
      const result = await api.submit(id);
      latest.current = result;
      setAttempt(result);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("toeic-"),
      });
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  async function playAudio(identity: AudioIdentity) {
    if (busy.current || latest.current?.status !== "IN_PROGRESS")
      throw new Error("Attempt is locked");
    const result = await api.playAudio(id, identity);
    // A play request must not replace answers/progress edited while it was pending.
    const value = latest.current;
    if (value) {
      const next = {
        ...value,
        audioPlayCounts: {
          ...value.audioPlayCounts,
          [result.key]: Math.max(
            value.audioPlayCounts?.[result.key] ?? 0,
            result.used,
          ),
        },
      };
      latest.current = next;
      setAttempt(next);
    }
    return result.used;
  }

  return {
    attempt,
    loading,
    error,
    saving,
    submitting,
    checking,
    checkingQuestionId,
    feedback,
    flush,
    selectAnswer,
    goToQuestion,
    toggleFlag,
    checkAnswer,
    submitAttempt,
    playAudio,
    clock,
    clockBusy,
    pausedByUser,
    pauseAttempt,
    resumeAttempt,
  };
}
