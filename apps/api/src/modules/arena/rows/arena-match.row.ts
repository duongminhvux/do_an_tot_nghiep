import type { SqlRow } from '../../../postgres/row.js';
export type WordGuessFeedback = 'correct' | 'present' | 'absent';
export type WordGuessAttempt = {
    userId: string;
    word: string;
    feedback: WordGuessFeedback[];
};
export type ArenaMatchRow = SqlRow<ArenaMatch>;
export enum ArenaMatchType {
    RANK = 'RANK',
    FRIEND = 'FRIEND',
    ROOM = 'ROOM'
}
export enum ArenaFriendMode {
    CLASSIC = 'CLASSIC',
    WORD_CHAIN = 'WORD_CHAIN',
    WORD_GUESS = 'WORD_GUESS'
}
export enum ArenaMatchStatus {
    WAITING = 'WAITING',
    COUNTDOWN = 'COUNTDOWN',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    RESUMING = 'RESUMING',
    FINISHING = 'FINISHING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}
export enum ArenaMatchFinishReason {
    TURN_TIMEOUT = 'TURN_TIMEOUT',
    NORMAL = 'NORMAL',
    PLAYER_LEFT = 'PLAYER_LEFT',
    DISCONNECT_TIMEOUT = 'DISCONNECT_TIMEOUT',
    DISCONNECT_FORFEIT = 'DISCONNECT_FORFEIT',
    BOTH_DISCONNECTED = 'BOTH_DISCONNECTED'
}
export enum ArenaQuestionMode {
    MIXED = 'MIXED',
    WORD_TO_MEANING = 'WORD_TO_MEANING',
    MEANING_TO_WORD = 'MEANING_TO_WORD',
    LISTENING = 'LISTENING',
    CONTEXT = 'CONTEXT'
}
/** Trạng thái tổng quát và cấu hình của một trận Arena. */
export interface ArenaMatch {
    runtimePolicy?: {
        hints?: import('../admin/arena-settings.defaults.js').ArenaConfiguration['hints'];
        rankedConnection?: import('../admin/arena-settings.defaults.js').ArenaConfiguration['rankedConnection'];
        kFactor?: number;
        readyTimeout?: number;
        reconnectGrace?: number;
    } | null;
    rankedState?: import('../matches/arena-ranked-connection.service.js').RankedConnectionState | null;
    friendMode?: ArenaFriendMode | null;
    nextMatchId?: string | null;
    lobbyStarting: boolean;
    hostId?: string | null;
    currentTurnUserId?: string | null;
    currentWord: string;
    requiredLetter: string;
    turnStartedAt?: Date | null;
    turnDeadline?: Date | null;
    chainPausedAt?: Date | null;
    usedWords: string[];
    wordGuessAnswer: string | null;
    wordGuessAttempts: WordGuessAttempt[];
    wordGuessRevision: number;
    wordGuessSolvedBy: string | null;
    turnCount: number;
    type: ArenaMatchType;
    roomId?: string | null;
    status: ArenaMatchStatus;
    questionMode: ArenaQuestionMode | null;
    questionCount: number;
    eliminatedUserIds: string[];
    roomRevision: number;
    currentQuestionIndex: number;
    secondsPerQuestion: number;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    winnerId?: string | null;
    isDraw: boolean;
    cancelReason?: string | null;
    finishReason?: ArenaMatchFinishReason | null;
    roomCodeSnapshot?: string | null;
    settingsSnapshot?: {
        questionCount?: number;
        timePerQuestion?: number;
        turnTime?: number;
    } | null;
    audioSettings?: {
        audioEnabled?: boolean;
        backgroundMusicUrl?: string;
        correctSoundUrl?: string;
        wrongSoundUrl?: string;
        loseSoundUrl?: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}
