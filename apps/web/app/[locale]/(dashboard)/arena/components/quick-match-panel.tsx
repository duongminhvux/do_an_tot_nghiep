"use client";

import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Loader2,
  Shield,
  Sparkles,
  Swords,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { arenaStats } from "../arena-data";
import type { ArenaController } from "../hooks/use-arena-controller";
import { arenaSocket } from "@/lib/arena-socket";

type Props = Pick<
  ArenaController,
  | "text"
  | "panel"
  | "setPanel"
  | "setOpponent"
  | "found"
  | "startGame"
  | "button"
>;

export function QuickMatchPanel({
  text,
  panel,
  setPanel,
  setOpponent,
  found,
  startGame,
  button,
}: Props) {
  if (panel !== "rank") return null;

  const handleCancel = () => {
    arenaSocket.emit('arena:leave-queue');
    setPanel(null);
    setOpponent("");
  };

  return (
    <div className="text-center">
      <div
        aria-hidden="true"
        className="relative mx-auto mb-2 flex h-12 w-20 items-center justify-center"
      >
        <Swords
          className="size-10 fill-blue-200 text-blue-500"
          strokeWidth={1.6}
        />
        <Sparkles className="absolute left-0 top-4 size-3 text-blue-300" />
        <Sparkles className="absolute right-0 top-2 size-3 text-blue-300" />
      </div>
      <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
        {found
          ? text("Đã tìm thấy đối thủ!", "Opponent found!")
          : text("Đang tìm đối thủ", "Finding an opponent")}
      </h3>
      <p className="mt-1 text-[11px] text-slate-500">
        {text(
          "Đấu rank 1v1 · Ghép cặp theo điểm",
          "Ranked 1v1 · Matched by rating",
        )}
      </p>

      <div
        aria-hidden="true"
        className="relative mx-auto my-5 flex size-48 items-center justify-center sm:size-52"
      >
        <div className="absolute inset-1 rounded-full border border-blue-100/70 bg-blue-50/30" />
        <div className="absolute inset-5 rounded-full border border-blue-100 bg-blue-50/60" />
        <div className="absolute inset-9 rounded-full border border-blue-200/80 bg-blue-100/40" />
        <div className="absolute inset-[54px] rounded-full bg-blue-100/70 ring-8 ring-blue-50/80" />
        {!found && (
          <div className="absolute inset-9 motion-safe:animate-[spin_6s_linear_infinite]">
            <span className="absolute left-1 top-4 size-2 rounded-full bg-blue-500 shadow-[0_0_8px_#60a5fa]" />
            <span className="absolute bottom-3 right-2 size-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
          </div>
        )}
        <span className="absolute left-1 top-[84px] flex size-7 items-center justify-center rounded-full bg-slate-300/80 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>
        <span className="absolute right-5 top-5 flex size-7 items-center justify-center rounded-full bg-slate-300/80 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>
        <span className="absolute bottom-6 right-7 flex size-7 items-center justify-center rounded-full bg-slate-300/80 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>
        <span className="absolute right-0 top-[94px] size-2 rounded-full bg-blue-500 shadow-[0_0_8px_#60a5fa]" />
        <span className="absolute left-6 top-8 size-3 rounded-full bg-blue-100 blur-[1px]" />
        <div
          className={cn(
            "relative size-16 overflow-hidden rounded-full border-[3px] border-white bg-blue-200 shadow-md ring-4 ring-blue-200/60",
            found && "ring-emerald-200",
          )}
        >
          <Image
            src="/images/arena/arena-hero.png"
            alt=""
            width={170}
            height={113}
            className="absolute -left-[17px] -top-2 h-auto w-[170px] max-w-none"
          />
        </div>
      </div>

      <div className="min-h-10" role="status" aria-live="polite">
        <p className="text-[11px] text-slate-500">
          {found
            ? "Lê Hoàng Minh · 1,320 Elo"
            : text(
              "Đang tìm người chơi có trình độ phù hợp...",
              "Looking for a player at your skill level...",
            )}
        </p>
        {!found && (
          <div
            aria-hidden="true"
            className="mt-2.5 flex justify-center gap-1.5"
          >
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="size-1.5 rounded-full bg-blue-500 motion-safe:animate-bounce"
                style={{ animationDelay: `${index * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 mt-3 grid grid-cols-[1fr_1fr_1.25fr] gap-1.5 rounded border border-blue-100/70 bg-white/75 p-2">
        {[
          {
            icon: Shield,
            label: text("Xếp hạng hiện tại", "Current tier"),
            value: "Gold II",
            color: "bg-amber-50 text-amber-500",
          },
          {
            icon: BarChart3,
            label: text("Điểm rank", "Rank rating"),
            value: arenaStats.rating.toLocaleString("en-US"),
            color: "bg-violet-50 text-violet-500",
          },
          {
            icon: Clock3,
            label: text("Thời gian chờ ước tính", "Estimated wait"),
            value: text("10 – 20 giây", "10 – 20 sec"),
            color: "bg-blue-50 text-blue-500",
          },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded",
                stat.color,
              )}
            >
              <stat.icon className="size-4" />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[8px] leading-3 text-slate-400">
                {stat.label}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-800">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {found ? (
        <button
          type="button"
          onClick={() => {
            setOpponent("Lê Hoàng Minh");
            startGame();
          }}
          className={cn(
            button,
            "w-full rounded bg-blue-600 text-white hover:bg-blue-700",
          )}
        >
          {text("Bắt đầu trận đấu thử", "Start demo match")}
          <ArrowRight className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          disabled
          className={cn(
            button,
            "w-full rounded bg-gradient-to-r from-blue-400 to-blue-500 text-white disabled:opacity-80",
          )}
        >
          <Loader2 className="size-3.5 motion-safe:animate-spin" />
          {text("Đang tìm...", "Searching...")}
        </button>
      )}
      <button
        type="button"
        onClick={handleCancel}
        className={cn(
          button,
          "mt-2 w-full rounded border border-slate-200 bg-white/60 text-slate-500 hover:bg-slate-100",
        )}
      >
        {text("Hủy tìm trận", "Cancel search")}
      </button>
    </div>
  );
}
