"use client";
import { useAutomaticWordCompletion } from "../../shared/use-automatic-word-completion";
import { useEnglishGameKeyboard } from "../../shared/use-english-game-keyboard";
import { meaningPopupPosition } from "../engine/typing-input";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Heart, Pause, Play, Crosshair } from "lucide-react";
import { useMeaningTyping } from "../hooks/use-meaning-typing";
import {
  FIELD_HEIGHT,
  automaticHintLength,
  maskedWordCharacters,
} from "../engine/meaning-typing-engine";
import { MeaningTypingResult } from "./meaning-typing-result";
import {
  advanceTypingProgress,
  cycleTypingTarget,
  completedTypingTarget,
} from "../../typing-rush/engine/typing-rush-engine";
import type { TypingProgress } from "../../typing-rush/engine/typing-rush-engine";
import type { GameSession } from "../types";
export function MeaningTypingGame({
  session,
  locale,
  onAgain,
  onChange,
  starting,
}: {
  session: GameSession;
  locale: string;
  onAgain: () => void;
  onChange: () => void;
  starting: boolean;
}) {
  const { t } = useTranslation("minigames");
  const { state, countdown, submit, pause, resume, resize } =
    useMeaningTyping(session);
  const [progress, setProgress] = useState<TypingProgress>({ answer: "" });
  const progressRef = useRef<TypingProgress>({ answer: "" });
  const { answer, targetId } = progress;
  const updateProgress = (next: TypingProgress) => {
    progressRef.current = next;
    setProgress(next);
  };
  const [fieldWidth, setFieldWidth] = useState(800);
  const [fieldHeight, setFieldHeight] = useState(FIELD_HEIGHT);
  const dangerY = Math.max(56, fieldHeight - 44);
  const target = state.words.find((word) => word.instanceId === targetId);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (targetId && !state.words.some((word) => word.instanceId === targetId)) {
      updateProgress({ answer: "" });
    }
  }, [state.words, targetId]);
  useEffect(() => {
    if (state.status === "FINISHED") return;
    const element = field.current;
    if (!element) return;
    const measure = () => {
      setFieldWidth(element.clientWidth);
      setFieldHeight(element.clientHeight);
      resize(element.clientWidth, element.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [resize, state.status]);
  const finishTyping = (next: TypingProgress, confirm = false) => {
    const completed = completedTypingTarget(state.words, next, confirm);
    if (completed && submit(completed.word, completed.instanceId)) {
      updateProgress({ answer: "" });
      return;
    }
    updateProgress(next);
  };
  useAutomaticWordCompletion({
    words: state.words,
    progress,
    elapsed: state.elapsed,
    enabled: state.status === "RUNNING",
    onComplete: () => finishTyping(progressRef.current, true),
  });
  useEnglishGameKeyboard({
    enabled: state.status === "RUNNING",
    field,
    onCharacter: (character) => {
      const current = progressRef.current;
      if (current.answer.length >= 80) return;
      const next = advanceTypingProgress(state.words, current, character);
      const completed = completedTypingTarget(state.words, current, true);
      if (
        next === current &&
        completed &&
        !current.locked &&
        submit(completed.word, completed.instanceId)
      ) {
        const remaining = state.words.filter(
          (word) => word.instanceId !== completed.instanceId,
        );
        finishTyping(
          advanceTypingProgress(remaining, { answer: "" }, character),
        );
      } else finishTyping(next);
    },
    onReset: () => updateProgress({ answer: "" }),
    onConfirm: () => finishTyping(progressRef.current, true),
    onCycle: (direction) =>
      updateProgress(
        cycleTypingTarget(state.words, progressRef.current, direction),
      ),
  });
  const renderWord = (
    word: string,
    isTarget: boolean,
    y: number,
    meaning?: string,
  ) => {
    const visibleCount = automaticHintLength(
      word,
      session.config.hintPercent,
      y,
      dangerY,
    );
    return (
      <span className="min-w-0 flex-1 break-words">
        <span className="block text-xs font-sans font-semibold text-slate-700">
          {meaning || t("meaning_missing")}
        </span>
        <span className="mt-1 block tracking-wide">
          {maskedWordCharacters(word, answer, isTarget, visibleCount).map(
            ({ character, revealed }, index) => (
              <span
                key={`${character}-${index}`}
                className={revealed ? "text-emerald-600" : "text-slate-400"}
              >
                {character}
              </span>
            ),
          )}
        </span>
      </span>
    );
  };
  if (state.status === "FINISHED")
    return (
      <MeaningTypingResult
        state={state}
        locale={locale}
        onAgain={onAgain}
        onChange={onChange}
        starting={starting}
      />
    );
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap gap-5 text-sm">
          <div>
            <span className="block text-xs text-slate-500">{t("score")}</span>
            <strong className="text-xl text-blue-600">
              {state.score.toLocaleString(locale)}
            </strong>
          </div>
          <div>
            <span className="block text-xs text-slate-500">{t("combo")}</span>
            <strong className="text-xl text-violet-600">×{state.combo}</strong>
          </div>
          <div>
            <span className="block text-xs text-slate-500">{t("level")}</span>
            <strong className="text-xl">{state.level}</strong>
          </div>
        </div>
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-pink-50 px-3 py-2 text-xs font-medium text-pink-700"
        >
          <Heart aria-hidden="true" className="size-4 shrink-0 text-pink-500" />
          {state.heartPending
            ? t("heart_incoming")
            : t("next_heart", { count: state.wordsUntilHeart })}
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-label={t("lives_count", { count: state.lives })}
            className="flex max-w-64 flex-wrap gap-1"
          >
            {Array.from(
              { length: session.config.maxLives ?? session.config.lives },
              (_, i) => (
                <Heart
                  key={i}
                  className={
                    "size-4 " +
                    (i < state.lives
                      ? "fill-red-500 text-red-500"
                      : "text-slate-200")
                  }
                />
              ),
            )}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={pause}
            aria-label={t("pause")}
          >
            <Pause />
          </Button>
        </div>
      </div>
      <div
        ref={field}
        tabIndex={-1}
        inputMode="none"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onPointerDown={(event) => {
          if (state.status === "RUNNING")
            event.currentTarget.focus({ preventScroll: true });
        }}
        className="relative isolate min-h-0 flex-1 overflow-hidden outline-none bg-[radial-gradient(ellipse_at_top,#dbeafe80,transparent_65%)] bg-white"
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:36px_36px]" />
        {state.words.map((word) => (
          <div
            key={word.instanceId}
            onClick={() => {
              if (state.status !== "RUNNING") return;
              updateProgress({
                answer: "",
                targetId: word.instanceId,
                locked: true,
              });
              field.current?.focus({ preventScroll: true });
            }}
            data-targeted={target?.instanceId === word.instanceId}
            aria-label={
              target?.instanceId === word.instanceId
                ? t("target_word", { word: word.word })
                : undefined
            }
            className={
              "absolute left-0 top-0 flex cursor-pointer select-none min-h-9 items-center justify-center whitespace-normal break-words rounded-lg border px-3 py-1.5 text-center font-mono font-bold leading-5 shadow-sm will-change-transform " +
              (target?.instanceId === word.instanceId
                ? "z-10 border-amber-400 bg-white/95 text-amber-600 ring-2 ring-amber-300/80 ring-offset-2 ring-offset-white shadow-[0_0_24px_rgba(250,204,21,0.55)] "
                : "") +
              " " +
              (word.kind === "HEART"
                ? "border-pink-300 bg-pink-50 text-pink-700"
                : word.y > dangerY * 0.8
                  ? "border-red-300 bg-red-50 text-red-700"
                  : word.y > dangerY * 0.6
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-blue-200 bg-blue-50 text-blue-800")
            }
            style={{
              transform: "translate3d(" + word.x + "px," + word.y + "px,0)",
              width: word.width,
              fontSize: Math.max(
                12,
                Math.min(16, (word.width - 24) / word.word.length / 0.62),
              ),
            }}
          >
            {target?.instanceId === word.instanceId && (
              <Crosshair
                aria-hidden="true"
                className="pointer-events-none absolute -right-3 -top-3 size-7 animate-pulse rounded-full bg-white p-1 text-blue-700 shadow-lg"
              />
            )}
            {word.kind === "HEART" && (
              <Heart
                aria-label={t("heart_word")}
                className="mr-1.5 size-4 shrink-0 fill-pink-500 text-pink-500"
              />
            )}
            {renderWord(
              word.word,
              target?.instanceId === word.instanceId,
              word.y,
              word.meaning,
            )}
          </div>
        ))}
        {state.effects.map((effect) => (
          <div
            key={effect.id}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              transform: "translate3d(" + effect.x + "px," + effect.y + "px,0)",
            }}
          >
            <span className="rush-hit block font-bold text-emerald-600">
              +{effect.points}
              {effect.restoredLives > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-pink-600">
                  <Heart className="size-4 fill-pink-500" />
                  {t("life_restored")}
                </span>
              )}
            </span>
            {[-1, 1, -2, 2].map((n, i) => (
              <span
                key={n}
                className="rush-spark absolute size-1.5 rounded-full bg-cyan-400"
                style={
                  {
                    "--dx": n * 16 + "px",
                    "--dy": (i % 2 ? -30 : 25) + "px",
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ))}
        {state.meanings.map((notice) => (
          <div
            key={"meaning-" + notice.id}
            role="status"
            className="meaning-pop pointer-events-none absolute z-20 max-h-22 overflow-hidden rounded-lg border border-emerald-300 bg-white/95 px-3 py-2 text-left shadow-lg"
            style={meaningPopupPosition(notice, fieldWidth, fieldHeight)}
          >
            <strong className="block text-sm text-emerald-700">
              {notice.word}
            </strong>
            <span className="block whitespace-normal break-words text-xs leading-4 text-slate-700">
              {notice.meaning || t("meaning_missing")}
            </span>
          </div>
        ))}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center border-t border-red-200 bg-gradient-to-t from-red-100 to-red-50/50 pb-3 text-[11px] font-semibold uppercase tracking-[.25em] text-red-600"
          style={{ height: 44 }}
        >
          {t("danger_zone")}
        </div>
        {state.status === "PAUSED" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/90 p-5 text-center backdrop-blur-sm">
            {countdown !== null ? (
              <strong className="text-7xl font-bold text-blue-600">
                {countdown === 0 ? t("go") : countdown}
              </strong>
            ) : (
              <>
                <h2 className="text-2xl font-bold">{t("paused")}</h2>
                <p className="max-w-sm text-sm text-slate-500">
                  {t("pause_help")}
                </p>
                <Button
                  size="lg"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resume}
                >
                  <Play />
                  {t("resume")}
                </Button>
                <Button variant="ghost" size="sm" onClick={onChange}>
                  {t("change_sources")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className={
          "shrink-0 border-t border-slate-100 px-3 py-1 text-center text-xs leading-5 " +
          (state.inputError ? "text-red-600" : "text-slate-500")
        }
      >
        {state.inputError ? t("wrong_answer") : t("meaning_typing_hint")}
      </p>
      <style jsx>
        {
          "@keyframes rush-hit{to{opacity:0;transform:translateY(-36px)}}@keyframes rush-spark{to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0)}}@keyframes rush-error{25%,75%{transform:translateX(-3px)}50%{transform:translateX(3px)}}@keyframes meaning-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}.rush-hit{animation:rush-hit .65s ease-out forwards}.rush-spark{animation:rush-spark .6s ease-out forwards}.rush-error{animation:rush-error .2s ease-in-out}.meaning-pop{animation:meaning-pop .2s ease-out forwards}@media(prefers-reduced-motion:reduce){.rush-hit,.rush-spark,.rush-error,.meaning-pop{animation:none}.rush-spark{display:none}}"
        }
      </style>
    </section>
  );
}
