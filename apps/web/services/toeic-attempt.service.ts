import { isAxiosError } from "axios";
import apiClient from "@/lib/axios";
import type { RawToeicResult } from "./toeic.service";

export type ExamMode = "TEST" | "PRACTICE";
export interface AudioIdentity {
  questionId: string;
  passageId?: string;
  passageIndex?: number;
  passageGroupId?: string;
}
export function audioPlayKey(identity: AudioIdentity) {
  return identity.passageId
    ? `passage_${identity.passageId}`
    : identity.passageIndex !== undefined
      ? `group_${identity.passageGroupId || identity.questionId}_${identity.passageIndex}`
      : `question_${identity.questionId}`;
}
export interface AnswerFeedback {
  selectedAnswer?: string;
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
  transcript?: string;
}
export interface AttemptQuestion {
  _id: string;
  part: number;
  content: string;
  options: { key: string; text: string }[];
  audioUrl?: string;
  imageUrl?: string;
  passageGroupId?: string;
  passages: {
    _id?: string;
    content?: string;
    imageUrl?: string;
    audioUrl?: string;
  }[];
  correctAnswer?: string;
  explanation?: string;
  transcript?: string;
}
export interface ToeicAttempt {
  _id: string;
  examId: string;
  mode: ExamMode;
  selectedParts: number[];
  status: "IN_PROGRESS" | "FINISHED" | "ABANDONED";
  startedAt: string;
  submittedAt?: string;
  /** Projected deadline at the last resume; use remainingSeconds instead. */
  expiresAt?: string;
  timeLimitSeconds?: number;
  /** Time spent on the attempt page; time away from it does not count. */
  activeSeconds?: number;
  /** Timed attempts only. */
  remainingSeconds?: number;
  paused?: boolean;
  score?: number;
  scoreMax?: number;
  listeningScore?: number;
  readingScore?: number;
  questions: AttemptQuestion[];
  answers: Record<string, string>;
  audioPlayCounts: Record<string, number>;
  flaggedQuestions: string[];
  currentQuestionIndex: number;
  totalQuestions: number;
  correctAnswers: number;
  answeredQuestions?: number;
  partResults?: (RawToeicResult & { part: number })[];
  incorrectAnswers?: number;
  unansweredQuestions?: number;
  accuracy?: number;
  durationSpent?: number;
  listeningResult?: RawToeicResult;
  readingResult?: RawToeicResult;
}

export interface AttemptClock {
  status: ToeicAttempt["status"];
  activeSeconds?: number;
  remainingSeconds?: number;
  paused: boolean;
}

function normalizeAttempt(attempt: ToeicAttempt): ToeicAttempt {
  return {
    ...attempt,
    answers: attempt.answers ?? {},
    audioPlayCounts: attempt.audioPlayCounts ?? {},
    flaggedQuestions: attempt.flaggedQuestions ?? [],
    currentQuestionIndex: attempt.currentQuestionIndex ?? 0,
  };
}

/** The API refuses a new attempt while one of the same exam is unfinished. */
export function isAttemptInProgressError(error: unknown) {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    error.response.data?.error === "ATTEMPT_IN_PROGRESS"
  );
}

export const toeicAttemptService = {
  async playAudio(
    id: string,
    { questionId, passageId, passageIndex }: AudioIdentity,
  ) {
    return (
      await apiClient.post<{
        data: { key: string; used: number; limit: number | null };
      }>(`/attempts/${id}/audio-plays`, { questionId, passageId, passageIndex })
    ).data.data;
  },
  async create(examId: string, mode: ExamMode, selectedParts: number[]) {
    return (
      await apiClient.post<{ data: { _id: string } }>("/attempts", {
        examId,
        mode,
        selectedParts,
      })
    ).data.data;
  },
  async get(id: string) {
    const response = await apiClient.get<{ data: ToeicAttempt }>(
      `/attempts/${id}`,
    );
    return normalizeAttempt(response.data.data);
  },
  /** Save a choice without revealing correctness in either mode. */
  async saveAnswer(id: string, questionId: string, answer: string) {
    return (
      await apiClient.patch<{
        data: { saved: boolean; feedback?: AnswerFeedback };
      }>(`/attempts/${id}/answers`, { questionId, answer })
    ).data.data;
  },
  async progress(
    id: string,
    progress: { flaggedQuestions: string[]; currentQuestionIndex: number },
  ) {
    await apiClient.patch(`/attempts/${id}/progress`, progress);
  },
  async check(id: string, questionId: string) {
    return (
      await apiClient.post<{ data: AnswerFeedback }>(
        `/attempts/${id}/check-answer`,
        { questionId },
      )
    ).data.data;
  },
  /** Start counting time: the attempt page is open and visible. */
  async resume(id: string) {
    return (await apiClient.post<{ data: AttemptClock }>(`/attempts/${id}/resume`)).data.data;
  },
  /** Stop counting time. `keepalive` lets the request finish while the page unloads. */
  async pause(id: string, { keepalive = false } = {}) {
    return (
      await apiClient.post<{ data: AttemptClock }>(
        `/attempts/${id}/pause`,
        undefined,
        keepalive ? { adapter: "fetch", fetchOptions: { keepalive: true } } : undefined,
      )
    ).data.data;
  },
  async heartbeat(id: string) {
    return (await apiClient.post<{ data: AttemptClock }>(`/attempts/${id}/heartbeat`)).data.data;
  },
  async abandon(id: string) {
    await apiClient.post(`/attempts/${id}/abandon`);
  },
  async submit(id: string) {
    const response = await apiClient.post<{ data: ToeicAttempt }>(
      `/attempts/${id}/submit`,
    );
    return normalizeAttempt(response.data.data);
  },
};
