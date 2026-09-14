"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

let activeAudio: HTMLAudioElement | null = null;

export function UnifiedAudioPlayer({
  sourceUrl,
  duration = 0,
  compact = false,
  disabled = false,
}: {
  sourceUrl?: string;
  duration?: number;
  compact?: boolean;
  disabled?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "playing" | "paused" | "error"
  >("idle");
  const [time, setTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(duration);
  const [speed, setSpeed] = useState(1);
  const unavailable = disabled || !sourceUrl;

  useEffect(() => () => audioRef.current?.pause(), []);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const startPlayback = async (audio: HTMLAudioElement) => {
    try {
      setState("loading");
      if (activeAudio && activeAudio !== audio) activeAudio.pause();
      activeAudio = audio;
      audio.playbackRate = speed;
      await audio.play();
      setState("playing");
    } catch {
      setState("error");
    }
  };
  const play = async () => {
    const audio = audioRef.current;
    if (!audio || unavailable) return;
    if (state === "playing") {
      audio.pause();
      setState("paused");
      return;
    }
    await startPlayback(audio);
  };

  const replay = async () => {
    const audio = audioRef.current;
    if (!audio || unavailable) return;
    audio.currentTime = 0;
    setTime(0);
    await startPlayback(audio);
  };
  const total = Number.isFinite(mediaDuration) ? mediaDuration : duration;
  const fmt = (value: number) =>
    `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        compact ? "p-3" : "p-4",
      )}
    >
      <audio
        ref={audioRef}
        src={sourceUrl}
        preload="metadata"
        onLoadedMetadata={(event) =>
          setMediaDuration(event.currentTarget.duration)
        }
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlaying={() => setState("playing")}
        onPause={() => state === "playing" && setState("paused")}
        onWaiting={() => setState("loading")}
        onEnded={() => setState("idle")}
        onError={() => setState("error")}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={play}
          disabled={unavailable || state === "error"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300"
          aria-label={state === "playing" ? "Pause audio" : "Play audio"}
        >
          {state === "loading" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : state === "playing" ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
        <span className="w-20 text-xs font-semibold tabular-nums">
          {fmt(time)} / {fmt(total)}
        </span>
        <div
          className="relative h-8 flex-1"
          role="progressbar"
          aria-label="Audio progress"
          aria-valuenow={time}
          aria-valuemax={total}
        >
          <div className="admin-wave absolute inset-0" />
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-blue-600"
            style={{ width: `${total ? (time / total) * 100 : 0}%` }}
          />
        </div>
        <Volume2 className="size-4 text-slate-500" />
        <button
          onClick={() =>
            setSpeed(speed === 1.25 ? 0.75 : speed === 0.75 ? 1 : 1.25)
          }
          className="min-h-10 px-2 text-xs font-bold"
        >
          {speed}x
        </button>
        <button
          onClick={replay}
          disabled={unavailable}
          className="grid size-10 place-items-center rounded-lg hover:bg-slate-100 disabled:text-slate-300"
          aria-label="Replay audio"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
      {(unavailable || state === "error") && (
        <p className="mt-2 text-xs text-red-600">Audio is unavailable</p>
      )}
    </div>
  );
}
