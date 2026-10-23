import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { ArenaFriendMode } from './arena-match.schema.js';

export enum FriendRoomStatus {
  WAITING = 'WAITING',
  IN_MATCH = 'IN_MATCH',
  CLOSED = 'CLOSED' }
export type FriendRoomSettings = {
  questionCount?: number;
  timePerQuestion?: number;
  turnTime?: number;
};
@PgEntity({ _id: false })
export class FriendRoomMember {
  @PgField({ type: PgId, required: true, ref: 'User' })
  userId: PgId;
  @PgField({ default: false }) isReady: boolean;
  @PgField({ type: Date, default: null }) disconnectedAt: Date | null;
}
const FriendRoomMemberSchema = PgSchemaFactory.createForClass(FriendRoomMember);
@PgEntity({ timestamps: true })
export class FriendRoom {
  @PgField({ type: Object, default: null })
  runtimePolicy?: { reconnectGrace: number; idleTimeout: number } | null;
  createdAt: Date;
  updatedAt: Date;
  @PgField({ required: true, unique: true }) code: string;
  @PgField({ type: PgId, required: true, ref: 'User', index: true })
  hostId: PgId;
  @PgField({ type: PgId, default: null, ref: 'User', index: true })
  guestId: PgId | null;
  @PgField({ type: String, enum: Object.values(ArenaFriendMode), required: true })
  mode: ArenaFriendMode;
  @PgField({
    type: String,
    enum: Object.values(FriendRoomStatus),
    default: FriendRoomStatus.WAITING })
  status: FriendRoomStatus;
  @PgField({
    type: Number,
    default: 2,
    min: 2,
    max: 8,
    validate: Number.isInteger })
  maxPlayers: number;
  @PgField({ type: [FriendRoomMemberSchema], default: [] })
  members: FriendRoomMember[];
  @PgField({ default: false }) guestReady: boolean;
  @PgField({ type: Object, required: true }) settings: FriendRoomSettings;
  @PgField({ type: PgId, default: null, ref: 'ArenaMatch' })
  currentMatchId: PgId | null;
  @PgField({ default: 0 }) matchCount: number;
  @PgField({ default: 0 }) revision: number;
  @PgField({ type: Date, default: null }) hostDisconnectedAt: Date | null;
  @PgField({ type: Date, default: null }) guestDisconnectedAt: Date | null;
}
export const FriendRoomSchema = PgSchemaFactory.createForClass(FriendRoom);
