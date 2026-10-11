"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  "text" | "number" | "period" | "setPeriod" | "rankings"
>;

export function ArenaLeaderboard({
  text,
  number,
  period,
  setPeriod,
  rankings,
}: Props) {
  return (
    <section className="flex flex-col rounded border border-slate-200/70 bg-white p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold text-slate-900">
          {text("Bảng xếp hạng", "Leaderboard")}
        </h2>
        <div
          className="flex gap-1"
          role="tablist"
          aria-label={text("Khoảng thời gian", "Ranking period")}
        >
          {(["week", "month", "all"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={period === tab}
              type="button"
              onClick={() => setPeriod(tab)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1.5 text-[9px] font-medium transition-colors",
                period === tab
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : "bg-slate-50 text-slate-400 hover:bg-slate-100",
              )}
            >
              {tab === "week"
                ? text("Tuần này", "This week")
                : tab === "month"
                  ? text("Tháng này", "This month")
                  : text("Tất cả", "All time")}
            </button>
          ))}
        </div>
      </div>
      <div>
        {rankings.map((player, index) => (
          <div
            key={player.name}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2.5"
          >
            <span className="flex w-6 justify-center text-xs text-slate-500">
              {index < 3 ? (
                <Crown
                  className={cn(
                    "size-4 fill-current",
                    index === 0
                      ? "text-amber-400"
                      : index === 1
                        ? "text-slate-400"
                        : "text-orange-300",
                  )}
                />
              ) : (
                index + 1
              )}
            </span>
            <Avatar
              initials={player.initials}
              color={player.color}
              className="size-7 text-[9px]"
            />
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-600">
              {player.name}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-slate-800">
              {number(player[period])}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2.5 rounded-lg bg-blue-50 px-2 py-2.5">
        <span className="w-6 text-center text-[10px] text-blue-600">128</span>
        <span className="relative">
          <Avatar initials="VA" color="blue" className="size-7 text-[9px]" />
          <span className="absolute bottom-0 right-0 size-2 rounded-full border border-white bg-blue-600" />
        </span>
        <span className="flex-1 text-[11px] font-semibold text-blue-600">
          Nguyễn Văn A{" "}
          <span className="text-[9px] font-normal">({text("Bạn", "You")})</span>
        </span>
        <span className="text-[11px] font-bold text-blue-600">
          {number(period === "week" ? 1250 : period === "month" ? 1840 : 3120)}
        </span>
      </div>
    </section>
  );
}
