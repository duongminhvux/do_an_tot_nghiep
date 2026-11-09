"use client";
import { useEffect, useRef, useState } from "react";
import { DictationSaveWord } from "./dictation-save-word";
import styles from "./dictation-word-input.module.css";

export interface DictationWordEntry {
  id: string;
  word: string;
  ipa?: string;
  ipaUk?: string;
  audioUs?: string;
  audioUk?: string;
  note?: string;
  partOfSpeech?: string;
  examples?: string[];
  sourceUrl?: string;
  ipaDerivedFrom?: string;
  sourceName?: string;
  licenseUrl?: string;
  translationSource?: string;
  meanings: string[];
  saved?: boolean;
}
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
const normalize = (word: string) =>
  word
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}]/gu, "");

export function DictationWordInput({
  target,
  value,
  onChange,
  disabled,
  checked,
  onCheck,
  onNext,
  onHint,
  allowHint = true,
  onLookup,
  onLookupResult,
  onSave,
  onStartVoice,
  onReplay,
  isPlaying,
  canNext,
  preview = false,
  en = false,
}: {
  target: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  checked?: boolean;
  onCheck: () => void;
  onNext: () => void;
  onHint?: () => Promise<void>;
  /** Show the per-word "Reveal" hint button (admin setting). */
  allowHint?: boolean;
  onStartVoice?: () => void;
  onReplay: () => void;
  isPlaying?: boolean;
  canNext?: boolean;
  onLookup?: (word: string) => Promise<DictationWordEntry | null>;
  onSave?: (entry: DictationWordEntry) => Promise<void>;
  onLookupResult?: (entry: DictationWordEntry) => void;
  preview?: boolean;
  en?: boolean;
}) {
  const say = (vi: string, english: string) => (en ? english : vi);
  const words = target.trim().split(/\s+/),
    typed = value.split(/\s/);
  const [cursor, setCursor] = useState(() => {
    const empty = words.findIndex((_, i) => !typed[i]);
    return Math.max(0, empty < 0 ? words.length - 1 : empty - 1);
  });
  const [saveDialog, setSaveDialog] = useState<{
    entry: DictationWordEntry;
    index: number;
  } | null>(null);
  const [active, setActive] = useState<number | null>(null),
    [hints, setHints] = useState<number[]>([]);
  const [entry, setEntry] = useState<DictationWordEntry | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [listening, setListening] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]),
    recognition = useRef<Recognition | null>(null),
    alive = useRef(true),
    lookupId = useRef(0);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    alive.current = true;
    const win = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    setSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    return () => {
      alive.current = false;
      lookupId.current++;
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
      }
    };
  }, []);
  useEffect(() => {
    if (disabled) {
      recognition.current?.abort();
      setListening(false);
    }
  }, [disabled]);
  useEffect(() => {
    if (!disabled) inputs.current[cursor]?.focus({ preventScroll: true });
  }, [cursor, disabled]);
  const select = (i: number) => {
    lookupId.current++;
    setActive(i);
    setEntry(null);
    setMessage("");
  };
  const edit = (i: number, text: string) => {
    const next = Array.from(
      { length: Math.max(words.length, typed.length) },
      (_, n) => typed[n] || "",
    );
    setActive(null);
    setEntry(null);
    setMessage("");
    lookupId.current++;
    const parts = text.trim() ? text.trim().split(/\s+/) : [""];
    next.splice(i, parts.length, ...parts);
    onChange(next.join(" "));
    if (/\s/.test(text) && text.trim())
      setCursor(
        Math.min(
          words.length - 1,
          i + parts.length - (/\s$/.test(text) ? 0 : 1),
        ),
      );
  };
  const assist = async () => {
    await onHint?.();
  };
  const reveal = async () => {
    if (active === null || disabled || busy) return;
    const index = active;
    setBusy(true);
    try {
      await assist();
      if (!alive.current) return;
      setHints((old) => (old.includes(index) ? old : [...old, index]));
      edit(index, words[index]!);
      setMessage(
        say("Đã dùng gợi ý cho từ này.", "A hint was used for this word."),
      );
    } catch {
      if (alive.current)
        setMessage(
          say(
            "Chưa lưu được gợi ý. Hãy thử lại.",
            "Could not record hint. Try again.",
          ),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const lookup = async () => {
    if (active === null) return;
    const word = typed[active] || "";
    if (!word.trim()) return;
    onStartVoice?.();
    const id = ++lookupId.current;
    setBusy(true);
    setMessage("");
    setEntry(null);
    try {
      const result = await onLookup?.(word);
      if (alive.current && id === lookupId.current) {
        setEntry(result || null);
        onLookupResult?.(result || { id: "", word, meanings: [] });
        setActive(null);
        if (!result)
          setMessage(
            say(
              "Chưa có từ này trong từ điển của hệ thống.",
              "This word is not in the app dictionary yet.",
            ),
          );
      }
    } catch {
      if (alive.current && id === lookupId.current)
        setMessage(
          say("Không tra được từ. Hãy thử lại.", "Lookup failed. Try again."),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const microphone = async () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const win = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Constructor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Constructor || disabled) return;
    setMessage("");
    setBusy(true);
    try {
      await assist();
      if (!alive.current) return;
      onStartVoice?.();
      const speech = new Constructor();
      recognition.current = speech;
      speech.lang = "en-US";
      speech.continuous = false;
      speech.interimResults = false;
      speech.onresult = (e) => {
        if (alive.current) {
          onChange(
            Array.from(e.results)
              .map((result) => result[0]?.transcript || "")
              .join(" "),
          );
          setCursor(
            Math.min(
              words.length - 1,
              Array.from(e.results)
                .map((result) => result[0]?.transcript || "")
                .join(" ")
                .trim()
                .split(/\s+/).length - 1,
            ),
          );
          setMessage(
            say(
              "Đã nhập bằng giọng nói. Kiểm tra lại trước khi chấm.",
              "Voice input added. Review before checking.",
            ),
          );
        }
      };
      speech.onerror = (e) => {
        if (alive.current) {
          setListening(false);
          setMessage(
            e.error === "not-allowed"
              ? say(
                  "Micro bị từ chối. Cho phép micro trong cài đặt trình duyệt.",
                  "Microphone access denied. Allow it in your browser settings.",
                )
              : say(
                  "Không nhận được giọng nói. Thử lại hoặc nhập bằng bàn phím.",
                  "Voice recognition failed. Retry or type your answer.",
                ),
          );
        }
      };
      speech.onend = () => {
        if (alive.current) setListening(false);
      };
      speech.start();
      setListening(true);
    } catch {
      if (alive.current)
        setMessage(
          say(
            "Không bật được micro. Hãy thử lại.",
            "Could not start microphone. Try again.",
          ),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const keyDown = (event: import("react").KeyboardEvent) => {
    if (event.key === "Escape") setActive(null);
    if (!(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ))
      return;
    if (event.nativeEvent.isComposing) return;
    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      if (event.shiftKey) onNext();
      else if (value.trim() && !disabled) onCheck();
    }
  };
  const reset = () => {
    recognition.current?.abort();
    setListening(false);
    lookupId.current++;
    setCursor(0);
    setActive(null);
    setHints([]);
    setEntry(null);
    setMessage("");
    onChange("");
    requestAnimationFrame(() => inputs.current[0]?.focus());
  };
  return (
    <div className={styles.editor} onKeyDown={keyDown}>
      <button
        type="button"
        className={styles.clear}
        disabled={disabled || busy}
        onClick={reset}
        aria-label={say("Xóa nội dung", "Clear answer")}
        title={say("Xóa nội dung", "Clear answer")}
      >
        ×
      </button>
      <div
        className={styles.words}
        role="group"
        aria-label={say("Nhập lần lượt từng từ", "Sequential word entry")}
      >
        {words.map((word, i) => {
          const status =
            checked && typed[i]
              ? normalize(typed[i]!) === normalize(word)
                ? styles.correct
                : styles.wrong
              : hints.includes(i)
                ? styles.hinted
                : "";
          return (
            <span key={i} className={styles.token}>
              {i === cursor && !disabled ? (
                <span className={styles.inputSizer}>
                  <span className={styles.measure} aria-hidden="true">
                    {typed[i] ||
                      "*".repeat(Math.min(normalize(word).length, 18))}
                  </span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    aria-label={say("Từ đang nhập", "Current word")}
                    value={typed[i] || ""}
                    placeholder={"*".repeat(
                      Math.min(normalize(word).length, 18),
                    )}
                    readOnly={busy}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={status}
                    onChange={(e) => edit(i, e.target.value)}
                    onClick={() => select(i)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Backspace" &&
                        !e.currentTarget.value &&
                        i > 0
                      ) {
                        e.preventDefault();
                        setActive(null);
                        setCursor(i - 1);
                      }
                      if (e.key === " ") {
                        e.preventDefault();
                        if (e.currentTarget.value.trim()) {
                          setActive(null);
                          setCursor(Math.min(words.length - 1, i + 1));
                        }
                      }
                    }}
                  />
                </span>
              ) : typed[i] ? (
                <button
                  type="button"
                  className={`${styles.word} ${status}`}
                  onClick={() => select(i)}
                >
                  {typed[i]}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.mask}
                  aria-label={say(`Từ ẩn ${i + 1}`, `Hidden word ${i + 1}`)}
                  onClick={() => select(i)}
                >
                  {"*".repeat(Math.min(normalize(word).length, 18))}
                </button>
              )}
              {active === i && (
                <div
                  className={styles.popover}
                  role="dialog"
                  aria-label={say("Công cụ từ", "Word tools")}
                >
                  <div className={styles.menu}>
                    {!typed[i] && allowHint && (
                      <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => void reveal()}
                      >
                        ◉ {say("Hiện từ", "Reveal")}
                      </button>
                    )}
                    {typed[i] && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void lookup()}
                        >
                          ⌕ {say("Tra nghĩa", "Look up")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            onStartVoice?.();
                            setSaveDialog({
                              entry:
                                entry && entry.word === typed[i]
                                  ? entry
                                  : { id: "", word: typed[i]!, meanings: [] },
                              index: i,
                            });
                            setActive(null);
                          }}
                        >
                          {say("＋ Lưu", "＋ Save")}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={say("Đóng công cụ từ", "Close word tools")}
                      onClick={() => setActive(null)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </span>
          );
        })}
        {typed.slice(words.length).some(Boolean) && (
          <span className={styles.wrong}>
            {typed.slice(words.length).join(" ")}
          </span>
        )}
      </div>
      <div className={styles.footer}>
        <div className={styles.mode}>
          <button
            type="button"
            className={styles.microphone}
            disabled={disabled || !supported || busy}
            aria-pressed={listening}
            aria-label={say(
              listening ? "Dừng micro" : "Micro",
              listening ? "Stop microphone" : "Microphone",
            )}
            title={
              supported
                ? say(
                    "Nhập giọng nói · cần quyền micro và có thể cần mạng",
                    "Voice input · requires microphone permission and may need internet",
                  )
                : say(
                    "Trình duyệt chưa hỗ trợ nhập giọng nói",
                    "Voice input is unavailable in this browser",
                  )
            }
            onClick={() => void microphone()}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="8" y="2" width="8" height="13" rx="4" />
              <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8" />
            </svg>
          </button>
          <span
            className={styles.easy}
            title={say(
              "Nhập lần lượt · Space sang từ tiếp · Backspace để sửa từ trước",
              "Type in order · Space advances · Backspace edits the previous word",
            )}
          >
            Easy
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={disabled || busy || cursor === 0}
            onClick={() => {
              setActive(null);
              setCursor(cursor - 1);
            }}
            aria-label={say("Sửa từ trước", "Edit previous word")}
            title={say("Sửa từ trước", "Edit previous word")}
          >
            ←
          </button>
          <button
            type="button"
            onClick={onReplay}
            aria-label={say(
              isPlaying ? "Tạm dừng" : "Nghe lại",
              isPlaying ? "Pause" : "Replay",
            )}
            title={say("Nghe lại", "Replay")}
          >
            {isPlaying ? "Ⅱ" : "↻"}
          </button>
          <button type="button" disabled={!canNext || busy} onClick={onNext}>
            {say("Bỏ qua", "Skip")}
          </button>
          <button
            type="button"
            className={styles.check}
            disabled={disabled || busy || !value.trim()}
            onClick={onCheck}
          >
            {say("Kiểm tra", "Check")} →
          </button>
        </div>
      </div>
      {saveDialog && (
        <DictationSaveWord
          entry={saveDialog.entry}
          index={saveDialog.index}
          context={words.map(
            (word, i) => typed[i] || "*".repeat(Math.min(word.length, 18)),
          )}
          onClose={() => setSaveDialog(null)}
          onLookup={onLookup}
          onSave={async (saved) => {
            await onSave?.(saved);
            setEntry({ ...saved, saved: true });
          }}
          preview={preview}
          en={en}
        />
      )}
      {message && (
        <p role="status" className={styles.message}>
          {message}
        </p>
      )}
    </div>
  );
}
