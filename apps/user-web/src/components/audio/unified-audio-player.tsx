"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import { useAudioStore } from "@/stores/audio-store";

type PlayerState =
  | "IDLE"
  | "LOADING"
  | "PLAYING"
  | "PAUSED"
  | "ENDED"
  | "ERROR"
  | "DISABLED"
  | "LISTEN_LIMIT_REACHED";

interface Props {
  id: string;
  sourceUrl?: string;
  duration?: number;
  currentListenCount?: number;
  maximumListenCount?: number;
  playbackRate?: number;
  disabled?: boolean;
  variant?: "compact" | "full";
  onPlay?: () => void;
  onEnded?: () => void;
  onListenCountConsumed?: () => Promise<number | void> | number | void;
  onError?: (error: Error) => void;
}

export function UnifiedAudioPlayer({
  id,
  sourceUrl,
  duration = 0,
  currentListenCount = 0,
  maximumListenCount,
  playbackRate = 1,
  disabled,
  variant = "full",
  onPlay,
  onEnded,
  onListenCountConsumed,
  onError,
}: Props) {
  const unavailable = disabled || !sourceUrl;
  const [state, setState] = useState<PlayerState>(
    unavailable ? "DISABLED" : "IDLE",
  );
  const [time, setTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(duration);
  const [speed, setSpeed] = useState(playbackRate);
  const [listens, setListens] = useState(currentListenCount);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playPending = useRef(false);
  const consumedSession = useRef(false);
  const mounted = useRef(true);
  const { activeId, setActive } = useAudioStore();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      audioRef.current?.pause();
      if (useAudioStore.getState().activeId === id) setActive(null);
    };
  }, [id, setActive]);

  useEffect(() => {
    if (activeId !== id && state === "PLAYING") {
      audioRef.current?.pause();
      setState("PAUSED");
    }
  }, [activeId, id, state]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    setListens(currentListenCount);
  }, [currentListenCount]);

  const fail = (value: unknown) => {
    const error =
      value instanceof Error ? value : new Error("Audio is unavailable.");
    if (mounted.current) setState("ERROR");
    onError?.(error);
  };

  const startPlayback = async (
    audio: HTMLAudioElement,
    newSession: boolean,
  ) => {
    if (
      newSession &&
      maximumListenCount !== undefined &&
      listens >= maximumListenCount
    ) {
      setState("LISTEN_LIMIT_REACHED");
      return;
    }

    playPending.current = true;
    setState("LOADING");
    try {
      if (audio.ended) audio.currentTime = 0;
      audio.playbackRate = speed;
      await audio.play();
      if (!mounted.current) return;
      if (newSession) {
        const updated = await onListenCountConsumed?.();
        if (!mounted.current) return;
        setListens((current) =>
          typeof updated === "number" ? updated : current + 1,
        );
        consumedSession.current = true;
      }
      setActive(id);
      setState("PLAYING");
      onPlay?.();
    } catch (error) {
      audio.pause();
      fail(error);
    } finally {
      playPending.current = false;
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || unavailable || playPending.current) return;
    if (state === "PLAYING") {
      audio.pause();
      setState("PAUSED");
      return;
    }
    await startPlayback(audio, !consumedSession.current || audio.ended);
  };

  const replay = async () => {
    const audio = audioRef.current;
    if (!audio || unavailable || playPending.current) return;
    audio.pause();
    audio.currentTime = 0;
    setTime(0);
    consumedSession.current = false;
    setState("IDLE");
    await startPlayback(audio, true);
  };

  const seek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration, ratio * audio.duration),
    );
    setTime(audio.currentTime);
  };

  const label =
    state === "ERROR" || unavailable
      ? "Audio is unavailable"
      : state === "LISTEN_LIMIT_REACHED"
        ? "Listen limit reached"
        : state === "LOADING"
          ? "Loading audio…"
          : state === "PAUSED"
            ? "Paused"
            : state === "PLAYING"
              ? "Playing"
              : "Ready to listen";
  const safeDuration = Number.isFinite(mediaDuration)
    ? mediaDuration
    : duration;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        variant === "full" ? "p-4" : "p-3",
      )}
    >
      <audio
        ref={audioRef}
        src={sourceUrl}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setMediaDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : duration,
          );
          setState("IDLE");
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onWaiting={() => state === "PLAYING" && setState("LOADING")}
        onPlaying={() => setState("PLAYING")}
        onPause={() => state === "PLAYING" && setState("PAUSED")}
        onEnded={() => {
          setState("ENDED");
          consumedSession.current = false;
          setActive(null);
          onEnded?.();
        }}
        onError={() => fail(new Error("Audio is unavailable."))}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={
            unavailable || state === "ERROR" || state === "LISTEN_LIMIT_REACHED"
          }
          className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300"
          aria-label={state === "PLAYING" ? "Pause audio" : "Play audio"}
        >
          {state === "LOADING" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : state === "PLAYING" ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
        <span className="w-20 text-xs font-semibold tabular-nums text-slate-600">
          {formatDuration(Math.floor(time))} /{" "}
          {formatDuration(Math.floor(safeDuration))}
        </span>
        <div
          className="relative h-8 flex-1 cursor-pointer"
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={safeDuration}
          aria-valuenow={time}
          tabIndex={0}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            seek((event.clientX - rect.left) / rect.width);
          }}
        >
          <div className="wave absolute inset-0 opacity-80" />
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-blue-600"
            style={{
              width: `${safeDuration ? (time / safeDuration) * 100 : 0}%`,
            }}
          />
        </div>
        <Volume2 className="hidden size-4 text-slate-500 sm:block" />
        <button
          className="min-h-10 rounded-lg px-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          onClick={() =>
            setSpeed(speed === 1.25 ? 0.75 : speed === 0.75 ? 1 : 1.25)
          }
          aria-label={`Playback speed ${speed}x`}
        >
          {speed}x
        </button>
        {variant === "full" && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Replay audio"
            onClick={replay}
            disabled={unavailable}
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        {maximumListenCount !== undefined && (
          <span>
            {listens} / {maximumListenCount} listens used
          </span>
        )}
      </div>
    </div>
  );
}
