"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DictationLookupCard } from "./dictation-lookup-card";
import {
  DictationWordInput,
  type DictationWordEntry,
} from "./dictation-word-input";
import styles from "./dictation-studio.module.css";

type IconName =
  | "headphones"
  | "play"
  | "pause"
  | "check"
  | "left"
  | "right"
  | "replay"
  | "eye"
  | "keyboard"
  | "target"
  | "list";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    headphones: (
      <>
        <path d="M4 14v-3a8 8 0 0116 0v3" />
        <rect x="3" y="12" width="4" height="8" rx="2" />
        <rect x="17" y="12" width="4" height="8" rx="2" />
      </>
    ),
    play: <path d="m9 5 11 7-11 7z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    replay: (
      <>
        <path d="M3 10a9 9 0 119 11" />
        <path d="M3 4v6h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function dictationTimestamp(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export interface StudioSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}
export interface StudioGrade {
  score: number;
  isCorrect: boolean;
  errors: number;
  totalWords: number;
}
export type StudioShortcutAction =
  | "replay"
  | "prevSentence"
  | "nextSentence"
  | "reveal"
  | "slower"
  | "faster";
export interface StudioShortcut {
  action: StudioShortcutAction;
  /** Display text, e.g. "Alt + ←". */
  label: string;
}
const DEFAULT_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
export interface DictationStudioProps {
  title: string;
  level?: string;
  locale?: string;
  backHref?: string;
  preview?: boolean;
  segments: StudioSegment[];
  currentIndex: number;
  completed: number[];
  revealed: number[];
  answer: string;
  onAnswer: (value: string) => void;
  answerRef?: { current: HTMLTextAreaElement | null };
  onSelect: (index: number) => void;
  onPlay: () => void;
  onPause?: () => void;
  onCheck: () => void;
  onReveal: () => void;
  onHint?: () => Promise<void>;
  onLookup?: (word: string) => Promise<DictationWordEntry | null>;
  onSaveWord?: (entry: DictationWordEntry) => Promise<void>;
  onPronounce?: (
    entry: DictationWordEntry,
    accent: "us" | "uk",
  ) => Promise<string | undefined>;
  onTranscript: () => void;
  transcriptVisible?: boolean;
  media?: ReactNode;
  isPlaying?: boolean;
  playbackRate: number;
  onPlaybackRate: (rate: number) => void;
  autoPlayNext: boolean;
  onAutoPlayNext: (enabled: boolean) => void;
  showAnswer: boolean;
  pending?: boolean;
  grading?: StudioGrade | null;
  error?: string;
  wrongAttempts?: number;
  maxAttempts?: number;
  played?: boolean;
  /**
   * Admin-configured shortcuts. When `resolveShortcut` is given it replaces the
   * built-in Alt+R / Alt+←→ keys; `shortcuts` is what the shortcut card lists.
   */
  shortcuts?: StudioShortcut[];
  resolveShortcut?: (event: KeyboardEvent) => StudioShortcutAction | null;
  speeds?: number[];
  showShortcutCard?: boolean;
  allowHint?: boolean;
  transcriptEnabled?: boolean;
}
export function DictationStudio(props: DictationStudioProps) {
  const {
    title,
    level,
    locale = "vi",
    preview,
    segments,
    currentIndex,
    completed,
    revealed,
    answer,
    onAnswer,
    onSelect,
    onPlay,
    onCheck,
    onReveal,
    onTranscript,
    media,
    isPlaying,
    playbackRate,
    onPlaybackRate,
    autoPlayNext,
    onAutoPlayNext,
    showAnswer,
    pending,
    grading,
    error,
    transcriptVisible,
    speeds = DEFAULT_SPEEDS,
    transcriptEnabled = true,
  } = props;
  const en = locale === "en",
    say = (vi: string, english: string) => (en ? english : vi);
  const current = segments[currentIndex];
  useEffect(() => {
    setLookupEntry(null);
  }, [currentIndex]);
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const [lookupEntry, setLookupEntry] = useState<DictationWordEntry | null>(
    null,
  );
  const [autoScroll, setAutoScroll] = useState(true),
    [played, setPlayed] = useState(false);
  useEffect(() => {
    if (autoScroll)
      rows.current[currentIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [currentIndex, autoScroll]);
  const percent = segments.length
    ? Math.round((completed.length / segments.length) * 100)
    : 0;
  const play = () => {
    setPlayed(true);
    onPlay();
  };
  const select = (index: number) => {
    if (!pending && index >= 0 && index < segments.length) onSelect(index);
  };
  const goals = [
    {
      label: say("Nghe lại một đoạn", "Replay a segment"),
      done: played || props.played,
    },
    {
      label: say("Viết đúng một câu", "Dictate one sentence correctly"),
      done: completed.length > 0,
    },
    {
      label: say("Hoàn thành bài luyện", "Complete this lesson"),
      done: segments.length > 0 && completed.length === segments.length,
    },
  ];
  const mask = (text: string) =>
    text
      .split(/\s+/)
      .map((w) => "•".repeat(Math.min(w.length, 9)))
      .join(" ");
  return (
    <div
      className={`${styles.studio} ${preview ? styles.preview : ""} ${lookupEntry ? styles.lookupOpen : ""}`}
      data-testid="dictation-studio"
      onKeyDown={(event) => {
        if (props.resolveShortcut) {
          if (event.nativeEvent.isComposing) return;
          const action = props.resolveShortcut(event.nativeEvent);
          if (!action) return;
          event.preventDefault();
          event.stopPropagation();
          if (action === "replay") play();
          else if (action === "prevSentence") select(currentIndex - 1);
          else if (action === "nextSentence") select(currentIndex + 1);
          else if (action === "reveal") {
            if (!pending && !showAnswer) onReveal();
          } else {
            const index = speeds.indexOf(playbackRate);
            const next =
              speeds[
                Math.max(
                  0,
                  Math.min(
                    speeds.length - 1,
                    (index === -1 ? speeds.indexOf(1) : index) +
                      (action === "faster" ? 1 : -1),
                  ),
                )
              ];
            if (next !== undefined) onPlaybackRate(next);
          }
          return;
        }
        if (event.altKey && event.key.toLowerCase() === "r") {
          event.preventDefault();
          event.stopPropagation();
          play();
        }
        if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          select(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
        }
      }}
    >
      <header className={styles.header}>
        <a
          className={styles.brand}
          href={props.backHref || undefined}
          aria-label={say("Về danh sách bài nghe", "Back to listening lessons")}
        >
          <span className={styles.brandMark}>
            <Icon name="headphones" size={23} />
          </span>
          <span>
            English Platform<small>LISTENING STUDIO</small>
          </span>
        </a>
        <div className={styles.headerInfo}>
          <span className={styles.liveDot} />
          {say("Không gian luyện nghe", "Your listening space")}
        </div>
        <div className={styles.headerActions}>
          {preview && (
            <span className={styles.previewBadge}>
              {say(
                "Xem thử · Không lưu điểm",
                "Preview · Results are not saved",
              )}
            </span>
          )}
          {props.backHref && (
            <a className={styles.back} href={props.backHref}>
              <Icon name="left" size={15} />
              {say("Bài nghe", "Lessons")}
            </a>
          )}
        </div>
      </header>
      <div className={styles.workspace}>
        <aside
          className={styles.captionPanel}
          aria-label={say("Danh sách câu", "Caption list")}
        >
          <div className={styles.panelTitle}>
            <span>
              <Icon name="list" size={16} />
              {say("PHỤ ĐỀ", "CAPTIONS")}{" "}
              <b>
                {completed.length}/{segments.length}
              </b>
            </span>
            <button
              type="button"
              onClick={() => setAutoScroll((v) => !v)}
              aria-label={say(
                "Tự cuộn đến câu đang nghe",
                "Auto-scroll to current sentence",
              )}
              aria-pressed={autoScroll}
              title={say(
                "Tự cuộn đến câu đang nghe",
                "Auto-scroll to current sentence",
              )}
              className={autoScroll ? styles.activeTool : ""}
            >
              <Icon name="target" size={17} />
            </button>
          </div>
          <nav className={styles.captionList}>
            {segments.map((segment, index) => {
              const done = completed.includes(index),
                wasRevealed = revealed.includes(index),
                active = index === currentIndex;
              return (
                <button
                  type="button"
                  disabled={pending}
                  key={segment.id}
                  ref={(node) => {
                    rows.current[index] = node;
                  }}
                  onClick={() => select(index)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${say("Câu", "Sentence")} ${index + 1}, ${dictationTimestamp(segment.startMs)}`}
                  className={`${styles.caption} ${active ? styles.currentCaption : ""} ${done ? styles.doneCaption : ""}`}
                >
                  <span
                    className={`${styles.captionCheck} ${done ? styles.checked : ""}`}
                  >
                    {done ? (
                      <Icon name="check" size={13} />
                    ) : active ? (
                      <span />
                    ) : null}
                  </span>
                  <span className={styles.captionWords}>
                    {done || wasRevealed || transcriptVisible
                      ? segment.text
                      : mask(segment.text)}
                    <small>
                      #{index + 1}
                      <span>·</span>
                      {dictationTimestamp(segment.startMs)}
                      {wasRevealed && !done && (
                        <em>{say("Đã xem", "Revealed")}</em>
                      )}
                    </small>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className={styles.captionFooter}>
            <span className={styles.liveDot} />
            {say(
              "Chậm lại một chút. Nghe kỹ hơn.",
              "Slow down. Listen a little closer.",
            )}
          </div>
        </aside>
        <main className={styles.main}>
          <div className={styles.mobileCaption}>
            <label htmlFor="studio-caption-select">
              {say("Câu đang nghe", "Current sentence")}
            </label>
            <select
              id="studio-caption-select"
              disabled={pending}
              value={currentIndex}
              onChange={(e) => select(Number(e.target.value))}
            >
              {segments.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1} / {segments.length} · {dictationTimestamp(s.startMs)}
                  {completed.includes(i) ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.mediaCard}>
            {media || (
              <div className={styles.audioStage}>
                <span className={styles.audioHalo}>
                  <Icon name="headphones" size={40} />
                </span>
                <p>
                  {say("Tập trung vào điều bạn nghe", "Focus on what you hear")}
                </p>
                <button
                  type="button"
                  onClick={play}
                  className={styles.audioPlay}
                  aria-label={say("Nghe đoạn hiện tại", "Play current segment")}
                >
                  <Icon name={isPlaying ? "pause" : "play"} size={22} />
                </button>
              </div>
            )}
          </div>
          <div className={styles.lessonBar}>
            <div className={styles.lessonTitle}>
              <span className={styles.level}>{level || "EN"}</span>
              <h1 title={title}>{title}</h1>
            </div>
            <div className={styles.playbackTools}>
              <button
                type="button"
                onClick={() => select(currentIndex - 1)}
                disabled={pending || currentIndex === 0}
                aria-label={say("Câu trước", "Previous sentence")}
              >
                <Icon name="left" />
              </button>
              <select
                value={playbackRate}
                onChange={(e) => onPlaybackRate(Number(e.target.value))}
                aria-label={say("Tốc độ phát", "Playback speed")}
              >
                {speeds.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => select(currentIndex + 1)}
                disabled={pending || currentIndex === segments.length - 1}
                aria-label={say("Câu tiếp", "Next sentence")}
              >
                <Icon name="right" />
              </button>
            </div>
          </div>
          <div className={styles.practiceHeading}>
            <span>
              <Icon name="headphones" size={17} />
              {say(
                "Nghe và viết lại điều bạn vừa nghe",
                "Write the sentence you hear",
              )}
            </span>
            <span>
              {say("Câu", "Sentence")} {currentIndex + 1}
              <i>/ {segments.length}</i>
            </span>
          </div>
          {transcriptVisible ? (
            <section className={styles.transcript}>
              <div className={styles.transcriptHeading}>
                <h2>{say("Bản chép lời", "Transcript")}</h2>
                <button type="button" onClick={onTranscript}>
                  {say("Quay lại luyện tập", "Back to practice")}
                </button>
              </div>
              {segments.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => select(i)}
                  className={i === currentIndex ? styles.activeTranscript : ""}
                >
                  <small>{dictationTimestamp(s.startMs)}</small>
                  <span>{s.text}</span>
                </button>
              ))}
            </section>
          ) : (
            <section
              className={`${styles.composer} ${grading?.isCorrect ? styles.correctComposer : ""}`}
            >
              <DictationWordInput
                key={current?.id}
                target={current?.text || ""}
                value={answer}
                onChange={onAnswer}
                disabled={pending || showAnswer}
                checked={Boolean(grading)}
                onCheck={onCheck}
                onNext={() => select(currentIndex + 1)}
                canNext={!pending && currentIndex < segments.length - 1}
                onReplay={play}
                isPlaying={isPlaying}
                onStartVoice={() => {
                  if (props.onPause) props.onPause();
                  else if (isPlaying) onPlay();
                }}
                onHint={props.onHint}
                allowHint={props.allowHint ?? true}
                onLookup={props.onLookup}
                onLookupResult={setLookupEntry}
                onSave={props.onSaveWord}
                preview={preview}
                en={en}
              />
            </section>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {grading && (
            <div
              role="status"
              className={`${styles.feedback} ${grading.isCorrect ? styles.successFeedback : styles.retryFeedback}`}
            >
              <span className={styles.score}>
                {grading.score}
                <small>/100</small>
              </span>
              <div>
                <strong>
                  {grading.isCorrect
                    ? say(
                        "Chính xác. Làm tốt lắm!",
                        "Exactly right. Nice work!",
                      )
                    : say("Nghe lại một lần nữa nhé", "Give it another listen")}
                </strong>
                <p>
                  {grading.isCorrect
                    ? say("Bạn đã nghe đúng từng từ.", "You caught every word.")
                    : say(
                        `${grading.errors} từ sai, thiếu hoặc thừa trên ${grading.totalWords} từ.`,
                        `${grading.errors} word edits out of ${grading.totalWords} words.`,
                      )}
                </p>
              </div>
              <Icon name={grading.isCorrect ? "check" : "replay"} size={22} />
            </div>
          )}
          {showAnswer && current && !transcriptVisible && (
            <div className={styles.answer}>
              <span>
                <Icon name="eye" size={16} />
                {say("Đáp án", "Answer")}
              </span>
              <p>{current.text}</p>
            </div>
          )}
          <div className={styles.bottomBar}>
            {(transcriptEnabled || transcriptVisible) && (
              <button type="button" onClick={onTranscript}>
                <Icon name="list" size={15} />
                {transcriptVisible
                  ? say("Về bài luyện", "Back to practice")
                  : say("Xem transcript", "View transcript")}
              </button>
            )}
            <label>
              <input
                type="checkbox"
                checked={autoPlayNext}
                onChange={(e) => onAutoPlayNext(e.target.checked)}
              />
              {say("Tự phát câu tiếp", "Auto-play next")}
            </label>
          </div>
          <p className={styles.tip}>
            <span>✦</span>
            {say(
              "Không cần nghe đúng ngay lần đầu. Mỗi lần nghe lại là một bước tiến.",
              "You do not have to catch everything the first time. Every replay is progress.",
            )}
          </p>
        </main>
        <aside
          className={styles.insights}
          aria-label={say("Tiến độ và phím tắt", "Progress and shortcuts")}
        >
          <section className={styles.progressCard}>
            <div className={styles.cardHeading}>
              <span>
                <Icon name="target" size={18} />
                {say("Buổi học của bạn", "Your session")}
              </span>
              <b>
                {completed.length}/{segments.length}
              </b>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <p>
              {say(
                "Từng câu một, bạn đang tiến bộ.",
                "One sentence at a time. You are getting there.",
              )}
            </p>
            <div className={styles.goalList}>
              {goals.map((goal) => (
                <div
                  key={goal.label}
                  className={goal.done ? styles.achieved : ""}
                >
                  <span>
                    {goal.done ? <Icon name="check" size={12} /> : null}
                  </span>
                  {goal.label}
                </div>
              ))}
            </div>
          </section>
          {lookupEntry && (
            <DictationLookupCard
              onPronounce={props.onPronounce}
              entry={lookupEntry}
              onClose={() => setLookupEntry(null)}
              en={en}
            />
          )}
          {props.showShortcutCard !== false && (
            <section className={styles.shortcutCard}>
              <h2>
                <Icon name="keyboard" size={17} />
                {say("PHÍM TẮT", "KEYBOARD SHORTCUTS")}
              </h2>
              {[
                [say("Kiểm tra", "Check"), "Enter"],
                ...(props.shortcuts
                  ? props.shortcuts.map(({ action, label }) => [
                      {
                        replay: say("Nghe lại", "Replay"),
                        prevSentence: say("Câu trước", "Previous"),
                        nextSentence: say("Câu tiếp", "Next"),
                        reveal: say("Hiện đáp án", "Show answer"),
                        slower: say("Giảm tốc độ", "Slower"),
                        faster: say("Tăng tốc độ", "Faster"),
                      }[action],
                      label,
                    ])
                  : [
                      [say("Nghe lại", "Replay"), "Alt + R"],
                      [say("Câu trước", "Previous"), "Alt + ←"],
                      [say("Câu tiếp", "Next"), "Alt + →"],
                    ]),
                [say("Chuyển câu tiếp", "Move on"), "Shift + Enter"],
              ].map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </section>
          )}
          <section className={styles.noteCard}>
            <span>01 — LISTEN. WRITE. REPEAT.</span>
            <p>
              {say(
                "Nghe ý chính trước. Rồi chú ý từng từ nhỏ.",
                "Listen for the idea first. Then notice the little words.",
              )}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
