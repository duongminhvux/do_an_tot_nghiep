"use client";
import { useEffect, useRef } from "react";
import { automaticTypingTarget } from "../typing-rush/engine/typing-rush-engine";
import type { TypingProgress } from "../typing-rush/engine/typing-rush-engine";
import type { FallingWord } from "../typing-rush/types";

export function useAutomaticWordCompletion({
  words,
  progress,
  elapsed,
  enabled,
  onComplete,
}: {
  words: FallingWord[];
  progress: TypingProgress;
  elapsed: number;
  enabled: boolean;
  onComplete: () => void;
}) {
  const previous = useRef(progress);
  const typedAt = useRef(elapsed);
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  });
  useEffect(() => {
    if (
      previous.current.answer !== progress.answer ||
      previous.current.targetId !== progress.targetId ||
      previous.current.locked !== progress.locked
    ) {
      previous.current = progress;
      typedAt.current = elapsed;
    }
    // Game time freezes during pause; animation renders never restart the wait.
    if (
      enabled &&
      automaticTypingTarget(words, progress, elapsed - typedAt.current)
    ) {
      typedAt.current = elapsed;
      complete.current();
    }
  }, [words, progress, elapsed, enabled]);
}
