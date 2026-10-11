"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { recentMatches } from "../arena-data";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  | "text"
  | "setPanel"
  | "showAll"
  | "setShowAll"
  | "setSelectedMatch"
  | "modeLabel"
  | "timeLabel"
>;

export function RecentMatches({
  text,
  setPanel,
  showAll,
  setShowAll,
  setSelectedMatch,
  modeLabel,
  timeLabel,
}: Props) {
  return (
    <section className="overflow-hidden rounded border border-slate-200/70 bg-white">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">
          {text("Trận đấu gần đây", "Recent matches")}
        </h2>
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
        >
          {showAll
            ? text("Thu gọn", "Show less")
            : text("Xem tất cả", "View all")}
          <ArrowRight className="size-3" />
        </button>
      </div>
      <div className="px-3 pb-3">
        {recentMatches.slice(0, showAll ? undefined : 5).map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => {
              setSelectedMatch(match);
              setPanel("match");
            }}
            className="grid w-full cursor-pointer grid-cols-[1fr_52px_55px_16px] items-center gap-2 rounded-lg border-b border-slate-100 px-2 py-2.5 text-left transition-colors last:border-0 hover:bg-blue-50/50 sm:grid-cols-[1fr_60px_65px_100px_16px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar
                initials={match.initials}
                color={match.color}
                className="size-8"
              />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-800">
                  {match.name}
                </p>
                <p className="mt-0.5 text-[9px] text-slate-400">
                  {timeLabel(match.minutes)}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "w-fit rounded-md px-2 py-1 text-[10px] font-medium",
                match.won
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-500",
              )}
            >
              {match.won ? text("Thắng", "Win") : text("Thua", "Loss")}
            </span>
            <span className="text-center text-[11px] font-semibold tabular-nums text-slate-700">
              {match.score[0]} - {match.score[1]}
            </span>
            <span className="hidden w-fit rounded-md bg-blue-50/70 px-2 py-1 text-[9px] text-blue-500 sm:block">
              {modeLabel(match.mode)}
            </span>
            <ChevronRight className="size-4 text-blue-500" />
          </button>
        ))}
      </div>
    </section>
  );
}
