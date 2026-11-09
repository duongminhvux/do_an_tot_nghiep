"use client";
import { useEffect, useRef, useState } from "react";
import type { DictationWordEntry } from "./dictation-word-input";
import styles from "./dictation-lookup-card.module.css";
export function DictationLookupCard({
  entry,
  onClose,
  en = false,
  onPronounce,
}: {
  entry: DictationWordEntry;
  onClose: () => void;
  en?: boolean;
  onPronounce?: (
    entry: DictationWordEntry,
    accent: "us" | "uk",
  ) => Promise<string | undefined>;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const revision = useRef(0);
  const [loading, setLoading] = useState(false),
    [audioError, setAudioError] = useState("");
  useEffect(
    () => () => {
      revision.current++;
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [entry],
  );
  const pronounce = async (accent: "us" | "uk") => {
    const current = ++revision.current;
    setLoading(true);
    setAudioError("");
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    try {
      const url =
        (await onPronounce?.(entry, accent)) ||
        (accent === "us" ? entry.audioUs : entry.audioUk);
      if (current !== revision.current) return;
      if (url) {
        audio.current = new Audio(url);
        await audio.current.play();
      } else if (window.speechSynthesis) {
        const text = new SpeechSynthesisUtterance(entry.word);
        text.lang = accent === "us" ? "en-US" : "en-GB";
        window.speechSynthesis.speak(text);
      }
    } catch {
      if (current === revision.current)
        setAudioError(
          en
            ? "Could not play pronunciation. Try again."
            : "Chưa phát được âm thanh. Hãy thử lại.",
        );
    } finally {
      if (current === revision.current) setLoading(false);
    }
  };
  return (
    <section
      className={styles.card}
      aria-label={en ? "Word definition" : "Nghĩa của từ"}
    >
      <header>
        <h2>{entry.word}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={en ? "Close definition" : "Đóng nghĩa của từ"}
        >
          ×
        </button>
      </header>
      <div className={styles.content}>
        {(["us", "uk"] as const).map((accent) => (
          <div className={styles.pronunciation} key={accent}>
            <b>{accent.toUpperCase()}</b>
            <span
              title={
                entry.ipaDerivedFrom
                  ? en
                    ? `Plural IPA derived from ${entry.ipaDerivedFrom}`
                    : `IPA số nhiều từ ${entry.ipaDerivedFrom}`
                  : undefined
              }
            >
              {(accent === "us" ? entry.ipa : entry.ipaUk) || "—"}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => void pronounce(accent)}
              aria-label={
                (en ? "Pronounce " : "Phát âm ") + accent.toUpperCase()
              }
            >
              ♬
            </button>
          </div>
        ))}
        {audioError && <p role="alert">{audioError}</p>}
        {entry.meanings.length ? (
          <>
            <span className={styles.part}>
              {entry.partOfSpeech ? `(${entry.partOfSpeech})` : ""}
            </span>
            <div className={styles.meanings}>
              {entry.meanings.slice(0, 3).map((meaning, i) => (
                <p className={styles.meaning} key={i}>
                  {meaning}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p>
            {en
              ? "Vietnamese meaning is unavailable."
              : "Chưa có nghĩa tiếng Việt."}
          </p>
        )}
      </div>
    </section>
  );
}
