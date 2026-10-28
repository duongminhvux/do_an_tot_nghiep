import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type UserSavedWordDocument = PgDocument<UserSavedWord>;

export class UserSavedWord {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'Word',
    required: true,
    index: true })
  wordId: PgId;

  @PgField({
    type: PgId,
    ref: 'VocabularyFolder',
    index: true })
  folderId?: PgId;

  @PgField({
    type: Date,
    default: Date.now })
  savedAt: Date;

  @PgField({ trim: true })
  note?: string;
}

export const UserSavedWordSchema = PgSchemaFactory.createForClass(UserSavedWord);