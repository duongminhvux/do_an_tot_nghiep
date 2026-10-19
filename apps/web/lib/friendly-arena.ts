import i18n from "@/lib/i18n";
import { arenaSocket } from "@/lib/arena-socket";

export type FriendMode = "CLASSIC" | "WORD_CHAIN" | "WORD_GUESS";
export type FriendInvite = {
  roomId?: string | null;
  inviteId: string;
  senderId: string;
  receiverId: string;
  username: string;
  avatarUrl?: string;
  mode: FriendMode;
  rematchOf?: string | null;
  expiresAt: string;
};
export type FriendPresenceUpdate = {
  userId: string;
  online: boolean;
};
export type FriendPlayer = {
  userId: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
  recent?: boolean;
  isReady?: boolean;
  eliminated?: boolean;
  returnedToLobby?: boolean;
  leftLobby?: boolean;
  score?: number;
  disconnectedAt?: string | null;
};
export type FriendSnapshot = {
  type?: "FRIEND" | "ROOM";
  roomId?: string | null;
  code?: string;
  matchId: string;
  status: string;
  nextMatchId?: string | null;
  mode: FriendMode;
  hostId: string;
  players: FriendPlayer[];
  serverNow: string;
};
export function friendlyRequest<T = unknown>(
  event: string,
  payload: object,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!arenaSocket.connected) {
      reject(new Error("Socket disconnected"));
      return;
    }
    arenaSocket
      .timeout(10000)
      .emit(
        event,
        payload,
        (
          failure: Error | null,
          ack?: { success: boolean; message?: string; data: T },
        ) => {
          if (failure || !ack?.success)
            reject(
              new Error(
                ack?.message === "ARENA_UNAVAILABLE"
                  ? i18n.t("common:arena_controls.unavailable")
                  : ack?.message || failure?.message || "Request failed",
              ),
            );
          else resolve(ack.data);
        },
      );
  });
}

export type FriendRoomClosed = {
  roomId: string;
  code: string;
  hostId: string;
  reason: "HOST_LEFT" | "ADMIN_CLOSED" | "IDLE_TIMEOUT";
};

export type FriendRoomSettings = {
  questionCount?: number;
  timePerQuestion?: number;
  turnTime?: number;
};
export type FriendRoomSnapshot = {
  roomId: string;
  code: string;
  hostId: string;
  guestId: string | null;
  status: "WAITING" | "IN_MATCH" | "CLOSED";
  mode: FriendMode;
  settings: FriendRoomSettings;
  guestReady: boolean;
  maxPlayers: number;
  currentMatchId: string | null;
  matchCount: number;
  players: FriendPlayer[];
  serverNow: string;
};
