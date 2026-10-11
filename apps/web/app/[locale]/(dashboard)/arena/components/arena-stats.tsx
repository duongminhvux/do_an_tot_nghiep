"use client";

import { ArrowUp, BarChart3, Flame, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { arenaStats } from "../arena-data";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text" | "number">;

export function ArenaStats({ text, number }: Props) {
  return (
    <section
      aria-label={text("Thống kê của bạn", "Your statistics")}
      className="grid grid-cols-2 gap-3 xl:grid-cols-5"
    >
      {[
        {
          title: text("Hạng hiện tại", "Current rank"),
          value: `#${arenaStats.rank}`,
          icon: BarChart3,
          color: "text-blue-600 bg-blue-50",
          note: text("Top 12% người chơi", "Top 12% of players"),
          increase: arenaStats.rankChange,
        },
        {
          title: text("Điểm xếp hạng", "Rating"),
          value: number(arenaStats.rating),
          icon: Trophy,
          color: "text-amber-500 bg-amber-50",
          note: text("+35 hôm nay", "+35 today"),
          green: true,
        },
        {
          title: text("Tổng số trận", "Total matches"),
          value: arenaStats.total,
          icon: Target,
          color: "text-violet-600 bg-violet-50",
          note: text("Thắng 52 · Thua 34", "52 wins · 34 losses"),
        },
        {
          title: text("Chuỗi thắng", "Win streak"),
          value: text("5 trận", "5 matches"),
          icon: Flame,
          color: "text-orange-500 bg-orange-50",
          note: text("Kỷ lục: 8 trận", "Best: 8 matches"),
        },
        {
          title: text("Tỷ lệ thắng", "Win rate"),
          value: `${arenaStats.winRate}%`,
          icon: BarChart3,
          color: "text-blue-500 bg-blue-50",
          progress: true,
        },
      ].map((stat) => (
        <article
          key={stat.title}
          className="flex items-center gap-3 rounded border border-slate-200/70 bg-white px-4 py-4 last:col-span-2 xl:last:col-span-1"
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              stat.color,
            )}
          >
            <stat.icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-slate-500">
              {stat.title}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p
                className={cn(
                  "text-lg font-bold tracking-tight text-slate-900",
                  stat.progress && "text-blue-600",
                )}
              >
                {stat.value}
              </p>
              {stat.increase && (
                <span className="flex items-center rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-semibold text-emerald-600">
                  <ArrowUp className="size-3" />
                  {stat.increase}
                </span>
              )}
            </div>
            {stat.progress ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${arenaStats.winRate}%` }}
                />
              </div>
            ) : (
              <p
                className={cn(
                  "mt-0.5 text-[9px] text-slate-500",
                  stat.green && "text-emerald-500",
                )}
              >
                {stat.note}
              </p>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
