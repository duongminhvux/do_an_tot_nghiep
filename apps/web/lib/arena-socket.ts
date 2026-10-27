import { io, Socket } from "socket.io-client";
import { refreshAccessToken } from '@/lib/axios';
import { isAccessTokenValid } from '@/lib/access-token';
import { store } from '@/redux/store';

const ARENA_SOCKET_URL = (
  process.env.NEXT_PUBLIC_ARENA_SOCKET_URL || "http://localhost:5000/arena"
).replace(/\/+$/, "");

export const arenaSocket: Socket = io(ARENA_SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});

export function connectArenaSocket(token: string) {
  arenaSocket.auth = (callback) => {
    const current = store.getState().auth.accessToken || token;
    if (isAccessTokenValid(current)) callback({ token: current });
    else void refreshAccessToken().then(fresh => callback({ token: fresh })).catch(() => callback({ token: '' }));
  };

  if (!arenaSocket.connected) {
    arenaSocket.connect();
  }
}

export function disconnectArenaSocket() {
  arenaSocket.disconnect();
  arenaSocket.auth = {};
}
