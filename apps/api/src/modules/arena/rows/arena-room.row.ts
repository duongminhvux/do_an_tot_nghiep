import type { SqlRow } from '../../../postgres/row.js';
export type ArenaRoomRow = SqlRow<ArenaRoom>;
export interface ArenaRoomMember {
    userId: string;
    role: 'HOST' | 'PLAYER';
    isReady: boolean;
    joinedAt: Date;
}
/** Metadata của phòng đấu, dùng cho các mode friend/room. */
export interface ArenaRoom {
    name: string;
    code: string;
    ownerId: string;
    status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
    visibility: 'PUBLIC' | 'PRIVATE';
    questionMode: 'MIXED' | 'MEANING' | 'ENGLISH' | 'LISTENING' | 'CONTEXT';
    questionCount: number;
    secondsPerQuestion: number;
    maxPlayers: number;
    vocabularySource: 'GLOBAL' | 'COLLECTION' | 'LEARNED';
    collectionId?: string;
    members: ArenaRoomMember[];
    createdAt: Date;
    updatedAt: Date;
}
