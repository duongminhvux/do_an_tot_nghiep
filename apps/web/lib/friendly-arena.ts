import { arenaSocket } from "@/lib/arena-socket";

export type FriendMode = "CLASSIC" | "WORD_CHAIN";
export type FriendInvite = {
  inviteId: string;
  senderId: string;
  receiverId: string;
  username: string;
  avatarUrl?: string;
  mode: FriendMode;
  rematchOf?: string | null;
  expiresAt: string;
};
export type FriendPlayer = {
  userId: string;
  username: string;
  avatarUrl?: string;
  online?: boolean;
  recent?: boolean;
  isReady?: boolean;
  returnedToLobby?: boolean;
  leftLobby?: boolean;
  score?: number;
  disconnectedAt?: string | null;
};
export type FriendSnapshot = {
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
              new Error(ack?.message || failure?.message || "Request failed"),
            );
          else resolve(ack.data);
        },
      );
  });
}
