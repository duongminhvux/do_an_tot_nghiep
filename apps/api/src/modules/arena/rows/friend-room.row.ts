import { ArenaFriendMode } from './arena-match.row.js';
export enum FriendRoomStatus {
    WAITING = 'WAITING',
    IN_MATCH = 'IN_MATCH',
    CLOSED = 'CLOSED'
}
export type FriendRoomSettings = {
    questionCount?: number;
    timePerQuestion?: number;
    turnTime?: number;
};
export interface FriendRoomMember {
    userId: string;
    isReady: boolean;
    disconnectedAt: Date | null;
}
export interface FriendRoom {
    runtimePolicy?: {
        reconnectGrace: number;
        idleTimeout: number;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    hostId: string;
    guestId: string | null;
    mode: ArenaFriendMode;
    status: FriendRoomStatus;
    maxPlayers: number;
    members: FriendRoomMember[];
    guestReady: boolean;
    settings: FriendRoomSettings;
    currentMatchId: string | null;
    matchCount: number;
    revision: number;
    hostDisconnectedAt: Date | null;
    guestDisconnectedAt: Date | null;
}
