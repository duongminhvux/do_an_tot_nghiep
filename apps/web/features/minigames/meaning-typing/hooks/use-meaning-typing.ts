"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MeaningTypingEngine } from "../engine/meaning-typing-engine";
import type { GameSession } from "../types";
export function useMeaningTyping(session: GameSession) {
  const engine = useMemo(() => new MeaningTypingEngine(session), [session]);
  const [state, setState] = useState(() => engine.snapshot());
  const [countdown, setCountdown] = useState<number | null>(null);
  const sync = useCallback(() => setState(engine.snapshot()), [engine]);
  const pause = useCallback(() => {
    setCountdown(null);
    engine.pause();
    sync();
  }, [engine, sync]);
  const resume = useCallback(() => {
    if (engine.snapshot().status === "PAUSED") setCountdown(3);
  }, [engine]);
  useEffect(() => {
    if (state.status !== "RUNNING") return;
    let frameId = 0,
      last: number | null = null;
    const frame = (now: number) => {
      engine.advance(last === null ? 0 : now - last);
      last = now;
      sync();
      if (engine.snapshot().status === "RUNNING")
        frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [engine, sync, state.status]);
  useEffect(() => {
    if (countdown === null) return;
    const timer = window.setTimeout(
      () => {
        if (countdown > 0) setCountdown(countdown - 1);
        else {
          engine.resume();
          setCountdown(null);
          sync();
        }
      },
      countdown === 0 ? 350 : 1000,
    );
    return () => window.clearTimeout(timer);
  }, [countdown, engine, sync]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || engine.snapshot().status === "FINISHED")
        return;
      event.preventDefault();
      if (engine.snapshot().status === "RUNNING" || countdown !== null) pause();
      else resume();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", key);
    };
  }, [engine, pause, resume, countdown]);
  const submit = (answer: string) => {
    const hit = engine.submit(answer);
    sync();
    return hit;
  };
  const resize = useCallback(
    (width: number) => {
      engine.resize(width);
      sync();
    },
    [engine, sync],
  );
  const revealHint = useCallback(
    (instanceId: string) => {
      engine.revealHint(instanceId);
      sync();
    },
    [engine, sync],
  );
  return { state, countdown, pause, resume, submit, resize, revealHint };
}
