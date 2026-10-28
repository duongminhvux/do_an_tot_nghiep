import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type ArenaRoomDocument = PgDocument<ArenaRoom>;

export class ArenaRoomMember {
  @PgField({ type: PgId, ref: 'User', required: true })
  userId: PgId;

  @PgField({ type: String, enum: ['HOST', 'PLAYER'], default: 'PLAYER' })
  role: 'HOST' | 'PLAYER';

  @PgField({ default: false })
  isReady: boolean;

  @PgField({ type: Date, default: Date.now })
  joinedAt: Date;
}

export const ArenaRoomMemberSchema =
  PgSchemaFactory.createForClass(ArenaRoomMember);

/** Metadata của phòng đấu, dùng cho các mode friend/room. */
export class ArenaRoom {
  @PgField({ required: true, trim: true })
  name: string;

  @PgField({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  ownerId: PgId;

  @PgField({
    type: String,
    enum: ['WAITING', 'PLAYING', 'FINISHED', 'CANCELLED'],
    default: 'WAITING',
    index: true })
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';

  @PgField({ type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PRIVATE' })
  visibility: 'PUBLIC' | 'PRIVATE';

  @PgField({
    type: String,
    enum: ['MIXED', 'MEANING', 'ENGLISH', 'LISTENING', 'CONTEXT'],
    default: 'MIXED' })
  questionMode: 'MIXED' | 'MEANING' | 'ENGLISH' | 'LISTENING' | 'CONTEXT';

  @PgField({ default: 20, min: 5, max: 100 })
  questionCount: number;

  @PgField({ default: 15, min: 5 })
  secondsPerQuestion: number;

  @PgField({ default: 8, min: 3, max: 8, validate: Number.isInteger })
  maxPlayers: number;

  @PgField({
    type: String,
    enum: ['GLOBAL', 'COLLECTION', 'LEARNED'],
    default: 'GLOBAL' })
  vocabularySource: 'GLOBAL' | 'COLLECTION' | 'LEARNED';

  @PgField({ type: PgId, ref: 'Collection' })
  collectionId?: PgId;

  @PgField({ type: [ArenaRoomMemberSchema], default: [] })
  members: ArenaRoomMember[];

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaRoomSchema = PgSchemaFactory.createForClass(ArenaRoom);
