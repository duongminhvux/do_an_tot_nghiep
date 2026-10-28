import type { SqlRow } from '../../../../postgres/row.js';
export type UserSavedWordRow = SqlRow<UserSavedWord>;
export interface UserSavedWord {
    userId: string;
    wordId: string;
    folderId?: string;
    savedAt: Date;
    note?: string;
}
