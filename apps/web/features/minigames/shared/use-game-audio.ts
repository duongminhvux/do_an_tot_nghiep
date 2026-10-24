"use client";

import { useCallback, useEffect, useRef } from "react";
import { getAudioMuted, subscribeAudioMuted } from "./audio-preference";
import { GameAudio } from "./game-audio";
import type { GameAudioSettings } from "./audio-settings";

export function useGameAudio(
  settings: GameAudioSettings,
  state: {
    status: "RUNNING" | "PAUSED" | "FINISHED";
    correct: number;
    wrong?: number;
  },
) {
  const audio = useRef<GameAudio | null>(null);
  useEffect(() => {
    const player = new GameAudio(settings);
    audio.current = player;
    player.setMuted(getAudioMuted());
    const unsubscribe = subscribeAudioMuted(() =>
      player.setMuted(getAudioMuted()),
    );
    const unlock = () => player.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unsubscribe();
      player.dispose();
      audio.current = null;
    };
  }, [settings]);
  useEffect(() => {
    audio.current?.update({
      status: state.status,
      correct: state.correct,
      wrong: state.wrong,
    });
  }, [settings, state.status, state.correct, state.wrong]);
  return useCallback(() => audio.current?.wrong(), []);
}
