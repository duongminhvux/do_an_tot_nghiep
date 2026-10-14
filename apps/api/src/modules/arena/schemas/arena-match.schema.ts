import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ArenaMatchDocument = HydratedDocument<ArenaMatch>;

export enum ArenaMatchType {
  RANK = 'RANK',
  FRIEND = 'FRIEND',
  ROOM = 'ROOM',
}

export enum ArenaFriendMode {
  CLASSIC = 'CLASSIC',
  WORD_CHAIN = 'WORD_CHAIN',
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
  @Prop({ type: String, enum: Object.values(ArenaFriendMode), default: null })
  friendMode?: ArenaFriendMode | null;

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
    ref: 'ArenaRoom',
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
    required: true,
  })
  questionMode: ArenaQuestionMode;

  @Prop({
    type: Number,
    default: 10,
    min: 1,
  })
  questionCount: number;

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

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchSchema = SchemaFactory.createForClass(ArenaMatch);
ArenaMatchSchema.index({ status: 1, type: 1, finishedAt: -1 });
