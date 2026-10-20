"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { gameTypingAction } from "../typing-rush/engine/typing-input";

export function useEnglishGameKeyboard({
  enabled,
  field,
  onCharacter,
  onReset,
  onConfirm,
  onCycle,
}: {
  enabled: boolean;
  field: RefObject<HTMLDivElement | null>;
  onCharacter: (character: string) => void;
  onReset: () => void;
  onConfirm: () => void;
  onCycle: (direction: number) => void;
}) {
  const handlers = useRef({ onCharacter, onReset, onConfirm, onCycle });
  useEffect(() => {
    handlers.current = { onCharacter, onReset, onConfirm, onCycle };
  });
  useEffect(() => {
    if (!enabled) return;
    // A non-editable focused surface avoids a text input that an IME can rewrite.
    field.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const origin = event.target;
      if (
        origin instanceof HTMLElement &&
        origin.closest(
          'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      const action = gameTypingAction(event);
      if (!action) return;
      event.preventDefault();
      if (action.type === "reset") handlers.current.onReset();
      else if (action.type === "confirm") handlers.current.onConfirm();
      else if (action.type === "cycle")
        handlers.current.onCycle(action.direction);
      else handlers.current.onCharacter(action.character);
    };
    window.addEventListener("keydown", handleKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKey, { capture: true });
  }, [enabled, field]);
}
