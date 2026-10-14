"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import apiClient from "@/lib/axios";
import { arenaSocket } from "@/lib/arena-socket";
import { store } from "@/redux/store";

export function useMatchExit(matchId: string, active: boolean) {
  const pathname = usePathname();
  const state = useRef({ matchId, active });
  if (state.current.matchId !== matchId) state.current = { matchId, active };
  else state.current.active = active;
  useEffect(() => {
    const match = state.current;
    let sent = false;
    const leave = () => {
      if (sent || !match.active) return;
      sent = true;
      arenaSocket.emit("match:leave", { matchId: match.matchId });
      const token = store.getState().auth.accessToken;
      if (token)
        void fetch(
          `${apiClient.defaults.baseURL}/arena/matches/${match.matchId}/leave`,
          {
            method: "POST",
            keepalive: true,
            credentials: "include",
            headers: { Authorization: `Bearer ${token}` },
          },
        ).catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      // Defer so React's development effect replay cannot forfeit a live match.
      queueMicrotask(() => {
        if (window.location.pathname !== pathname) leave();
      });
    };
  }, [matchId, pathname]);
}
