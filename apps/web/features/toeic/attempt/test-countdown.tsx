"use client";

import { useEffect, useRef, useState } from "react";

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Counts down to `deadline` and calls `onExpire` once when it is reached. */
export function TestCountdown({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire: () => void;
}) {
  const end = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  const expireRef = useRef(onExpire);
  const fired = useRef(false);
  expireRef.current = onExpire;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    expireRef.current();
  }, [remaining]);

  const tone =
    remaining <= 300
      ? "text-red-600"
      : remaining <= 600
        ? "text-amber-600"
        : "text-slate-800";
  return (
    <span className={`tabular-nums ${tone} ${remaining <= 60 ? "animate-pulse" : ""}`}>
      {clock(remaining)}
    </span>
  );
}
