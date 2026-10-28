import type { SqlRow } from '../../../postgres/row.js';
export type UserRow = SqlRow<User>;
export enum AuthProvider {
    LOCAL = 'local',
    GOOGLE = 'google'
}
export interface User {
    email: string;
    username?: string;
    password?: string;
    avatarUrl?: string;
    authProvider: AuthProvider;
    ggId?: string;
    isVerified: boolean;
    code?: string;
    codeExpiresAt?: Date;
    isDeleted: boolean;
    deletedAt?: Date;
    isBanned: boolean;
    phone?: string;
    lastActive?: Date;
    notes?: string;
    profileUpdatedAt?: Date;
}
