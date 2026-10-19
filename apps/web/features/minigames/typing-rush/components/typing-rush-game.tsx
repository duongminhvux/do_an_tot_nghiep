"use client";
import { englishTypingKey, meaningPopupPosition } from "../engine/typing-input";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Pause, Play, Crosshair } from "lucide-react";
import { useTypingRush } from "../hooks/use-typing-rush";
import {
  DANGER_Y,
  FIELD_HEIGHT,
  findTypingTarget,
  normalizeWord,
} from "../engine/typing-rush-engine";
import { TypingRushResult } from "./typing-rush-result";
import type { GameSession } from "../types";
export function TypingRushGame({
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
    useTypingRush(session);
  const [answer, setAnswer] = useState("");
  const [fieldWidth, setFieldWidth] = useState(800);
  const [targetId, setTargetId] = useState<string>();
  const target = targetId
    ? state.words.find((word) => word.instanceId === targetId)
    : !answer
      ? undefined
      : findTypingTarget(state.words, answer);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (targetId && !state.words.some((word) => word.instanceId === targetId)) {
      setTargetId(undefined);
      setAnswer("");
    }
  }, [state.words, targetId]);
  useEffect(() => {
    if (state.status === "FINISHED") return;
    const element = field.current;
    if (!element) return;
    const measure = () => {
      setFieldWidth(element.clientWidth);
      resize(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [resize, state.status]);
  const typeCharacter = (character: string) => {
    const activeTarget = target ?? findTypingTarget(state.words, character);
    if (!activeTarget) return;
    if (!targetId) setTargetId(activeTarget.instanceId);
    const nextIndex = answer.length;
    const expected = normalizeWord(activeTarget.word)[nextIndex];
    if (character.toLowerCase() !== expected) return;
    const nextAnswer = answer + character;
    setAnswer(nextAnswer);
    if (nextAnswer.length === normalizeWord(activeTarget.word).length) {
      if (submit(activeTarget.word)) {
        setAnswer("");
        setTargetId(undefined);
      }
    }
  };
  useEffect(() => {
    const handleTyping = (event: KeyboardEvent) => {
      if (
        state.status !== "RUNNING" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const origin = event.target;
      if (
        origin instanceof HTMLElement &&
        origin.closest(
          "input, textarea, select, button, a, [contenteditable=true]",
        )
      )
        return;
      if (event.code === "Backspace" || event.key === "Backspace") {
        event.preventDefault();
        setAnswer("");
        setTargetId(undefined);
        return;
      }
      const character = englishTypingKey(event);
      if (character === null || answer.length >= 80) return;
      event.preventDefault();
      typeCharacter(character);
    };
    window.addEventListener("keydown", handleTyping, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleTyping, { capture: true });
  }, [answer, state.status, state.words, target, targetId]);
  const renderWord = (word: string, isTarget: boolean) => {
    if (!isTarget)
      return <span className="min-w-0 flex-1 break-words">{word}</span>;
    const normalizedAnswer = normalizeWord(answer);
    const normalizedWord = normalizeWord(word);
    return (
      <span className="min-w-0 flex-1 break-words tracking-wide">
        {word.split("").map((character, index) => (
          <span
            key={`${character}-${index}`}
            className={
              normalizedAnswer[index] === normalizedWord[index]
                ? "text-emerald-600"
                : "text-amber-500"
            }
          >
            {character}
          </span>
        ))}
      </span>
    );
  };
  if (state.status === "FINISHED")
    return (
      <TypingRushResult
        state={state}
        locale={locale}
        onAgain={onAgain}
        onChange={onChange}
        starting={starting}
      />
    );
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 p-4">
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
                      ? "fill-rose-500 text-rose-500"
                      : "text-slate-200")
                  }
                />
              ),
            )}
          </span>
          <button
            onClick={pause}
            aria-label={t("pause")}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>
      <div
        ref={field}
        style={{ height: FIELD_HEIGHT }}
        className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_top,#dbeafe80,transparent_65%)] bg-white"
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:36px_36px]" />
        {state.words.map((word) => (
          <div
            key={word.instanceId}
            data-targeted={target?.instanceId === word.instanceId}
            aria-label={
              target?.instanceId === word.instanceId
                ? t("target_word", { word: word.word })
                : undefined
            }
            className={
              "absolute left-0 top-0 flex min-h-9 items-center justify-center whitespace-normal break-words rounded-lg border px-3 py-1.5 text-center font-mono font-bold leading-5 shadow-sm will-change-transform " +
              (target?.instanceId === word.instanceId
                ? "z-10 border-amber-400 bg-white/95 text-amber-600 ring-2 ring-amber-300/80 ring-offset-2 ring-offset-white shadow-[0_0_24px_rgba(250,204,21,0.55)] "
                : "") +
              " " +
              (word.kind === "HEART"
                ? "border-pink-300 bg-pink-50 text-pink-700"
                : word.y > DANGER_Y * 0.8
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : word.y > DANGER_Y * 0.6
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
                className="pointer-events-none absolute -right-3 -top-3 size-7 animate-pulse rounded-full bg-white p-1 text-indigo-700 shadow-lg"
              />
            )}
            {word.kind === "HEART" && (
              <Heart
                aria-label={t("heart_word")}
                className="mr-1.5 size-4 shrink-0 fill-pink-500 text-pink-500"
              />
            )}
            {renderWord(word.word, target?.instanceId === word.instanceId)}
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
            style={meaningPopupPosition(notice, fieldWidth, FIELD_HEIGHT)}
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
          className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center border-t border-rose-200 bg-gradient-to-t from-rose-100 to-rose-50/50 pb-3 text-[10px] font-bold uppercase tracking-[.25em] text-rose-600"
          style={{ height: FIELD_HEIGHT - DANGER_Y }}
        >
          {t("danger_zone")}
        </div>
        {state.status === "PAUSED" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/90 p-5 text-center backdrop-blur-sm">
            {countdown !== null ? (
              <strong className="text-7xl text-blue-600">
                {countdown === 0 ? t("go") : countdown}
              </strong>
            ) : (
              <>
                <h2 className="text-2xl font-bold">{t("paused")}</h2>
                <p className="max-w-sm text-sm text-slate-500">
                  {t("pause_help")}
                </p>
                <button
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resume}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700"
                >
                  <Play className="size-4" />
                  {t("resume")}
                </button>
                <button
                  onClick={onChange}
                  className="text-sm text-slate-500 underline"
                >
                  {t("change_sources")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className={
          "border-t border-slate-100 px-4 py-1.5 text-center text-xs leading-5 " +
          (state.inputError ? "text-rose-600" : "text-slate-500")
        }
      >
        {state.inputError ? t("wrong_answer") : t("typing_hint")}
      </p>
      <style jsx>
        {
          "@keyframes rush-hit{to{opacity:0;transform:translateY(-36px)}}@keyframes rush-spark{to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0)}}@keyframes rush-error{25%,75%{transform:translateX(-3px)}50%{transform:translateX(3px)}}@keyframes meaning-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}.rush-hit{animation:rush-hit .65s ease-out forwards}.rush-spark{animation:rush-spark .6s ease-out forwards}.rush-error{animation:rush-error .2s ease-in-out}.meaning-pop{animation:meaning-pop .2s ease-out forwards}@media(prefers-reduced-motion:reduce){.rush-hit,.rush-spark,.rush-error,.meaning-pop{animation:none}.rush-spark{display:none}}"
        }
      </style>
    </section>
  );
}
