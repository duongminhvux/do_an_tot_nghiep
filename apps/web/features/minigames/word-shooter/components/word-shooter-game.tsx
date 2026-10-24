"use client";
import { useGameAudio } from "../../shared/use-game-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/page";
import { Crosshair, Pause, Play, Timer, Target } from "lucide-react";
import { WordShooterEngine } from "../engine/word-shooter-engine";
import { WordShooterResult } from "./word-shooter-result";
import type { GameSession } from "../types";
export function WordShooterGame({
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
  const engine = useMemo(() => new WordShooterEngine(session), [session]);
  const [state, setState] = useState(() => engine.snapshot());
  useGameAudio(session.config, state);
  const field = useRef<HTMLDivElement>(null);
  const cannonBaseRef = useRef<HTMLDivElement>(null);

  // Gun rotation angle (in degrees, 0 = pointing straight up)
  const [cannonAngle, setCannonAngle] = useState(0);
  const [projectile, setProjectile] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isCorrect: boolean;
    key: number;
  } | null>(null);

  const sync = () => setState(engine.snapshot());

  // Mouse tracking to rotate cannon
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!field.current || state.status !== "RUNNING") return;
    const rect = field.current.getBoundingClientRect();
    // Gun pivot point at bottom center
    const gunX = rect.left + rect.width / 2;
    const gunY = rect.bottom - 40;

    const dx = e.clientX - gunX;
    const dy = e.clientY - gunY; // dy is negative because mouse is above gun

    // Angle in degrees where 0 is straight UP (towards -Y)
    const angleRad = Math.atan2(dx, -dy);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Clamp angle so cannon doesn't turn backwards into the floor
    const clampedAngle = Math.max(-80, Math.min(80, angleDeg));
    setCannonAngle(clampedAngle);
  };

  // Deterministic + random positions and float trajectories for bubbles based on round
  const bubbleStyles = useMemo(() => {
    const count = state.options.length;
    // Simple pseudo-random helper seeded by round & index
    const seedRandom = (seed: number) => {
      const x = Math.sin(seed * 9999 + state.round * 1337) * 10000;
      return x - Math.floor(x);
    };

    return state.options.map((_, i) => {
      // Divide space into columns and staggered rows
      const cols = count > 4 ? 3 : 2;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const totalRows = Math.ceil(count / cols);

      // Base grid distribution with random jitter per round so they appear in fresh spots
      const jitterX = (seedRandom(i + 1) - 0.5) * 8;
      const jitterY = (seedRandom(i + 2) - 0.5) * 6;

      const baseLeft = 18 + (col * (64 / Math.max(1, cols - 1)));
      const baseTop = 15 + (row * (46 / Math.max(1, totalRows)));

      const leftPercent = Math.max(12, Math.min(88, baseLeft + jitterX));
      const topPercent = Math.max(12, Math.min(62, baseTop + jitterY));

      // Small gentle drift ranges so bubbles don't collide
      const driftX = (seedRandom(i + 3) * 12 - 6).toFixed(1);
      const driftY = (seedRandom(i + 4) * 12 - 6).toFixed(1);

      // Duration & delay
      const duration = 4 + (i % 3) * 0.9;
      const delay = (i * 0.5) % 2.5;

      return {
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        driftX: `${driftX}px`,
        driftY: `${driftY}px`,
        animationDuration: `${duration}s`,
        animationDelay: `-${delay}s`,
      };
    });
  }, [state.options.length, state.round]);

  const handleShoot = (wordId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (state.status !== "RUNNING" || !field.current) return;

    const fieldRect = field.current.getBoundingClientRect();
    const btnRect = e.currentTarget.getBoundingClientRect();

    const isHit = wordId === state.target.id;

    // Cannon pivot is at (fieldRect.width / 2, fieldRect.height - 40)
    // Barrel length is approx 54px. Muzzle tip position based on angle:
    const angleRad = (cannonAngle * Math.PI) / 180;
    const barrelLength = 54;
    const startX = fieldRect.width / 2 + Math.sin(angleRad) * barrelLength;
    const startY = fieldRect.height - 40 - Math.cos(angleRad) * barrelLength;
    const targetX = btnRect.left - fieldRect.left + btnRect.width / 2;
    const targetY = btnRect.top - fieldRect.top + btnRect.height / 2;

    // Fire flying cannonball
    setProjectile({
      x1: startX,
      y1: startY,
      x2: targetX,
      y2: targetY,
      isCorrect: isHit,
      key: Date.now(),
    });

    // Advance engine state when projectile hits target
    setTimeout(() => {
      engine.shoot(wordId, state.round);
      sync();
    }, 180);

    // Clear projectile after impact
    setTimeout(() => {
      setProjectile(null);
    }, 240);
  };

  useEffect(() => {
    if (state.status !== "RUNNING") return;
    let frame = 0,
      last: number | null = null;
    const tick = (now: number) => {
      engine.advance(last === null ? 0 : now - last);
      last = now;
      setState(engine.snapshot());
      if (engine.snapshot().status === "RUNNING")
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, state.status]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        engine.pause();
        setState(engine.snapshot());
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (engine.snapshot().status === "RUNNING") engine.pause();
      else if (engine.snapshot().status === "PAUSED") engine.resume();
      setState(engine.snapshot());
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", key);
    };
  }, [engine]);

  useEffect(() => {
    if (state.status === "RUNNING")
      field.current?.focus({ preventScroll: true });
  }, [state.status]);

  if (state.status === "FINISHED")
    return (
      <WordShooterResult
        state={state}
        locale={locale}
        onAgain={onAgain}
        onChange={onChange}
        starting={starting}
      />
    );

  const percent =
    (state.remainingMs / (session.config.roundDurationSeconds * 1000)) * 100;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Top HUD */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            {t("score")}:{" "}
            <strong className="text-base font-bold text-blue-600">
              {state.score.toLocaleString(locale)}
            </strong>
          </span>
          <Badge tone="blue">
            {t("shooter_round", { count: state.round })}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              "flex items-center gap-1.5 text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg " +
              (percent < 25 ? "bg-red-50 text-red-600 animate-pulse" : "bg-blue-50 text-blue-600")
            }
          >
            <Timer className="size-4" />
            {(state.remainingMs / 1000).toFixed(1)}s
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("pause")}
            onClick={() => {
              engine.pause();
              sync();
            }}
          >
            <Pause />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        role="progressbar"
        aria-label={t("shooter_time")}
        aria-valuemin={0}
        aria-valuemax={session.config.roundDurationSeconds}
        aria-valuenow={Math.ceil(state.remainingMs / 1000)}
        className="h-1.5 shrink-0 bg-slate-100"
      >
        <div
          className={
            "h-full transition-all duration-100 " +
            (percent < 25 ? "bg-red-500" : "bg-blue-600")
          }
          style={{ width: percent + "%" }}
        />
      </div>

      {/* Target Word Meaning Banner (Clean & readable, no excessive glare) */}
      <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          <span>{t("shooter_prompt")}</span>
          <span className="size-1.5 rounded-full bg-blue-500" />
        </div>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {state.target.meaning}
        </h2>
        <p
          role="status"
          className={
            "mt-0.5 h-4 text-xs font-semibold transition-all " +
            (state.feedback === "wrong"
              ? "text-red-600"
              : state.feedback === "correct"
                ? "text-emerald-600"
                : "opacity-0")
          }
        >
          {state.feedback === "correct"
            ? t("shooter_hit")
            : state.feedback === "wrong"
              ? t("shooter_miss", {
                  seconds: session.config.wrongShotPenaltySeconds,
                })
              : ""}
        </p>
      </div>

      {/* Shooting Field with Dynamic Floating Bubbles & Cannon */}
      <div
        ref={field}
        tabIndex={-1}
        onMouseMove={handleMouseMove}
        className="relative min-h-0 flex-1 overflow-hidden select-none bg-[radial-gradient(ellipse_at_bottom,#dbeafe_0%,#f8fafc_65%,#f1f5f9_100%)] p-4 outline-none cursor-crosshair"
      >
        {/* Floating Bubble Targets */}
        <div className="absolute inset-0 pointer-events-none">
          {state.options.map((word, index) => {
            const style = bubbleStyles[index] || {
              left: "50%",
              top: "30%",
              driftX: "0px",
              driftY: "0px",
              animationDuration: "4s",
              animationDelay: "0s",
            };
            const isShotThis = state.shotId === word.id;
            const isWrong = isShotThis && state.feedback === "wrong";
            const isHit = isShotThis && state.feedback === "correct";

            return (
              <div
                key={state.round + "-" + word.id}
                style={{
                  position: "absolute",
                  left: style.left,
                  top: style.top,
                  transform: "translate(-50%, -50%)",
                }}
                className="pointer-events-auto"
              >
                <button
                  disabled={state.status !== "RUNNING"}
                  onClick={(e) => handleShoot(word.id, e)}
                  style={
                    {
                      "--drift-x": style.driftX,
                      "--drift-y": style.driftY,
                      animation: `bubbleFloatAround ${style.animationDuration} ease-in-out infinite alternate`,
                      animationDelay: style.animationDelay,
                    } as React.CSSProperties
                  }
                  className={
                    "group relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 px-3.5 py-2 shadow-sm transition-all duration-200 active:scale-95 hover:scale-105 " +
                    (isWrong
                      ? "border-red-500 bg-red-50 ring-2 ring-red-200 text-red-700"
                      : isHit
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 text-emerald-700 scale-110"
                        : "border-slate-200 bg-white/95 text-slate-800 shadow-slate-900/5 hover:border-blue-500 hover:bg-blue-50/90 hover:shadow-md")
                  }
                >
                  {/* Subtle Target Icon */}
                  <Target className="size-3.5 shrink-0 text-blue-400 group-hover:text-blue-600 transition-colors pointer-events-none" />

                  {/* Word text */}
                  <span className="font-bold text-sm sm:text-base tracking-wide group-hover:text-blue-700">
                    {word.word}
                  </span>

                  {/* Crosshair indicator on hover */}
                  <Crosshair className="size-3.5 shrink-0 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  {/* Index badge */}
                  <span className="absolute -top-2 -right-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] leading-4 font-semibold text-slate-500 border border-slate-300 shadow-xs">
                    {index + 1}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Flying Cannonball Projectile */}
        {projectile && (
          <div
            key={projectile.key}
            style={
              {
                "--start-x": `${projectile.x1}px`,
                "--start-y": `${projectile.y1}px`,
                "--target-x": `${projectile.x2}px`,
                "--target-y": `${projectile.y2}px`,
                animation: "cannonBallFly 200ms cubic-bezier(0.2, 0.7, 0.4, 1) forwards",
              } as React.CSSProperties
            }
            className="pointer-events-none absolute z-30"
          >
            {/* Glowing Ball */}
            <div
              className={
                "size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg " +
                (projectile.isCorrect
                  ? "border-emerald-200 bg-gradient-to-tr from-emerald-600 via-emerald-400 to-white shadow-emerald-400/80"
                  : "border-red-200 bg-gradient-to-tr from-red-600 via-red-400 to-white shadow-red-400/80")
              }
            >
              {/* Core bright spark */}
              <div className="absolute inset-1 rounded-full bg-white/70 blur-[1px]" />
            </div>
          </div>
        )}

        {/* Dynamic 2D drifting bubble & cannonball projectile animation */}
        <style jsx>{`
          @keyframes cannonBallFly {
            0% {
              left: var(--start-x);
              top: var(--start-y);
              transform: scale(0.6);
              opacity: 1;
            }
            85% {
              opacity: 1;
              transform: scale(1.15);
            }
            100% {
              left: var(--target-x);
              top: var(--target-y);
              transform: scale(1.4);
              opacity: 0.9;
            }
          }
        `}</style>

        {/* Bottom Cannon Gun (Consistent theme style) */}
        <div
          ref={cannonBaseRef}
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
        >
          {/* Rotating Barrel */}
          <div
            style={{
              transformOrigin: "bottom center",
              transform: `rotate(${cannonAngle}deg)`,
              transition: "transform 40ms linear",
            }}
            className="relative flex flex-col items-center"
          >
            {/* Cannon Muzzle Tip */}
            <div className="size-4 rounded-t-sm bg-blue-600 border border-blue-400 shadow-sm" />
            {/* Main Long Barrel */}
            <div className="w-5 h-14 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-800 rounded-t-sm border-x border-slate-500 shadow-md flex items-center justify-center">
              <div className="w-1.5 h-10 bg-blue-400 rounded-full" />
            </div>
          </div>

          {/* Cannon Base Turret */}
          <div className="relative -mt-2 size-16 rounded-full bg-white border-2 border-blue-500 shadow-md flex items-center justify-center">
            <div className="size-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
              <div className="size-3.5 rounded-full bg-blue-600" />
            </div>
          </div>

          {/* Base Stand */}
          <div className="-mt-3 h-3 w-28 rounded-t-lg bg-slate-800 border-t border-slate-700 shadow-inner" />
        </div>

        {/* Dynamic 2D drifting bubble animation */}
        <style jsx>{`
          @keyframes bubbleFloatAround {
            0% {
              transform: translate(0px, 0px);
            }
            33% {
              transform: translate(calc(var(--drift-x) * 0.7), calc(var(--drift-y) * -0.6));
            }
            66% {
              transform: translate(calc(var(--drift-x) * -0.5), calc(var(--drift-y) * 0.8));
            }
            100% {
              transform: translate(var(--drift-x), var(--drift-y));
            }
          }
        `}</style>

        {/* Paused Overlay */}
        {state.status === "PAUSED" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-white/90 p-4 text-center backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-slate-900">{t("paused")}</h2>
            <Button
              size="lg"
              onClick={() => {
                engine.resume();
                sync();
              }}
            >
              <Play />
              {t("resume")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onChange}>
              {t("change_sources")}
            </Button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="shrink-0 border-t border-slate-100 bg-white px-4 py-2 text-center text-xs text-slate-500">
        {t("shooter_play_hint")}
      </p>
    </section>
  );
}
