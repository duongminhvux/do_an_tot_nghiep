import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { ArenaFriendMode } from './arena-match.schema.js';

export type ArenaInvitationDocument = PgDocument<ArenaInvitation>;

@PgEntity({ timestamps: true })
/** Lời mời người chơi tham gia một trận hoặc phòng Arena. */
export class ArenaInvitation {
  @PgField({
    type: String,
    enum: Object.values(ArenaFriendMode),
    default: ArenaFriendMode.CLASSIC })
  mode: ArenaFriendMode;

  @PgField({ type: PgId, ref: 'ArenaMatch', default: null })
  rematchOf?: PgId | null;
  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  senderId: PgId;

  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  receiverId: PgId;

  @PgField({ type: String, enum: ['DUEL', 'ROOM'], required: true })
  type: 'DUEL' | 'ROOM';

  @PgField({
    type: PgId,
    ref: function (this: ArenaInvitation) {
      return this.type === 'DUEL' ? 'FriendRoom' : 'ArenaRoom';
    } })
  roomId?: PgId;

  @PgField({
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
    index: true })
  status:
    'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

  @PgField({ type: Date })
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaInvitationSchema =
  PgSchemaFactory.createForClass(ArenaInvitation);

ArenaInvitationSchema.index(
  { senderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING', type: 'DUEL' } },
);

// Only remove expired invitations; accepted/rejected invitations remain available.
ArenaInvitationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'EXPIRED' } },
);
