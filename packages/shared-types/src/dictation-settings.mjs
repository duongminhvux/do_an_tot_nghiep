// Global Dictation practice settings shared by the API (storage + enforcement),
// the admin editor and the learner Dictation Studio. Shortcuts are stored as
// layout-independent combos built from KeyboardEvent.code, e.g. "Tab", "Alt+ArrowLeft".

export const DICTATION_SPEED_OPTIONS = Object.freeze([0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);

/** Configurable shortcut actions. Enter (check) and Shift+Enter (next sentence) are fixed in the answer box. */
export const DICTATION_SHORTCUT_ACTIONS = Object.freeze(['replay', 'prevSentence', 'nextSentence', 'reveal', 'slower', 'faster']);

export const DEFAULT_DICTATION_SETTINGS = Object.freeze({
  practice: Object.freeze({
    autoRevealEnabled: true,
    maxAttemptsBeforeReveal: 3,
    allowReveal: true,
    allowHint: true,
    autoNextEnabled: true,
    autoNextDelayMs: 700,
    autoPlayNext: true,
  }),
  checking: Object.freeze({ caseSensitive: false, punctuationSensitive: false, passScore: 100 }),
  playback: Object.freeze({ speeds: Object.freeze([0.5, 0.75, 1, 1.25, 1.5]), defaultSpeed: 1 }),
  transcript: Object.freeze({ enabled: true, requireConfirm: true }),
  display: Object.freeze({ showShortcutCard: true }),
  shortcuts: Object.freeze({
    replay: Object.freeze({ enabled: true, key: 'Tab' }),
    prevSentence: Object.freeze({ enabled: true, key: 'Alt+ArrowLeft' }),
    nextSentence: Object.freeze({ enabled: true, key: 'Alt+ArrowRight' }),
    reveal: Object.freeze({ enabled: false, key: 'Alt+A' }),
    slower: Object.freeze({ enabled: false, key: 'Alt+[' }),
    faster: Object.freeze({ enabled: false, key: 'Alt+]' }),
  }),
});

const CODE_KEYS = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
};

/** Main key of a KeyboardEvent.code, or null for modifiers / unsupported keys. */
export function keyFromCode(code) {
  if (typeof code !== 'string') return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return CODE_KEYS[code] ?? null;
}

/** Combo for a keydown event ("Ctrl" also covers ⌘ on Mac). Null while only modifiers are held. */
export function comboFromEvent(event) {
  const key = keyFromCode(event.code);
  if (!key) return null;
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

const VALID_KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Space|Enter|Tab|Escape|Backspace|Arrow(?:Up|Down|Left|Right)|Home|End|PageUp|PageDown|[[\],./;'\-=`\\])$/;
const COMBO = /^(Ctrl\+)?(Alt\+)?(Shift\+)?(.+)$/;

/** Fixed keys of the answer box, plus browser / OS / text-editing combos a page must not take over. */
export const RESERVED_DICTATION_COMBOS = Object.freeze([
  'Enter', 'Shift+Enter', 'Escape', 'Shift+Tab', 'Backspace', 'Space',
  'F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12', 'Ctrl+F5', 'Alt+F4', 'Alt+Home', 'Alt+D', 'Alt+F', 'Alt+E',
  'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+W', 'Ctrl+Shift+W', 'Ctrl+T', 'Ctrl+Shift+T', 'Ctrl+N', 'Ctrl+Shift+N',
  'Ctrl+R', 'Ctrl+Shift+R', 'Ctrl+L', 'Ctrl+D', 'Ctrl+H', 'Ctrl+J', 'Ctrl+K', 'Ctrl+E', 'Ctrl+P', 'Ctrl+S', 'Ctrl+O',
  'Ctrl+F', 'Ctrl+G', 'Ctrl+U', 'Ctrl+Q', 'Ctrl+Shift+Q', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Shift+Delete',
  'Ctrl+A', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+Shift+V', 'Ctrl+B', 'Ctrl+I',
  'Ctrl+ArrowLeft', 'Ctrl+ArrowRight', 'Ctrl+Shift+ArrowLeft', 'Ctrl+Shift+ArrowRight', 'Ctrl+Backspace', 'Ctrl+Home', 'Ctrl+End',
  'Ctrl+Space', 'Ctrl+Shift+Space', 'Ctrl+-', 'Ctrl+=', 'Ctrl+0', 'Ctrl+Shift+=',
  ...Array.from({ length: 9 }, (_, index) => `Ctrl+${index + 1}`),
]);
const RESERVED = new Set(RESERVED_DICTATION_COMBOS);
/** Plain keys that don't type a character, so they are safe while the answer box has focus. */
const SAFE_PLAIN_KEYS = new Set(['Tab', 'F2', 'F4', 'F8', 'F9', 'F10']);

export function parseCombo(combo) {
  const match = typeof combo === 'string' ? COMBO.exec(combo) : null;
  if (!match || !VALID_KEY.test(match[4])) return null;
  return { ctrl: !!match[1], alt: !!match[2], shift: !!match[3], key: match[4] };
}

/** Why a combo can't be used, or null when it is fine: "invalid" | "reserved" | "needs_modifier". */
export function shortcutProblem(combo) {
  const parsed = parseCombo(combo);
  if (!parsed) return 'invalid';
  if (RESERVED.has(combo)) return 'reserved';
  // Shortcuts fire while the learner types, so a plain/Shift+ key would eat characters.
  if (!parsed.ctrl && !parsed.alt && !SAFE_PLAIN_KEYS.has(parsed.key)) return 'needs_modifier';
  return null;
}

/** Pairs of enabled actions that share a combo. */
export function shortcutConflicts(shortcuts) {
  const conflicts = [];
  const ids = DICTATION_SHORTCUT_ACTIONS;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = shortcuts?.[ids[i]];
      const b = shortcuts?.[ids[j]];
      if (a?.enabled && b?.enabled && a.key === b.key) conflicts.push([ids[i], ids[j]]);
    }
  }
  return conflicts;
}

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
function int(value, fallback, min, max) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
const section = (source, key) => (isObject(source[key]) ? source[key] : {});

/** Fill gaps with defaults and clamp everything into safe ranges. Never throws. */
export function normalizeDictationSettings(input) {
  const source = isObject(input) ? input : {};
  const d = DEFAULT_DICTATION_SETTINGS;
  const practice = section(source, 'practice');
  const checking = section(source, 'checking');
  const playback = section(source, 'playback');
  const transcript = section(source, 'transcript');
  const display = section(source, 'display');
  const shortcuts = section(source, 'shortcuts');

  const picked = Array.isArray(playback.speeds)
    ? DICTATION_SPEED_OPTIONS.filter((speed) => playback.speeds.includes(speed))
    : [...d.playback.speeds];
  const speeds = picked.includes(1) ? picked : [...picked, 1].sort((a, b) => a - b);
  const defaultSpeed = speeds.includes(playback.defaultSpeed) ? playback.defaultSpeed : 1;

  const normalizedShortcuts = {};
  for (const id of DICTATION_SHORTCUT_ACTIONS) {
    const fallback = d.shortcuts[id];
    const value = section(shortcuts, id);
    const key = typeof value.key === 'string' && !shortcutProblem(value.key) ? value.key : fallback.key;
    normalizedShortcuts[id] = { enabled: bool(value.enabled, fallback.enabled), key };
  }
  // Two enabled actions on one combo: keep the first, switch the later one off.
  for (const [, later] of shortcutConflicts(normalizedShortcuts)) normalizedShortcuts[later].enabled = false;

  return {
    practice: {
      autoRevealEnabled: bool(practice.autoRevealEnabled, d.practice.autoRevealEnabled),
      maxAttemptsBeforeReveal: int(practice.maxAttemptsBeforeReveal, d.practice.maxAttemptsBeforeReveal, 1, 20),
      allowReveal: bool(practice.allowReveal, d.practice.allowReveal),
      allowHint: bool(practice.allowHint, d.practice.allowHint),
      autoNextEnabled: bool(practice.autoNextEnabled, d.practice.autoNextEnabled),
      autoNextDelayMs: int(practice.autoNextDelayMs, d.practice.autoNextDelayMs, 0, 10000),
      autoPlayNext: bool(practice.autoPlayNext, d.practice.autoPlayNext),
    },
    checking: {
      caseSensitive: bool(checking.caseSensitive, d.checking.caseSensitive),
      punctuationSensitive: bool(checking.punctuationSensitive, d.checking.punctuationSensitive),
      passScore: int(checking.passScore, d.checking.passScore, 50, 100),
    },
    playback: { speeds, defaultSpeed },
    transcript: {
      enabled: bool(transcript.enabled, d.transcript.enabled),
      requireConfirm: bool(transcript.requireConfirm, d.transcript.requireConfirm),
    },
    display: { showShortcutCard: bool(display.showShortcutCard, d.display.showShortcutCard) },
    shortcuts: normalizedShortcuts,
  };
}

const KEY_LABELS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc' };
/** Display text for a combo, e.g. "Alt+ArrowLeft" → "Alt + ←". */
export function comboLabel(combo) {
  const parsed = parseCombo(combo);
  if (!parsed) return '';
  return [parsed.ctrl && 'Ctrl', parsed.alt && 'Alt', parsed.shift && 'Shift', KEY_LABELS[parsed.key] ?? parsed.key]
    .filter(Boolean)
    .join(' + ');
}
