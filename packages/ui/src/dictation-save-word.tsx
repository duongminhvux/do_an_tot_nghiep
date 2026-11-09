"use client";
import { useEffect, useRef, useState } from "react";
import type { DictationWordEntry } from "./dictation-word-input";
import styles from "./dictation-save-word.module.css";

export function DictationSaveWord({
  entry,
  context,
  index,
  onClose,
  onSave,
  onLookup,
  preview,
  en = false,
}: {
  entry: DictationWordEntry;
  context: string[];
  index: number;
  onClose: () => void;
  onSave?: (entry: DictationWordEntry) => Promise<void>;
  onLookup?: (word: string) => Promise<DictationWordEntry | null>;
  preview?: boolean;
  en?: boolean;
}) {
  const say = (vi: string, english: string) => (en ? english : vi);
  const dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    dirty = useRef(false),
    heading = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState(entry.word),
    [ipa, setIpa] = useState(entry.ipa || ""),
    [translation, setTranslation] = useState(entry.meanings.join("\n").slice(0,2000)),
    [note, setNote] = useState(""),
    [range, setRange] = useState([index, index]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    heading.current?.focus();
    return () => {
      alive.current = false;
      dialog.current?.close();
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    if (onLookup && !entry.meanings.length)
      void onLookup(entry.word)
        .then((found) => {
          if (!disposed && !dirty.current && found) {
            setIpa(found.ipa || "");
            setTranslation(found.meanings.join("\n").slice(0,2000));
          }
        })
        .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  const select = (i: number) => {
    const [start, end] = range as [number, number];
    let next: [number, number];
    if (i === start && start < end) next = [start + 1, end];
    else if (i === end && end > start) next = [start, end - 1];
    else next = [Math.min(start, i), Math.max(end, i)];
    if (context.slice(next[0], next[1] + 1).some((w) => /^\*+$/.test(w)))
      return;
    dirty.current = true;
    setRange(next);
    setWord(
      context
        .slice(next[0], next[1] + 1)
        .join(" ")
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
    );
    setIpa("");
    setTranslation("");
  };
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="save-word-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (preview || !onSave || busy) return;
          setBusy(true);
          setError("");
          try {
            await onSave({
              ...entry,
              id: "",
              word: word.trim(),
              ipa,
              meanings: translation.trim() ? [translation.trim()] : [],
              note,
            });
            if (alive.current) onClose();
          } catch {
            if (alive.current)
              setError(
                say(
                  "Chưa lưu được. Kiểm tra từ/cụm từ và thử lại.",
                  "Could not save. Check the word or phrase and try again.",
                ),
              );
          } finally {
            if (alive.current) setBusy(false);
          }
        }}
      >
        <header>
          <h2 id="save-word-title">
            {say("Thêm từ hoặc cụm từ", "Add a word or phrase")}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label={say("Đóng hộp lưu từ", "Close save word dialog")}
          >
            ×
          </button>
        </header>
        <div className={styles.fields}>
          <label>
            {say("Từ hoặc cụm từ", "Word or phrase")}
            <input
              ref={heading}
              required
              maxLength={100}
              value={word}
              disabled={busy}
              onChange={(e) => {
                dirty.current = true;
                setWord(e.target.value);
              }}
            />
          </label>
          <label>
            IPA · US
            <input
              maxLength={200}
              value={ipa}
              disabled={busy}
              onChange={(e) => {
                dirty.current = true;
                setIpa(e.target.value);
              }}
              placeholder="/…/"
            />
          </label>
        </div>
        <div
          className={styles.context}
          aria-label={say(
            "Chọn cụm từ trong câu",
            "Select phrase from sentence",
          )}
        >
          {context.map((text, i) => (
            <button
              type="button"
              key={i}
              disabled={busy || /^\*+$/.test(text)}
              aria-pressed={i >= range[0]! && i <= range[1]!}
              onClick={() => select(i)}
            >
              {text}
            </button>
          ))}
        </div>
        <label>
          {say("Nghĩa / bản dịch", "Translation")}
          <textarea
            aria-label={say("Nghĩa / bản dịch", "Translation")}
            rows={3}
            maxLength={2000}
            disabled={busy}
            value={translation}
            onChange={(e) => {
              dirty.current = true;
              setTranslation(e.target.value);
            }}
          />
        </label>
        <details>
          <summary>{say("Thêm chi tiết", "More details")}</summary>
          <label>
            {say("Ghi chú", "Note")}
            <textarea
              aria-label={say("Ghi chú", "Note")}
              rows={2}
              maxLength={1000}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </details>
        {preview && (
          <p className={styles.hint}>
            {say(
              "Bản xem trước không lưu vào tài khoản.",
              "Preview does not save to your account.",
            )}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {say("Hủy", "Cancel")}
          </button>
          <button type="submit" disabled={busy || preview || !word.trim()}>
            {busy ? say("Đang lưu…", "Saving…") : say("Lưu", "Save")}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
