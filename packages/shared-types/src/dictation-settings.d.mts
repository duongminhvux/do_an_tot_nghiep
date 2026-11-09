export type DictationShortcutAction = 'replay' | 'prevSentence' | 'nextSentence' | 'reveal' | 'slower' | 'faster';
export interface DictationShortcut { enabled: boolean; key: string }
export interface DictationSettings {
  practice: {
    autoRevealEnabled: boolean;
    maxAttemptsBeforeReveal: number;
    allowReveal: boolean;
    allowHint: boolean;
    autoNextEnabled: boolean;
    autoNextDelayMs: number;
    autoPlayNext: boolean;
  };
  checking: { caseSensitive: boolean; punctuationSensitive: boolean; passScore: number };
  playback: { speeds: number[]; defaultSpeed: number };
  transcript: { enabled: boolean; requireConfirm: boolean };
  display: { showShortcutCard: boolean };
  shortcuts: Record<DictationShortcutAction, DictationShortcut>;
}
export type DictationShortcutProblem = 'invalid' | 'reserved' | 'needs_modifier';
export declare const DICTATION_SPEED_OPTIONS: readonly number[];
export declare const DICTATION_SHORTCUT_ACTIONS: readonly DictationShortcutAction[];
export declare const DEFAULT_DICTATION_SETTINGS: Readonly<DictationSettings>;
export declare const RESERVED_DICTATION_COMBOS: readonly string[];
export declare function keyFromCode(code: string): string | null;
export declare function comboFromEvent(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string | null;
export declare function parseCombo(combo: string): { ctrl: boolean; alt: boolean; shift: boolean; key: string } | null;
export declare function shortcutProblem(combo: string): DictationShortcutProblem | null;
export declare function shortcutConflicts(shortcuts: Partial<Record<DictationShortcutAction, DictationShortcut>>): [DictationShortcutAction, DictationShortcutAction][];
export declare function normalizeDictationSettings(input?: unknown): DictationSettings;
export declare function comboLabel(combo: string): string;
