export const ARENA_DEFAULTS = {
  maintenance: false,
  hints: { startAfterSeconds: 10, intervalSeconds: 5, maxPercent: 30 },
  audio: { audioEnabled: true, backgroundMusicUrl: '', correctSoundUrl: '', wrongSoundUrl: '', loseSoundUrl: '' },
  ranked: {
    enabled: true,
    defaultRating: 1000,
    kFactor: 32,
    ratingRange: 100,
    questionCount: 10,
    timePerQuestion: 30,
    readyTimeout: 30,
    reconnectGrace: 20 },
  rankedConnection: {
    rankedPauseEnabled: true,
    reloadGraceSeconds: 3,
    disconnectTimeoutSeconds: 60,
    resumeCountdownSeconds: 3,
    maxTotalPauseSeconds: 120,
    maxPauseCount: 3,
    idleDetectionEnabled: false,
    idleTimeoutSeconds: 120,
    idleChallengeTimeoutSeconds: 15,
    bothDisconnectedPolicy: 'CANCEL_NO_RATING' as const,
  },
  friendly: { enabled: true, inviteTimeout: 10, reconnectGrace: 20 },
  group: {
    enabled: true,
    maxPlayers: 8,
    roomIdleTimeout: 1800,
    reconnectGrace: 20 } };
export type ArenaConfiguration = typeof ARENA_DEFAULTS;
