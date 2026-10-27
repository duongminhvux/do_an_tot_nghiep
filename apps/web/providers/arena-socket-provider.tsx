// src/components/providers/arena-socket-provider.tsx

"use client";

import { useEffect, useRef } from "react";
import { useAppSelector } from "@/redux/hooks";
import { isAccessTokenValid } from "@/lib/access-token";
import { FriendlyInvitations } from "@/components/friendly-invitations";
import {
  arenaSocket,
  connectArenaSocket,
  disconnectArenaSocket,
} from "@/lib/arena-socket";

export function ArenaSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isInitialized, isAuthenticated, accessToken, user } = useAppSelector(
    (state) => state.auth,
  );

  const connectedUserId = useRef<string | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      console.log("Arena socket connected:", arenaSocket.id);
    };

    const handleDisconnect = (reason: string) => {
      console.log("Arena socket disconnected:", reason);
    };

    const handleConnectError = (error: Error) => {
      console.error("Arena socket error:", error.message);
    };

    arenaSocket.on("connect", handleConnect);
    arenaSocket.on("disconnect", handleDisconnect);
    arenaSocket.on("connect_error", handleConnectError);

    const heartbeat = window.setInterval(() => {
      if (arenaSocket.connected) arenaSocket.emit("arena:presence-heartbeat");
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      arenaSocket.off("connect", handleConnect);
      arenaSocket.off("disconnect", handleDisconnect);
      arenaSocket.off("connect_error", handleConnectError);

      connectedUserId.current = null;
      disconnectArenaSocket();
    };
  }, []);

  useEffect(() => {
    if (
      isInitialized &&
      isAuthenticated &&
      user?._id &&
      user?.role !== "ADMIN" &&
      isAccessTokenValid(accessToken)
    ) {
      // Refreshing the same account's access token must not leave its queue/room.
      // Update the handshake token for the next reconnect, keeping the live socket.
      if (connectedUserId.current && connectedUserId.current !== user._id)
        disconnectArenaSocket();
      connectedUserId.current = user._id;
      connectArenaSocket(accessToken);
    } else {
      connectedUserId.current = null;
      disconnectArenaSocket();
    }

  }, [isInitialized, isAuthenticated, accessToken, user?._id, user?.role]);

  return (
    <>
      {children}
      <FriendlyInvitations />
    </>
  );
}
