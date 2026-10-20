"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import apiClient from "@/lib/axios";
import { arenaSocket } from "@/lib/arena-socket";
import { store } from "@/redux/store";

export function useMatchExit(
  matchId: string,
  active: boolean,
  preserveDestinations: string[] = [],
  reconnectOnRefresh = false,
) {
  const pathname = usePathname();
  const state = useRef({ matchId, active, preserveDestinations });
  if (state.current.matchId !== matchId)
    state.current = { matchId, active, preserveDestinations };
  else {
    state.current.active = active;
    state.current.preserveDestinations = preserveDestinations;
  }
  useEffect(() => {
    const match = state.current;
    const initialDestination = pathname + window.location.search;
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
    if (!reconnectOnRefresh) window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      // Defer so React's development effect replay cannot forfeit a live match.
      queueMicrotask(() => {
        const destination = window.location.pathname + window.location.search;
        if (
          destination !== initialDestination &&
          !match.preserveDestinations.includes(destination)
        )
          leave();
      });
    };
  }, [matchId, pathname, reconnectOnRefresh]);
}
