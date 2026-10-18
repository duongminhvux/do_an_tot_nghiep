import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ArenaFriendMode } from './arena-match.schema.js';

export enum FriendRoomStatus {
  WAITING = 'WAITING',
  IN_MATCH = 'IN_MATCH',
  CLOSED = 'CLOSED',
}
export type FriendRoomSettings = {
  questionCount?: number;
  timePerQuestion?: number;
  turnTime?: number;
};
@Schema({ _id: false })
export class FriendRoomMember {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId: Types.ObjectId;
  @Prop({ default: false }) isReady: boolean;
  @Prop({ type: Date, default: null }) disconnectedAt: Date | null;
}
const FriendRoomMemberSchema = SchemaFactory.createForClass(FriendRoomMember);
@Schema({ timestamps: true })
export class FriendRoom {
  @Prop({ required: true, unique: true }) code: string;
  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  hostId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, default: null, ref: 'User', index: true })
  guestId: Types.ObjectId | null;
  @Prop({ type: String, enum: Object.values(ArenaFriendMode), required: true })
  mode: ArenaFriendMode;
  @Prop({
    type: String,
    enum: Object.values(FriendRoomStatus),
    default: FriendRoomStatus.WAITING,
  })
  status: FriendRoomStatus;
  @Prop({
    type: Number,
    default: 2,
    min: 2,
    max: 8,
    validate: Number.isInteger,
  })
  maxPlayers: number;
  @Prop({ type: [FriendRoomMemberSchema], default: [] })
  members: FriendRoomMember[];
  @Prop({ default: false }) guestReady: boolean;
  @Prop({ type: Object, required: true }) settings: FriendRoomSettings;
  @Prop({ type: Types.ObjectId, default: null, ref: 'ArenaMatch' })
  currentMatchId: Types.ObjectId | null;
  @Prop({ default: 0 }) matchCount: number;
  @Prop({ default: 0 }) revision: number;
  @Prop({ type: Date, default: null }) hostDisconnectedAt: Date | null;
  @Prop({ type: Date, default: null }) guestDisconnectedAt: Date | null;
}
export const FriendRoomSchema = SchemaFactory.createForClass(FriendRoom);
