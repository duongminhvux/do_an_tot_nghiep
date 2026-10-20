export const ARENA_DEFAULTS = {
  maintenance: false,
  ranked: {
    enabled: true,
    defaultRating: 1000,
    kFactor: 32,
    ratingRange: 100,
    questionCount: 10,
    timePerQuestion: 30,
    readyTimeout: 30,
    reconnectGrace: 20,
  },
  friendly: { enabled: true, inviteTimeout: 10, reconnectGrace: 20 },
  group: {
    enabled: true,
    maxPlayers: 8,
    roomIdleTimeout: 1800,
    reconnectGrace: 20,
  },
};
export type ArenaConfiguration = typeof ARENA_DEFAULTS;
