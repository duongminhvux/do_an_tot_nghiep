import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserSavedWordDocument = HydratedDocument<UserSavedWord>;

@Schema({ timestamps: true })
export class UserSavedWord {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Word',
    required: true,
    index: true,
  })
  wordId: Types.ObjectId;

  @Prop({
    type: Date,
    default: Date.now,
  })
  savedAt: Date;

  @Prop({ trim: true })
  note?: string;
}

export const UserSavedWordSchema = SchemaFactory.createForClass(UserSavedWord);

UserSavedWordSchema.index(
  { userId: 1, wordId: 1 },
  { unique: true },
);

UserSavedWordSchema.index(
  { userId: 1, savedAt: -1 },
);