import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export type WordGuessFeedback = 'correct' | 'present' | 'absent';
export type WordGuessAttempt = {
  userId: string;
  word: string;
  feedback: WordGuessFeedback[];
};

export type ArenaMatchDocument = HydratedDocument<ArenaMatch>;

export enum ArenaMatchType {
  RANK = 'RANK',
  FRIEND = 'FRIEND',
  ROOM = 'ROOM',
}

export enum ArenaFriendMode {
  CLASSIC = 'CLASSIC',
  WORD_CHAIN = 'WORD_CHAIN',
  WORD_GUESS = 'WORD_GUESS',
}

export enum ArenaMatchStatus {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  FINISHING = 'FINISHING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum ArenaMatchFinishReason {
  TURN_TIMEOUT = 'TURN_TIMEOUT',
  NORMAL = 'NORMAL',
  PLAYER_LEFT = 'PLAYER_LEFT',
  DISCONNECT_TIMEOUT = 'DISCONNECT_TIMEOUT',
}

export enum ArenaQuestionMode {
  MIXED = 'MIXED',
  WORD_TO_MEANING = 'WORD_TO_MEANING',
  MEANING_TO_WORD = 'MEANING_TO_WORD',
  LISTENING = 'LISTENING',
  CONTEXT = 'CONTEXT',
}

@Schema({
  timestamps: true,
})
/** Trạng thái tổng quát và cấu hình của một trận Arena. */
export class ArenaMatch {
  @Prop({ type: Object, default: null, immutable: true })
  runtimePolicy?: {
    kFactor?: number;
    readyTimeout?: number;
    reconnectGrace?: number;
  } | null;
  @Prop({ type: String, enum: Object.values(ArenaFriendMode), default: null })
  friendMode?: ArenaFriendMode | null;

  @Prop({ type: Types.ObjectId, ref: 'ArenaMatch', default: null })
  nextMatchId?: Types.ObjectId | null;

  @Prop({ default: false })
  lobbyStarting: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  hostId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  currentTurnUserId?: Types.ObjectId | null;

  @Prop({ default: '' })
  currentWord: string;

  @Prop({ default: '' })
  requiredLetter: string;

  @Prop({ type: Date, default: null })
  turnStartedAt?: Date | null;

  @Prop({ type: Date, default: null })
  turnDeadline?: Date | null;

  @Prop({ type: Date, default: null })
  chainPausedAt?: Date | null;

  @Prop({ type: [String], default: [] })
  usedWords: string[];

  @Prop({ type: String, default: null, select: false }) wordGuessAnswer:
    string | null;
  @Prop({ type: [Object], default: [] }) wordGuessAttempts: WordGuessAttempt[];
  @Prop({ default: 0 }) wordGuessRevision: number;
  @Prop({ type: String, default: null }) wordGuessSolvedBy: string | null;

  @Prop({ default: 0 })
  turnCount: number;

  @Prop({
    type: String,
    enum: Object.values(ArenaMatchType),
    required: true,
    index: true,
  })
  type: ArenaMatchType;

  @Prop({
    type: Types.ObjectId,
    ref: function (this: ArenaMatch) {
      return this.type === ArenaMatchType.FRIEND ||
        this.type === ArenaMatchType.ROOM
        ? 'FriendRoom'
        : 'ArenaRoom';
    },
    default: null,
    index: true,
  })
  roomId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(ArenaMatchStatus),
    default: ArenaMatchStatus.WAITING,
    index: true,
  })
  status: ArenaMatchStatus;

  @Prop({
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
    default: null,
  })
  questionMode: ArenaQuestionMode | null;

  @Prop({
    type: Number,
    default: 10,
    min: 1,
  })
  questionCount: number;

  @Prop({ type: [Types.ObjectId], default: [] })
  eliminatedUserIds: Types.ObjectId[];

  @Prop({ default: 0 }) roomRevision: number;

  @Prop({ default: 1, min: 1 })
  currentQuestionIndex: number;

  @Prop({
    type: Number,
    default: 15,
    min: 5,
  })
  secondsPerQuestion: number;

  @Prop({
    type: Date,
    default: null,
  })
  startedAt?: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  finishedAt?: Date | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  })
  winnerId?: Types.ObjectId | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  isDraw: boolean;

  @Prop({
    type: String,
    default: null,
  })
  cancelReason?: string | null;

  @Prop({
    type: String,
    enum: Object.values(ArenaMatchFinishReason),
    default: null,
  })
  finishReason?: ArenaMatchFinishReason | null;

  @Prop({ default: null, type: String, immutable: true })
  roomCodeSnapshot?: string | null;

  @Prop({ type: Object, default: null, immutable: true })
  settingsSnapshot?: {
    questionCount?: number;
    timePerQuestion?: number;
    turnTime?: number;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchSchema = SchemaFactory.createForClass(ArenaMatch);
ArenaMatchSchema.index({ status: 1, type: 1, finishedAt: -1 });
