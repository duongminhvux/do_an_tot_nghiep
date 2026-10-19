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
