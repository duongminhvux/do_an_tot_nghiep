import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ArenaRoomDocument = HydratedDocument<ArenaRoom>;

@Schema({ _id: false })
export class ArenaRoomMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['HOST', 'PLAYER'], default: 'PLAYER' })
  role: 'HOST' | 'PLAYER';

  @Prop({ default: false })
  isReady: boolean;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;
}

export const ArenaRoomMemberSchema =
  SchemaFactory.createForClass(ArenaRoomMember);

@Schema({ timestamps: true })
/** Metadata của phòng đấu, dùng cho các mode friend/room. */
export class ArenaRoom {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['WAITING', 'PLAYING', 'FINISHED', 'CANCELLED'],
    default: 'WAITING',
    index: true,
  })
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';

  @Prop({ type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PRIVATE' })
  visibility: 'PUBLIC' | 'PRIVATE';

  @Prop({
    type: String,
    enum: ['MIXED', 'MEANING', 'ENGLISH', 'LISTENING', 'CONTEXT'],
    default: 'MIXED',
  })
  questionMode: 'MIXED' | 'MEANING' | 'ENGLISH' | 'LISTENING' | 'CONTEXT';

  @Prop({ default: 20, min: 5, max: 100 })
  questionCount: number;

  @Prop({ default: 15, min: 5 })
  secondsPerQuestion: number;

  @Prop({ default: 8, min: 3, max: 8, validate: Number.isInteger })
  maxPlayers: number;

  @Prop({
    type: String,
    enum: ['GLOBAL', 'COLLECTION', 'LEARNED'],
    default: 'GLOBAL',
  })
  vocabularySource: 'GLOBAL' | 'COLLECTION' | 'LEARNED';

  @Prop({ type: Types.ObjectId, ref: 'Collection' })
  collectionId?: Types.ObjectId;

  @Prop({ type: [ArenaRoomMemberSchema], default: [] })
  members: ArenaRoomMember[];

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaRoomSchema = SchemaFactory.createForClass(ArenaRoom);
