import type { SqlRow } from '../../../postgres/row.js';
import { ArenaFriendMode } from './arena-match.row.js';
export type ArenaInvitationRow = SqlRow<ArenaInvitation>;
/** Lời mời người chơi tham gia một trận hoặc phòng Arena. */
export interface ArenaInvitation {
    mode: ArenaFriendMode;
    rematchOf?: string | null;
    senderId: string;
    receiverId: string;
    type: 'DUEL' | 'ROOM';
    roomId?: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
