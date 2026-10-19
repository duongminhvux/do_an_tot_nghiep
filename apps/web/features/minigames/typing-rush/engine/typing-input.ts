type TypingKey = Pick<
  KeyboardEvent,
  "code" | "key" | "ctrlKey" | "metaKey" | "altKey"
>;
// Use the physical English letter key, even if an IME reports Process or a composed key.
export function englishTypingKey(event: TypingKey): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (event.code === "Space") return " ";
  if (event.code === "Quote") return "'";
  if (event.code === "Minus") return "-";
  // Virtual keyboards may not supply a physical code. Accept only plain English characters.
  return /^[a-z '-]$/i.test(event.key) ? event.key.toLowerCase() : null;
}
export type GameTypingAction =
  | { type: "character"; character: string }
  | { type: "reset" }
  | { type: "confirm" }
  | { type: "cycle"; direction: number };
export function gameTypingAction(
  event: TypingKey &
    Pick<KeyboardEvent, "isComposing" | "keyCode" | "repeat"> & {
      shiftKey?: boolean;
    },
): GameTypingAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
    return null;
  if (event.code === "Backspace" || event.key === "Backspace") {
    // IME composition can emit deletion events while replacing composed text.
    return event.isComposing || event.keyCode === 229
      ? null
      : { type: "reset" };
  }
  if (event.code === "Tab" || event.key === "Tab")
    return { type: "cycle", direction: event.shiftKey ? -1 : 1 };
  if (event.code === "Enter" || event.key === "Enter")
    return event.isComposing || event.keyCode === 229
      ? null
      : { type: "confirm" };
  const character = englishTypingKey(event);
  return character === null ? null : { type: "character", character };
}
export function meaningPopupPosition(
  notice: { x: number; y: number; width: number },
  fieldWidth: number,
  fieldHeight: number,
) {
  const width = Math.min(280, Math.max(1, fieldWidth - 24));
  const left = Math.max(
    12,
    Math.min(notice.x + notice.width / 2 - width / 2, fieldWidth - width - 12),
  );
  const top = Math.max(8, Math.min(notice.y, fieldHeight - 96));
  return { left, top, width };
}
