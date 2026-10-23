"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  toeicAttemptService as api,
  ToeicAttempt,
  AnswerFeedback,
  AudioIdentity,
} from "@/services/toeic-attempt.service";

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
  };
}
