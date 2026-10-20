import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ArenaFriendMode } from './arena-match.schema.js';

export type ArenaInvitationDocument = HydratedDocument<ArenaInvitation>;

@Schema({ timestamps: true })
/** Lời mời người chơi tham gia một trận hoặc phòng Arena. */
export class ArenaInvitation {
  @Prop({
    type: String,
    enum: Object.values(ArenaFriendMode),
    default: ArenaFriendMode.CLASSIC,
  })
  mode: ArenaFriendMode;

  @Prop({ type: Types.ObjectId, ref: 'ArenaMatch', default: null })
  rematchOf?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  receiverId: Types.ObjectId;

  @Prop({ type: String, enum: ['DUEL', 'ROOM'], required: true })
  type: 'DUEL' | 'ROOM';

  @Prop({
    type: Types.ObjectId,
    ref: function (this: ArenaInvitation) {
      return this.type === 'DUEL' ? 'FriendRoom' : 'ArenaRoom';
    },
  })
  roomId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
    ],
    default: 'PENDING',
    index: true,
  })
  status:
    'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

  @Prop({ type: Date })
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaInvitationSchema =
  SchemaFactory.createForClass(ArenaInvitation);

ArenaInvitationSchema.index(
  { senderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING', type: 'DUEL' },
  },
);

// Only remove expired invitations; accepted/rejected invitations remain available.
ArenaInvitationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'EXPIRED' } },
);
