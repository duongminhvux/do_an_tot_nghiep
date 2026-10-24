"use client";

import { useArenaAudio } from "./use-arena-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { arenaSocket } from "@/lib/arena-socket";
import { arenaService } from "@/services/arena.service";
import type { RankedPlayer } from "./use-arena-controller";

type Question = {
  matchId: string;
  questionId: string;
  questionIndex: number;
  totalQuestions: number;
  meaning: string;
  answerLength: number;
  timeLimit: number;
  startedAt?: string;
  emoji?: string;
  image?: string;
  explanation?: string;
  example?: string;
  translation?: string;
  type?: string;
  letters?: (string | null)[];
};
type AnswerResult = {
  matchId: string;
  questionId: string;
  correct: boolean;
  resolved?: boolean;
  winnerId?: string | null;
  attemptId?: string;
  points: number;
  totalScore: number;
  streak: number;
  timedOut?: boolean;
  correctAnswer?: string;
  explanation?: string;
  example?: string;
  translation?: string;
  type?: string;
};
type ScoreUpdate = {
  matchId: string;
  players: { userId: string; score: number }[];
};
type Finished = {
  matchId: string;
  finishReason?: string;
  turnCount?: number;
  usedWords?: string[];
  requiredLetter?: string;
  startedAt?: string;
  finishedAt?: string;
  winnerId?: string | null;
  isDraw: boolean;
  players: {
    userId: string;
    score: number;
    ratingBefore?: number;
    ratingAfter?: number;
    ratingChange?: number;
  }[];
};
type Ack = {
  success?: boolean;
  status?: string;
  message?: string;
  answerResult?: AnswerResult;
};

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  )
    return value.message;
  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

export function useRankedMatch(
  matchId: string,
  currentUserId: string,
  friendly = false,
) {
  const { playAnswer: playAudioAnswer, audioEnabled } = useArenaAudio(matchId, currentUserId);
  const queryClient = useQueryClient();
  const [matchStatus, setMatchStatus] = useState<
    "WAITING" | "PLAYING" | "FINISHED"
  >("WAITING");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [history, setHistory] = useState<boolean[]>([]);
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [finalResult, setFinalResult] = useState<Finished | null>(null);
  const [connected, setConnected] = useState(arenaSocket.connected);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<RankedPlayer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<Question | null>(null);
  const pendingRef = useRef<string | null>(null);
  const lastAttemptRef = useRef<{
    questionId: string;
    answer: string;
    timedOut: boolean;
    attemptId: string;
  } | null>(null);
  const finishedRef = useRef(false);
  const answeredRef = useRef(new Set<string>());
  const deadlineRef = useRef(0);
  const readyRef = useRef<() => void>(() => {});
  const answerHandlerRef = useRef<(data: AnswerResult) => void>(() => {});
  const { data: profile } = useQuery({
    queryKey: ["arena-profile", currentUserId],
    queryFn: arenaService.getProfile,
    enabled: !!currentUserId && !friendly,
  });

  useEffect(() => {
    try {
      const cached = JSON.parse(
        sessionStorage.getItem("arena-ranked-match") || "null",
      );
      setOpponent(
        cached?.matchId === matchId &&
          typeof cached.opponent?.userId === "string"
          ? cached.opponent
          : null,
      );
    } catch {
      setOpponent(null);
    }
  }, [matchId]);

  useEffect(() => {
    let active = true;
    let readySequence = 0;
    questionRef.current = null;
    answeredRef.current.clear();
    pendingRef.current = null;
    lastAttemptRef.current = null;
    finishedRef.current = false;
    setMatchStatus("WAITING");
    setCurrentQuestion(null);
    setFinalResult(null);
    setAnswer("");
    setResult(null);
    setHistory([]);
    setScore(0);
    setOpponentScore(0);
    setStreak(0);
    setSubmitting(false);

    const handleStart = (data: { matchId: string }) => {
      if (data.matchId !== matchId || finishedRef.current) return;
      setMatchStatus("PLAYING");
      setError(null);
    };
    const handleQuestion = (data: Question) => {
      if (
        data.matchId !== matchId ||
        finishedRef.current ||
        !data.questionId ||
        data.questionIndex < 1 ||
        data.totalQuestions < data.questionIndex ||
        data.timeLimit <= 0
      )
        return;
      const previous = questionRef.current;
      if (
        previous &&
        (data.questionIndex < previous.questionIndex ||
          data.questionId === previous.questionId)
      )
        return;
      questionRef.current = data;
      const serverStart = data.startedAt ? Date.parse(data.startedAt) : NaN;
      deadlineRef.current =
        (Number.isFinite(serverStart) ? serverStart : Date.now()) +
        data.timeLimit * 1000;
      pendingRef.current = null;
      lastAttemptRef.current = null;
      setCurrentQuestion(data);
      setMatchStatus("PLAYING");
      setResult(null);
      setAnswer("");
      setSubmitting(false);
      setError(null);
      setTimeLeft(
        Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
      );
    };
    const handleAnswerResult = (data: AnswerResult) => {
      const question = questionRef.current;
      if (
        data.matchId !== matchId ||
        !question ||
        data.questionId !== question.questionId ||
        answeredRef.current.has(data.questionId)
      )
        return;
      if (
        data.attemptId &&
        data.attemptId !== lastAttemptRef.current?.attemptId
      )
        return;
      if (data.resolved) answeredRef.current.add(data.questionId);
      pendingRef.current = null;
      lastAttemptRef.current = null;
      setSubmitting(false);
      setError(null);
      playAudioAnswer(data.correct);
      setResult({ ...data, timedOut: data.timedOut ?? false });
      setScore(data.totalScore);
      setStreak(data.streak);
      if (!data.resolved) {
        setAnswer("");
        window.requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      setCurrentQuestion((current) =>
        current && current.questionId === data.questionId
          ? {
              ...current,
              explanation: data.explanation ?? current.explanation,
              example: data.example ?? current.example,
              translation: data.translation ?? current.translation,
              type: data.type ?? current.type,
            }
          : current,
      );
      setHistory((values) => {
        const next = [...values];
        next[question.questionIndex - 1] = data.correct;
        return next;
      });
    };
    const handleHint = (data: {
      matchId: string;
      questionId: string;
      letters: (string | null)[];
    }) => {
      if (
        data.matchId !== matchId ||
        data.questionId !== questionRef.current?.questionId ||
        answeredRef.current.has(data.questionId)
      )
        return;
      setCurrentQuestion((current) =>
        current ? { ...current, letters: data.letters } : current,
      );
    };
    const handleResolved = (data: {
      matchId: string;
      questionId: string;
      winnerId: string | null;
      timedOut: boolean;
      correctAnswer: string;
      explanation?: string;
      example?: string;
      translation?: string;
      type?: string;
      players: { userId: string; score: number; streak: number }[];
    }) => {
      if (
        data.matchId !== matchId ||
        data.questionId !== questionRef.current?.questionId ||
        answeredRef.current.has(data.questionId)
      )
        return;
      const me = data.players?.find(
        (player) => player.userId === currentUserId,
      );
      const other = data.players?.find(
        (player) => player.userId !== currentUserId,
      );
      if (other) setOpponentScore(other.score);
      handleAnswerResult({
        ...data,
        resolved: true,
        correct: data.winnerId === currentUserId,
        points: data.winnerId === currentUserId ? 100 : 0,
        totalScore: me?.score ?? 0,
        streak: me?.streak ?? 0,
      });
    };
    const handleScore = (data: ScoreUpdate) => {
      if (data.matchId !== matchId || !Array.isArray(data.players)) return;
      const me = data.players.find((player) => player.userId === currentUserId);
      const other = data.players.find(
        (player) => player.userId !== currentUserId,
      );
      if (me) setScore(me.score);
      if (other) setOpponentScore(other.score);
    };
    const handleFinished = (data: Finished) => {
      if (
        data.matchId !== matchId ||
        !Array.isArray(data.players) ||
        finishedRef.current
      )
        return;
      finishedRef.current = true;
      questionRef.current = null;
      pendingRef.current = null;
      setMatchStatus("FINISHED");
      setFinalResult(data);
      setCurrentQuestion(null);
      setSubmitting(false);
      setTimeLeft(0);
      setError(null);
      handleScore(data);
      void queryClient.invalidateQueries({
        queryKey: ["arena-profile", currentUserId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["arena-matches", currentUserId],
      });
      void queryClient.invalidateQueries({ queryKey: ["arena-leaderboard"] });
    };
    const handleException = (data: unknown) => {
      pendingRef.current = null;
      setSubmitting(false);
      setError(errorMessage(data));
    };
    const sendReady = () => {
      if (
        !active ||
        !currentUserId ||
        !arenaSocket.connected ||
        finishedRef.current
      )
        return;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          matchId,
        )
      ) {
        setError("Mã trận đấu không hợp lệ.");
        return;
      }
      const sequence = ++readySequence;
      setError(null);
      arenaSocket
        .timeout(10000)
        .emit(
          friendly ? "friend:join" : "match:ready",
          { matchId },
          (failure: Error | null, ack: Ack) => {
            if (
              !active ||
              sequence !== readySequence ||
              questionRef.current ||
              finishedRef.current
            )
              return;
            if (failure)
              setError("Máy chủ chưa phản hồi. Hãy thử kết nối lại.");
            else if (ack?.success === false)
              setError(ack.message || "Không thể vào trận đấu.");
          },
        );
    };
    const handleConnect = () => {
      setConnected(true);
      setError(null);
    };
    const handleDisconnect = () => {
      setConnected(false);
      pendingRef.current = null;
      setSubmitting(false);
      setError("Mất kết nối. Đang kết nối lại...");
    };
    const handleConnectError = () => {
      setConnected(false);
      setError("Không thể kết nối tới máy chủ trận đấu.");
    };
    arenaSocket.on("match:start", handleStart);
    arenaSocket.on("match:question", handleQuestion);
    arenaSocket.on("match:answer-result", handleAnswerResult);
    arenaSocket.on("match:hint", handleHint);
    arenaSocket.on("match:question-resolved", handleResolved);
    arenaSocket.on("match:score-update", handleScore);
    arenaSocket.on("match:finished", handleFinished);
    arenaSocket.on("friend:match-finished", handleFinished);
    if (friendly) arenaSocket.on("friend:snapshot", handleScore);
    arenaSocket.on("exception", handleException);
    arenaSocket.on("connect", handleConnect);
    arenaSocket.on("arena:authenticated", sendReady);
    arenaSocket.on("disconnect", handleDisconnect);
    arenaSocket.on("connect_error", handleConnectError);
    readyRef.current = sendReady;
    answerHandlerRef.current = handleAnswerResult;
    setConnected(arenaSocket.connected);
    if (arenaSocket.connected) sendReady();
    return () => {
      active = false;
      questionRef.current = null;
      readyRef.current = () => {};
      answerHandlerRef.current = () => {};
      arenaSocket.off("match:start", handleStart);
      arenaSocket.off("match:question", handleQuestion);
      arenaSocket.off("match:answer-result", handleAnswerResult);
      arenaSocket.off("match:hint", handleHint);
      arenaSocket.off("match:question-resolved", handleResolved);
      arenaSocket.off("match:score-update", handleScore);
      arenaSocket.off("match:finished", handleFinished);
      arenaSocket.off("friend:match-finished", handleFinished);
      arenaSocket.off("friend:snapshot", handleScore);
      arenaSocket.off("exception", handleException);
      arenaSocket.off("connect", handleConnect);
      arenaSocket.off("arena:authenticated", sendReady);
      arenaSocket.off("disconnect", handleDisconnect);
      arenaSocket.off("connect_error", handleConnectError);
    };
  }, [matchId, currentUserId, queryClient, friendly, playAudioAnswer]);

  const sendAnswer = useCallback(
    (value: string, timedOut = false) => {
      const question = questionRef.current;
      if (
        !question ||
        !arenaSocket.connected ||
        pendingRef.current ||
        answeredRef.current.has(question.questionId)
      )
        return;
      pendingRef.current = question.questionId;
      const attempt =
        lastAttemptRef.current?.questionId === question.questionId
          ? lastAttemptRef.current
          : {
              questionId: question.questionId,
              answer: value.trim(),
              timedOut,
              attemptId: crypto.randomUUID(),
            };
      lastAttemptRef.current = attempt;
      setSubmitting(true);
      setError(null);
      setResult(null);
      arenaSocket.timeout(10000).emit(
        "match:answer",
        {
          matchId,
          questionId: question.questionId,
          answer: attempt.answer,
          timedOut: attempt.timedOut,
          attemptId: attempt.attemptId,
        },
        (failure: Error | null, ack: Ack) => {
          if (
            questionRef.current?.questionId !== question.questionId ||
            answeredRef.current.has(question.questionId)
          )
            return;
          if (lastAttemptRef.current?.attemptId !== attempt.attemptId) return;
          if (ack?.answerResult) {
            answerHandlerRef.current(ack.answerResult);
            return;
          }
          if (failure || ack?.success === false) {
            pendingRef.current = null;
            setSubmitting(false);
            setError(
              failure
                ? "Chưa nhận được kết quả. Bạn có thể gửi lại đáp án."
                : ack.message || "Không thể gửi đáp án.",
            );
          }
        },
      );
    },
    [matchId],
  );

  useEffect(() => {
    if (!currentQuestion || result?.resolved || matchStatus !== "PLAYING")
      return;
    const tick = () =>
      setTimeLeft(
        Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)),
      );
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [currentQuestion?.questionId, result?.resolved, matchStatus]);

  useEffect(() => {
    if (currentQuestion && !result?.resolved && connected)
      inputRef.current?.focus();
  }, [currentQuestion?.questionId, result, connected]);

  const retryReady = () => {
    setError(null);
    if (!arenaSocket.connected) arenaSocket.connect();
    else readyRef.current();
  };
  const submitAnswer = () => {
    if (timeLeft <= 0 || !answer.trim() || matchStatus !== "PLAYING") return;
    sendAnswer(answer);
  };
  const retryAnswer = () => {
    const attempt = lastAttemptRef.current;
    if (attempt) sendAnswer(attempt.answer, attempt.timedOut);
  };
  return {
    playAudioAnswer,
    audioEnabled,
    matchStatus,
    currentQuestion: currentQuestion
      ? {
          ...currentQuestion,
          letters:
            timeLeft > 5 && timeLeft < 20
              ? currentQuestion.letters
              : currentQuestion.letters?.map((letter) =>
                  letter && /[\p{L}\p{N}]/u.test(letter) ? null : letter,
                ),
        }
      : null,
    answer,
    setAnswer,
    timeLeft,
    result,
    history,
    score,
    opponentScore,
    streak,
    finished: matchStatus === "FINISHED",
    finalResult,
    inputRef,
    connected,
    submitting,
    error,
    retryReady,
    retryAnswer,
    submitAnswer,
    opponent,
    myRating: profile?.data.rating,
  };
}
