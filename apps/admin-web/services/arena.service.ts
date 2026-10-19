import apiClient from "@/lib/axios";
export interface ArenaUser {
  _id: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  isBanned?: boolean;
  isDeleted?: boolean;
}
export interface ArenaParticipant {
  userId: string;
  user: ArenaUser | null;
  score: number;
  status: string;
  ratingBefore?: number;
  ratingAfter?: number;
  ratingChange?: number;
  createdAt: string;
  finishedAt?: string;
  isReady: boolean;
}
export interface ArenaMatch {
  _id: string;
  type: string;
  friendMode?: string;
  questionMode?: string;
  status: string;
  finishReason?: string;
  cancelReason?: string;
  winnerId?: string;
  isDraw: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  duration: number | null;
  roomId?: string;
  roomCodeSnapshot?: string;
  players: ArenaParticipant[];
  usedWords: string[];
  turnCount: number;
  currentWord?: string;
  requiredLetter?: string;
  wordGuessAttempts?: { userId: string; word: string; feedback: string[] }[];
  settingsSnapshot?: Record<string, number>;
  runtimePolicy?: Record<string, number>;
}
export interface MatchQuestion {
  _id: string;
  order: number;
  type: string;
  question: string;
  correctAnswer: string;
  startedAt?: string;
  resolvedAt?: string;
  winnerId?: string;
}
export interface PlayerAnswer {
  _id: string;
  matchQuestionId: string;
  userId: string;
  selectedAnswer?: string;
  attempts: number;
  isCorrect: boolean;
  timedOut: boolean;
  responseTimeMs: number;
  earnedScore: number;
  answeredAt?: string;
}
export interface MatchDetail extends ArenaMatch {
  questions: MatchQuestion[];
  answers: PlayerAnswer[];
}
export interface ArenaProfile {
  userId: string;
  user: ArenaUser | null;
  rating: number;
  rankedMatches: number;
  rankedWins: number;
  rankedLosses: number;
  rankedDraws: number;
  winRate: number;
  currentWinStreak: number;
  bestWinStreak: number;
  lastActivity?: string;
  position?: number;
}
export interface ArenaRating {
  _id: string;
  matchId: string;
  before: number;
  after: number;
  change: number;
  createdAt: string;
}
export interface ArenaRoom {
  _id: string;
  code: string;
  type: string;
  hostId: string;
  host: ArenaUser | null;
  maxPlayers: number;
  mode: string;
  status: string;
  currentMatchId?: string;
  settings: Record<string, number>;
  runtimePolicy?: Record<string, number>;
  players: { userId: string; user: ArenaUser | null; isReady: boolean }[];
  createdAt: string;
  updatedAt: string;
  stale: boolean;
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface PlayerDetail {
  user: ArenaUser;
  profile: ArenaProfile | null;
  matches: Paged<ArenaMatch>;
  ratingHistory: Paged<ArenaRating>;
}
export interface ArenaConfig {
  maintenance: boolean;
  ranked: {
    enabled: boolean;
    defaultRating: number;
    kFactor: number;
    ratingRange: number;
    questionCount: number;
    timePerQuestion: number;
    readyTimeout: number;
    reconnectGrace: number;
  };
  friendly: { enabled: boolean; inviteTimeout: number; reconnectGrace: number };
  group: {
    enabled: boolean;
    maxPlayers: number;
    roomIdleTimeout: number;
    reconnectGrace: number;
  };
}
export interface SettingsResponse {
  revision: number;
  config: ArenaConfig;
}
export interface ArenaDashboard {
  matchesToday: number;
  rankedToday: number;
  friendlyToday: number;
  groupToday: number;
  cancelledToday: number;
  activeMatches: number;
  waitingRooms: number;
  onlineArenaUsers: number | null;
  daily: { _id: string; count: number }[];
  distribution: { _id: string; count: number }[];
  reasons: { _id: string; count: number }[];
  recent: ArenaMatch[];
  days: number;
}
export type ArenaParams = Record<string, string | number | undefined>;
async function get<T>(path: string, params?: ArenaParams) {
  return (
    await apiClient.get<{ data: T }>("/admin/arena/" + path, {
      params: params
        ? Object.fromEntries(
            Object.entries(params).filter(
              ([, value]) => value !== "" && value !== undefined,
            ),
          )
        : undefined,
    })
  ).data.data;
}
export const arenaAdminService = {
  dashboard: (days: number) => get<ArenaDashboard>("dashboard", { days }),
  matches: (params: ArenaParams) => get<Paged<ArenaMatch>>("matches", params),
  match: (id: string) => get<MatchDetail>("matches/" + id),
  players: (params: ArenaParams) => get<Paged<ArenaProfile>>("players", params),
  player: (id: string) => get<PlayerDetail>("players/" + id),
  history: (id: string, params: ArenaParams) =>
    get<Paged<ArenaMatch>>("players/" + id + "/matches", params),
  ratings: (id: string, params: ArenaParams) =>
    get<Paged<ArenaRating>>("players/" + id + "/rating-history", params),
  rooms: (params: ArenaParams) => get<Paged<ArenaRoom>>("rooms", params),
  room: (id: string) => get<ArenaRoom>("rooms/" + id),
  close: (id: string, reason: string) =>
    apiClient.post("/admin/arena/rooms/" + id + "/close", { reason }),
  settings: () => get<SettingsResponse>("settings"),
  saveSettings: async (data: SettingsResponse & { reason: string }) =>
    (
      await apiClient.put<{ data: SettingsResponse }>(
        "/admin/arena/settings",
        data,
      )
    ).data.data,
};
