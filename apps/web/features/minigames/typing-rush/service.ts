import apiClient from "@/lib/axios";
import type {
  GameSession,
  GameStats,
  Sources,
  StartRequest,
  ScoreRecord,
} from "./types";
export const typingRushService = {
  async sources() {
    return (
      await apiClient.get<{ data: Sources }>("/minigames/vocabulary-sources")
    ).data.data;
  },
  async start(request: StartRequest) {
    return (
      await apiClient.post<{ data: GameSession }>(
        "/minigames/typing-rush/start",
        request,
      )
    ).data.data;
  },
  async save(score: number) {
    return (
      await apiClient.post<{ data: ScoreRecord }>("/minigames/results", {
        gameType: "TYPING_RUSH",
        score,
      })
    ).data.data;
  },
  async stats() {
    return (
      await apiClient.get<{ data: GameStats }>("/minigames/results/TYPING_RUSH")
    ).data.data;
  },
};
export function gameErrorCode(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : "REQUEST_FAILED";
}
