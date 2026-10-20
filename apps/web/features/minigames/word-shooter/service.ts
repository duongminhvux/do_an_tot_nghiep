import apiClient from "@/lib/axios";
import type {
  GameSession,
  GameStats,
  Sources,
  StartRequest,
  ScoreRecord,
} from "./types";
export const wordShooterService = {
  async sources() {
    return (
      await apiClient.get<{ data: Sources }>(
        "/minigames/word-shooter/vocabulary-sources",
      )
    ).data.data;
  },
  async start(request: StartRequest) {
    return (
      await apiClient.post<{ data: GameSession }>(
        "/minigames/word-shooter/start",
        request,
      )
    ).data.data;
  },
  async save(score: number) {
    return (
      await apiClient.post<{ data: ScoreRecord }>("/minigames/results", {
        gameType: "WORD_SHOOTER",
        score,
      })
    ).data.data;
  },
  async stats() {
    return (
      await apiClient.get<{ data: GameStats }>(
        "/minigames/results/WORD_SHOOTER",
      )
    ).data.data;
  },
};
export function gameErrorCode(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : "REQUEST_FAILED";
}
