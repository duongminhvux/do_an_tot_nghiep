import { io, Socket } from "socket.io-client";

const ARENA_SOCKET_URL = (
  process.env.NEXT_PUBLIC_ARENA_SOCKET_URL || "http://localhost:5000/arena"
).replace(/\/+$/, "");

export const arenaSocket: Socket = io(ARENA_SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});

export function connectArenaSocket(token: string) {
  arenaSocket.auth = {
    token,
  };

  if (!arenaSocket.connected) {
    arenaSocket.connect();
  }
}

export function disconnectArenaSocket() {
  arenaSocket.disconnect();
  arenaSocket.auth = {};
}
