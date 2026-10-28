import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type WordGuessFeedback = 'correct' | 'present' | 'absent';
export type WordGuessAttempt = {
  userId: string;
  word: string;
  feedback: WordGuessFeedback[];
};

export type ArenaMatchDocument = PgDocument<ArenaMatch>;

export enum ArenaMatchType {
  RANK = 'RANK',
  FRIEND = 'FRIEND',
  ROOM = 'ROOM' }

export enum ArenaFriendMode {
  CLASSIC = 'CLASSIC',
  WORD_CHAIN = 'WORD_CHAIN',
  WORD_GUESS = 'WORD_GUESS' }

export enum ArenaMatchStatus {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RESUMING = 'RESUMING',
  FINISHING = 'FINISHING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED' }

export enum ArenaMatchFinishReason {
  TURN_TIMEOUT = 'TURN_TIMEOUT',
  NORMAL = 'NORMAL',
  PLAYER_LEFT = 'PLAYER_LEFT',
  DISCONNECT_TIMEOUT = 'DISCONNECT_TIMEOUT',
  DISCONNECT_FORFEIT = 'DISCONNECT_FORFEIT',
  BOTH_DISCONNECTED = 'BOTH_DISCONNECTED' }

export enum ArenaQuestionMode {
  MIXED = 'MIXED',
  WORD_TO_MEANING = 'WORD_TO_MEANING',
  MEANING_TO_WORD = 'MEANING_TO_WORD',
  LISTENING = 'LISTENING',
  CONTEXT = 'CONTEXT' }

/** Trạng thái tổng quát và cấu hình của một trận Arena. */
export class ArenaMatch {
  @PgField({ type: Object, default: null, immutable: true })
  runtimePolicy?: {
    hints?: import('../admin/arena-settings.defaults.js').ArenaConfiguration['hints'];
    rankedConnection?: import('../admin/arena-settings.defaults.js').ArenaConfiguration['rankedConnection'];
    kFactor?: number;
    readyTimeout?: number;
    reconnectGrace?: number;
  } | null;
  @PgField({ type: Object, default: null })
  rankedState?: import('../matches/arena-ranked-connection.service.js').RankedConnectionState | null;
  @PgField({ type: String, enum: Object.values(ArenaFriendMode), default: null })
  friendMode?: ArenaFriendMode | null;

  @PgField({ type: PgId, ref: 'ArenaMatch', default: null })
  nextMatchId?: PgId | null;

  @PgField({ default: false })
  lobbyStarting: boolean;

  @PgField({ type: PgId, ref: 'User', default: null })
  hostId?: PgId | null;

  @PgField({ type: PgId, ref: 'User', default: null })
  currentTurnUserId?: PgId | null;

  @PgField({ default: '' })
  currentWord: string;

  @PgField({ default: '' })
  requiredLetter: string;

  @PgField({ type: Date, default: null })
  turnStartedAt?: Date | null;

  @PgField({ type: Date, default: null })
  turnDeadline?: Date | null;

  @PgField({ type: Date, default: null })
  chainPausedAt?: Date | null;

  @PgField({ type: [String], default: [] })
  usedWords: string[];

  @PgField({ type: String, default: null, select: false }) wordGuessAnswer:
    string | null;
  @PgField({ type: [Object], default: [] }) wordGuessAttempts: WordGuessAttempt[];
  @PgField({ default: 0 }) wordGuessRevision: number;
  @PgField({ type: String, default: null }) wordGuessSolvedBy: string | null;

  @PgField({ default: 0 })
  turnCount: number;

  @PgField({
    type: String,
    enum: Object.values(ArenaMatchType),
    required: true,
    index: true })
  type: ArenaMatchType;

  @PgField({
    type: PgId,
    ref: function (this: ArenaMatch) {
      return this.type === ArenaMatchType.FRIEND ||
        this.type === ArenaMatchType.ROOM
        ? 'FriendRoom'
        : 'ArenaRoom';
    },
    default: null,
    index: true })
  roomId?: PgId | null;

  @PgField({
    type: String,
    enum: Object.values(ArenaMatchStatus),
    default: ArenaMatchStatus.WAITING,
    index: true })
  status: ArenaMatchStatus;

  @PgField({
    type: String,
    enum: Object.values(ArenaQuestionMode),
    required: function (this: ArenaMatch) {
      return (
        (this.type !== ArenaMatchType.FRIEND &&
          this.type !== ArenaMatchType.ROOM) ||
        !this.friendMode ||
        this.friendMode === ArenaFriendMode.CLASSIC
      );
    },
    default: null })
  questionMode: ArenaQuestionMode | null;

  @PgField({
    type: Number,
    default: 10,
    min: 1 })
  questionCount: number;

  @PgField({ type: [PgId], default: [] })
  eliminatedUserIds: PgId[];

  @PgField({ default: 0 }) roomRevision: number;

  @PgField({ default: 1, min: 1 })
  currentQuestionIndex: number;

  @PgField({
    type: Number,
    default: 15,
    min: 5 })
  secondsPerQuestion: number;

  @PgField({
    type: Date,
    default: null })
  startedAt?: Date | null;

  @PgField({
    type: Date,
    default: null })
  finishedAt?: Date | null;

  @PgField({
    type: PgId,
    ref: 'User',
    default: null,
    index: true })
  winnerId?: PgId | null;

  @PgField({
    type: Boolean,
    default: false })
  isDraw: boolean;

  @PgField({
    type: String,
    default: null })
  cancelReason?: string | null;

  @PgField({
    type: String,
    enum: Object.values(ArenaMatchFinishReason),
    default: null })
  finishReason?: ArenaMatchFinishReason | null;

  @PgField({ default: null, type: String, immutable: true })
  roomCodeSnapshot?: string | null;

  @PgField({ type: Object, default: null, immutable: true })
  settingsSnapshot?: {
    questionCount?: number;
    timePerQuestion?: number;
    turnTime?: number;
  } | null;

  @PgField({ type: Object, default: null, immutable: true })
  audioSettings?: { audioEnabled?: boolean; backgroundMusicUrl?: string; correctSoundUrl?: string; wrongSoundUrl?: string; loseSoundUrl?: string } | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchSchema = PgSchemaFactory.createForClass(ArenaMatch);
