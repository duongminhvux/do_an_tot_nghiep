export type GameAudioSettings = {
  audioEnabled?: boolean;
  backgroundMusicUrl?: string;
  correctSoundUrl?: string;
  wrongSoundUrl?: string;
  loseSoundUrl?: string;
};
import apiClient from "@/lib/axios";
export type TypingRushSettings = GameAudioSettings & {
  minWordCount: number;
  lives: number;
  maxLives: number;
  initialFallSpeed: number;
  spawnInterval: number;
  heartEveryWords: number;
  meaningDurationSeconds: number;
};
export type MeaningTypingSettings = Omit<
  TypingRushSettings,
  "meaningDurationSeconds"
> & { hintPercent: number };
export type WordShooterSettings = GameAudioSettings & {
  minWordCount: number;
  wordsPerRound: number;
  roundDurationSeconds: number;
  wrongShotPenaltySeconds: number;
};
export type GameSettings = {
  gameType: "TYPING_RUSH" | "MEANING_TYPING" | "WORD_SHOOTER";
  settings: TypingRushSettings | MeaningTypingSettings | WordShooterSettings;
};
export interface GameDefinition {
  _id: string;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string;
  badge: "NEW" | "POPULAR" | "FEATURED" | null;
  destination: string;
  category: "SOLO" | "MULTIPLAYER";
  order: number;
  isActive: boolean;
}
export type GameInput = Omit<GameDefinition, "_id" | "code" | "destination">;
export const gamesService = {
  async list() {
    return (await apiClient.get<{ data: GameDefinition[] }>("/admin/games"))
      .data.data;
  },
  async save(id: string, data: Partial<GameInput>) {
    return apiClient.patch("/admin/games/" + id, data);
  },
  async configuration(code: string) {
    return (
      await apiClient.get<{ data: GameSettings }>(
        "/admin/minigames/" + code + "/settings",
      )
    ).data.data;
  },
  async saveConfiguration(
    code: string,
    settings: TypingRushSettings | MeaningTypingSettings | WordShooterSettings,
  ) {
    return apiClient.patch("/admin/minigames/" + code + "/settings", settings);
  },
  async reorder(items: { id: string; order: number }[]) {
    return apiClient.patch("/admin/games/reorder", { items });
  },
};
