"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { arenaSocket } from "@/lib/arena-socket";
import { arenaService } from "@/services/arena.service";
import {
  getAudioMuted,
  subscribeAudioMuted,
} from "@/features/minigames/shared/audio-preference";
import { GameAudio } from "@/features/minigames/shared/game-audio";

type Progress = Parameters<GameAudio["update"]>[0];
type MatchEvent = { matchId: string };
type Finished = MatchEvent & { winnerId?: string | null; isDraw: boolean };
type Turn = MatchEvent & { currentTurnUserId: string; turnCount: number };

export function useArenaAudio(matchId: string, userId: string) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const current = useRef<{ matchId: string; player: GameAudio | null } | null>(
    null,
  );
  useEffect(() => {
    if (!matchId || !userId) return;
    setAudioEnabled(true);
    const session = { matchId, player: null as GameAudio | null };
    current.current = session;
    let progress: Progress = { status: "PAUSED", correct: 0 };
    let connected = arenaSocket.connected;
    let previousTurn: Turn | null = null;
    let disposed = false;
    let loading = false;
    const request = new AbortController();
    const unsubscribe = subscribeAudioMuted(() => {
      const muted = getAudioMuted();
      session.player?.setMuted(muted);
      if (muted) window.speechSynthesis?.cancel();
    });
    const sync = () =>
      session.player?.update({
        ...progress,
        status:
          progress.status === "RUNNING" && (!connected || document.hidden)
            ? "PAUSED"
            : progress.status,
      });
    const load = async () => {
      if (loading || session.player) return;
      loading = true;
      try {
        const settings = await arenaService.getMatchAudio(
          matchId,
          request.signal,
        );
        if (!disposed) {
          setAudioEnabled(settings.audioEnabled !== false);
          session.player = new GameAudio(settings);
          session.player.setMuted(getAudioMuted());
          sync();
        }
      } catch {
        /* Audio availability must not interrupt the match. Retry on reconnect. */
      } finally {
        loading = false;
      }
    };
    const start = (data: MatchEvent) => {
      if (data.matchId !== matchId || progress.status === "FINISHED") return;
      progress.status = "RUNNING";
      sync();
    };
    const stop = (data: MatchEvent) => {
      if (data.matchId !== matchId || progress.status === "FINISHED") return;
      progress.status = "PAUSED";
      sync();
    };
    const finish = (data: Finished) => {
      if (data.matchId !== matchId || progress.status === "FINISHED") return;
      progress = {
        ...progress,
        status: "FINISHED",
        lost: !data.isDraw && !!data.winnerId && data.winnerId !== userId,
      };
      sync();
    };
    const cancel = (data: MatchEvent) => finish({ ...data, isDraw: true });
    const snapshot = (data: MatchEvent & { status: string }) => {
      if (data.status === "PLAYING") start(data);
      else if (data.status !== "FINISHED") stop(data);
    };
    const turn = (data: Turn) => {
      if (data.matchId !== matchId || progress.status === "FINISHED") return;
      start(data);
      if (
        previousTurn &&
        data.turnCount > previousTurn.turnCount &&
        previousTurn.currentTurnUserId === userId
      )
        session.player?.answer(true);
      if (!previousTurn || data.turnCount >= previousTurn.turnCount)
        previousTurn = data;
    };
    const invalid = (data: MatchEvent) => {
      if (data.matchId === matchId) session.player?.answer(false);
    };
    const disconnect = () => {
      connected = false;
      sync();
    };
    const reconnect = () => {
      connected = true;
      sync();
      void load();
    };
    const unlock = () => session.player?.unlock();
    arenaSocket.on("match:start", start);
    arenaSocket.on("match:question", start);
    arenaSocket.on("friend:match-start", start);
    arenaSocket.on("friend:snapshot", snapshot);
    arenaSocket.on("word-chain:turn", turn);
    arenaSocket.on("word-chain:invalid", invalid);
    arenaSocket.on("match:finished", finish);
    arenaSocket.on("friend:match-finished", finish);
    arenaSocket.on("friend:cancelled", cancel);
    arenaSocket.on("disconnect", disconnect);
    arenaSocket.on("arena:authenticated", reconnect);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    void load();
    return () => {
      disposed = true;
      unsubscribe();
      request.abort();
      session.player?.dispose();
      if (current.current === session) current.current = null;
      arenaSocket.off("match:start", start);
      arenaSocket.off("match:question", start);
      arenaSocket.off("friend:match-start", start);
      arenaSocket.off("friend:snapshot", snapshot);
      arenaSocket.off("word-chain:turn", turn);
      arenaSocket.off("word-chain:invalid", invalid);
      arenaSocket.off("match:finished", finish);
      arenaSocket.off("friend:match-finished", finish);
      arenaSocket.off("friend:cancelled", cancel);
      arenaSocket.off("disconnect", disconnect);
      arenaSocket.off("arena:authenticated", reconnect);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [matchId, userId]);
  const playAnswer = useCallback(
    (correct: boolean) => {
      if (current.current?.matchId === matchId)
        current.current.player?.answer(correct);
    },
    [matchId],
  );
  return { playAnswer, audioEnabled };
}
