"use client";

import { useEffect, useRef, useState } from "react";
import type { ClockState } from "./use-toeic-attempt";

function format(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Shows the attempt clock: time left for timed attempts, time spent otherwise.
 * Both come from the server and only advance locally while it is running, so
 * time away from the page is never shown as spent. Calls `onExpire` once when
 * a timed attempt reaches zero.
 */
export function AttemptTimer({
  clock,
  onExpire,
}: {
  clock: ClockState;
  onExpire: () => void;
}) {
  const running = clock.status === "IN_PROGRESS" && !clock.paused;
  const [now, setNow] = useState(() => Date.now());
  const expireRef = useRef(onExpire);
  const fired = useRef(false);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, clock.syncedAt]);

  const ticked = running ? Math.max(0, Math.floor((now - clock.syncedAt) / 1000)) : 0;
  const timed = clock.remainingSeconds !== undefined;
  const remaining = timed ? Math.max(0, clock.remainingSeconds! - ticked) : 0;
  const shown = timed ? remaining : (clock.activeSeconds ?? 0) + ticked;

  useEffect(() => {
    if (!timed || !running || remaining > 0 || fired.current) return;
    fired.current = true;
    expireRef.current();
  }, [timed, running, remaining]);

  const tone = !timed
    ? "text-slate-800"
    : remaining <= 300
      ? "text-red-600"
      : remaining <= 600
        ? "text-amber-600"
        : "text-slate-800";
  return (
    <span
      className={`tabular-nums ${tone} ${timed && running && remaining <= 60 ? "animate-pulse" : ""} ${running ? "" : "opacity-60"}`}
    >
      {format(shown)}
    </span>
  );
}
