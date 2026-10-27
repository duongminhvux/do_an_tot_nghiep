"use client";

import { useArenaAudio } from "./use-arena-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { arenaSocket } from "@/lib/arena-socket";
import { arenaService } from "@/services/arena.service";
import type { RankedPlayer } from "./use-arena-controller";

type Question = {
  version?: number;
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
  version?: number;
  matchId: string;
  players: { userId: string; score: number }[];
};
type Finished = {
  version?: number;
  cancelled?: boolean;
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
type RankedSync = {
  matchId: string; version: number; status: 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'RESUMING' | 'FINISHED' | 'CANCELLED';
  serverNow: number; remainingMs: number; resumeAt: number | null;
  disconnected: { userId: string; deadlineAt: number | null }[];
  question: Question | null;
  players: { userId: string; score: number; streak: number }[];
  submitted?: { answer?: string; attempts?: number; earnedScore?: number } | null;
  resolved: { questionId: string; winnerId: string | null; timedOut: boolean; correctAnswer: string; explanation?: string; example?: string; translation?: string; type?: string } | null;
  history?: { questionId: string; order: number; correct: boolean }[];
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
    "WAITING" | "PLAYING" | "PAUSED" | "RESUMING" | "FINISHED"
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
  const [connectionState, setConnectionState] = useState<RankedSync | null>(null);
  const [connectionCountdown, setConnectionCountdown] = useState(0);
  const [syncing, setSyncing] = useState(!friendly);
  const versionRef = useRef(-1);
  const statusRef = useRef('WAITING');
  const clockOffsetRef = useRef(0);
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
  const lastSyncRef = useRef(0);
  const resolvedAtRef = useRef(0);
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
    resolvedAtRef.current = 0;
    setMatchStatus("WAITING");
    setCurrentQuestion(null);
    setFinalResult(null);
    setAnswer("");
    setResult(null);
    setHistory([]);
    setScore(0);
    setOpponentScore(0);
    setStreak(0);
    versionRef.current = -1;
    statusRef.current = 'WAITING';
    setConnectionState(null);
    setSyncing(!friendly);
    setSubmitting(false);

    const handleStart = (data: { matchId: string }) => {
      if (['PAUSED','RESUMING'].includes(statusRef.current)) return;
      if (data.matchId !== matchId || finishedRef.current) return;
      setMatchStatus("PLAYING");
      setError(null);
    };
    const handleQuestion = (data: Question, fromSync = false) => {
      if (!fromSync && (['PAUSED','RESUMING'].includes(statusRef.current) || (data.version !== undefined && data.version < versionRef.current))) return;
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
      if (previous && data.questionIndex < previous.questionIndex) return;
      // Snapshots can repeat the current question after reconnect or missed events.
      if (previous?.questionId === data.questionId) {
        const start = data.startedAt ? Date.parse(data.startedAt) : NaN;
        if (Number.isFinite(start)) deadlineRef.current = start+data.timeLimit*1000-clockOffsetRef.current;
        const letters = Array.from({ length: data.answerLength }, (_, index) => previous.letters?.[index] ?? data.letters?.[index] ?? null);
        questionRef.current = { ...previous, ...data, letters };
        setCurrentQuestion((current) => current?.questionId === data.questionId
          ? { ...current, ...data, letters: letters.map((letter,index) => current.letters?.[index] ?? letter) } : current);
        return;
      }
      questionRef.current = data;
      resolvedAtRef.current = 0;
      const serverStart = data.startedAt ? Date.parse(data.startedAt) : NaN;
      deadlineRef.current =
        (Number.isFinite(serverStart) ? serverStart : Date.now()) +
        data.timeLimit * 1000-clockOffsetRef.current;
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
      if (data.resolved) {
        answeredRef.current.add(data.questionId);
        resolvedAtRef.current ||= Date.now();
      }
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
      version?: number;
      matchId: string;
      questionId: string;
      letters: (string | null)[];
    }) => {
      if (['PAUSED','RESUMING'].includes(statusRef.current) || (data.version !== undefined && data.version < versionRef.current)) return;
      if (
        data.matchId !== matchId ||
        data.questionId !== questionRef.current?.questionId
      ) return;
      // Only reveal new letters; delayed hint packets must never hide a revealed letter.
      questionRef.current = { ...questionRef.current!, letters: data.letters.map((letter,index) => questionRef.current?.letters?.[index] ?? letter) };
      setCurrentQuestion((current) => current?.questionId === data.questionId
        ? { ...current, letters: data.letters.map((letter, index) =>
            current.letters?.[index] ?? letter) } : current);

    };
    const handleResolved = (data: {
      version?: number;
      matchId: string;
      questionId: string;
      winnerId: string | null;
      timedOut: boolean;
      correctAnswer: string;
      explanation?: string;
      example?: string;
      translation?: string;
      type?: string;
      players: { userId: string; score: number; streak: number; earnedScore?: number }[];
    }) => {
      if (data.version !== undefined && data.version < versionRef.current) return;
      if (
        data.matchId !== matchId ||
        data.questionId !== questionRef.current?.questionId
      ) return;
      const alreadyResolved = answeredRef.current.has(data.questionId);
      const me = data.players?.find(
        (player) => player.userId === currentUserId,
      );
      const other = data.players?.find(
        (player) => player.userId !== currentUserId,
      );
      if (me) { setScore(me.score); setStreak(me.streak); }
      if (other) setOpponentScore(other.score);
      if (alreadyResolved) return;
      handleAnswerResult({
        ...data,
        resolved: true,
        correct: data.winnerId === currentUserId,
        points: me?.earnedScore ?? 0,
        totalScore: me?.score ?? 0,
        streak: me?.streak ?? 0,
      });
    };
    const handleScore = (data: ScoreUpdate) => {
      if (data.version !== undefined && data.version < versionRef.current) return;
      if (data.matchId !== matchId || !Array.isArray(data.players)) return;
      const me = data.players.find((player) => player.userId === currentUserId);
      const other = data.players.find(
        (player) => player.userId !== currentUserId,
      );
      if (me) setScore(me.score);
      if (other) setOpponentScore(other.score);
    };
    const handleFinished = (data: Finished) => {
      if (data.version !== undefined && data.version < versionRef.current) return;
      if (
        data.matchId !== matchId ||
        !Array.isArray(data.players) ||
        finishedRef.current
      )
        return;
      finishedRef.current = true;
      statusRef.current = 'FINISHED';
      setSyncing(false);
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
    const handleSync = (data: RankedSync) => {
      if (friendly || data.matchId !== matchId || !Number.isInteger(data.version) || data.version < versionRef.current || finishedRef.current) return;
      versionRef.current = data.version;
      clockOffsetRef.current = data.serverNow-Date.now();
      if (data.question) handleQuestion(data.question, true);
      handleScore(data);
      const me = data.players.find(p => p.userId === currentUserId);
      if (me) setStreak(me.streak);
      if (data.history) {
        setHistory(data.history.reduce<boolean[]>((list, item) => { list[item.order-1] = item.correct; return list; }, []));
        for (const item of data.history) if (item.questionId !== data.resolved?.questionId) answeredRef.current.add(item.questionId);
      }
      if (data.submitted?.answer && !data.resolved) setAnswer(data.submitted.answer);
      if (data.resolved && data.question) handleResolved({ ...data.resolved, matchId, players: data.players.map(p => ({...p, earnedScore: p.userId === currentUserId ? (data.submitted?.earnedScore ?? 0) : 0})) });
      if (data.resolved) setResult(current => ({
        ...current, ...data.resolved, questionId: data.resolved!.questionId, matchId, resolved: true,
        correct: data.resolved!.winnerId === currentUserId,
        points: data.submitted?.earnedScore ?? current?.points ?? 0,
        totalScore: me?.score ?? 0, streak: me?.streak ?? 0,
      }));
      statusRef.current = data.status;
      setConnectionState(data);
      if (data.status === 'PAUSED' || data.status === 'RESUMING') {
        setMatchStatus(data.status);
        setTimeLeft(Math.max(0, Math.ceil(data.remainingMs/1000)));
        pendingRef.current = null; setSubmitting(false);
      } else if (data.status === 'PLAYING') {
        setMatchStatus('PLAYING');
        deadlineRef.current = Date.now()+data.remainingMs;
      }
      setSyncing(false);
      setError(null);
      arenaSocket.emit('arena:match-synced', { matchId, version: data.version });
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
      // Wait for arena:authenticated before rejoining the protected match room.
    };
    const handleDisconnect = () => {
      if (!friendly) setSyncing(true);
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
    arenaSocket.on('arena:match-sync', handleSync);
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
      arenaSocket.off('arena:match-sync', handleSync);
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
        (!friendly && (syncing || ['PAUSED','RESUMING'].includes(statusRef.current))) ||
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
    [matchId, friendly, syncing],
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

  // If an edge event is lost, request a server snapshot instead of getting
  // stuck on zero seconds or trying to resolve a round on the client.
  useEffect(() => {
    if (!connected || matchStatus !== "PLAYING" || !currentQuestion)
      return;
    const sync = () => {
      const expired = Date.now() >= deadlineRef.current + 1500;
      const missingNext = resolvedAtRef.current > 0 && Date.now() >= resolvedAtRef.current + 5000;
      if (!expired && !missingNext) return;
      if (Date.now() - lastSyncRef.current < 3000) return;
      lastSyncRef.current = Date.now();
      readyRef.current();
    };
    const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [connected, matchStatus, currentQuestion?.questionId, result?.resolved]);

  useEffect(() => {
    if (!connectionState || !['PAUSED','RESUMING'].includes(connectionState.status)) return;
    const tick = () => {
      const deadline = connectionState.status === 'RESUMING' ? connectionState.resumeAt : Math.min(...connectionState.disconnected.map(m => m.deadlineAt ?? Infinity));
      setConnectionCountdown(deadline && Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline-Date.now()-clockOffsetRef.current)/1000)) : 0);
    };
    tick(); const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [connectionState]);
  useEffect(() => {
    if (friendly || !connected || finishedRef.current) return;
    // Recover a missed pause/resume event even while the displayed timer is frozen.
    const timer = window.setInterval(() => readyRef.current(), 5000);
    return () => window.clearInterval(timer);
  }, [friendly, connected, matchId]);
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
    connectionState,
    connectionCountdown,
    syncing,
    currentQuestion,
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
