// src/components/providers/arena-socket-provider.tsx

"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/redux/hooks";
import { isAccessTokenValid } from "@/lib/access-token";
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

    return () => {
      arenaSocket.off("connect", handleConnect);
      arenaSocket.off("disconnect", handleDisconnect);
      arenaSocket.off("connect_error", handleConnectError);

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
      connectArenaSocket(accessToken);
    } else {
      disconnectArenaSocket();
    }

    return disconnectArenaSocket;
  }, [isInitialized, isAuthenticated, accessToken, user?._id, user?.role]);

  return children;
}
