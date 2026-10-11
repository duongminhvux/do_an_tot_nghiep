"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  | "recentMatches"
  | "matchesLoading"
  | "matchesError"
  | "retryMatches"
>;

export function RecentMatches({
  text,
  setPanel,
  showAll,
  setShowAll,
  setSelectedMatch,
  modeLabel,
  timeLabel,
  recentMatches,
  matchesLoading,
  matchesError,
  retryMatches,
}: Props) {
  return (
    <section className="@container/matches min-w-0 overflow-hidden rounded border border-slate-200/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-4 sm:px-5">
        <h2 className="text-sm font-bold text-slate-900">
          {text("Trận đấu gần đây", "Recent matches")}
        </h2>
        {recentMatches.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
          >
            {showAll
              ? text("Thu gọn", "Show less")
              : text("Xem thêm", "Show more")}
            <ArrowRight className="size-3" />
          </button>
        )}
      </div>
      <div className="px-2 pb-3 sm:px-3">
        {matchesLoading ? (
          <p
            role="status"
            className="px-3 py-8 text-center text-xs text-slate-400"
          >
            {text("Đang tải trận đấu...", "Loading matches...")}
          </p>
        ) : matchesError ? (
          <div
            role="alert"
            className="px-3 py-8 text-center text-xs text-rose-600"
          >
            {text("Không thể tải trận đấu.", "Unable to load matches.")}{" "}
            <button
              type="button"
              onClick={() => void retryMatches()}
              className="font-semibold underline"
            >
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : recentMatches.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">
            {text("Chưa có trận đấu hoàn thành.", "No completed matches yet.")}
          </p>
        ) : (
          recentMatches.slice(0, showAll ? undefined : 5).map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => {
                setSelectedMatch(match);
                setPanel("match");
              }}
              className="grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_44px_48px_16px] items-center gap-1.5 rounded-lg border-b border-slate-100 px-1 py-2.5 text-left transition-colors last:border-0 hover:bg-blue-50/50 @min-[520px]/matches:grid-cols-[minmax(0,1fr)_60px_65px_100px_16px] @min-[520px]/matches:gap-2 @min-[520px]/matches:px-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  initials={match.initials}
                  image={match.avatarUrl}
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
                  match.draw
                    ? "bg-slate-100 text-slate-600"
                    : match.won
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-500",
                )}
              >
                {match.draw
                  ? text("Hòa", "Draw")
                  : match.won
                    ? text("Thắng", "Win")
                    : text("Thua", "Loss")}
              </span>
              <span className="text-center text-[11px] font-semibold tabular-nums text-slate-700">
                {match.score[0]} - {match.score[1]}
              </span>
              <span className="hidden w-fit rounded-md bg-blue-50/70 px-2 py-1 text-[9px] text-blue-500 @min-[520px]/matches:block">
                {modeLabel(match.mode)}
              </span>
              <ChevronRight className="size-4 text-blue-500" />
            </button>
          ))
        )}
      </div>
    </section>
  );
}
