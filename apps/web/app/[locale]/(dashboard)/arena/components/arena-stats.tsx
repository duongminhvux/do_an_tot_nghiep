"use client";

import { BarChart3, Flame, Target, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/page";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text" | "number" | "profile">;

export function ArenaStats({ text, number, profile }: Props) {
  const rating = profile?.rating ?? 0;

  const totalMatches = profile?.ranked?.matches ?? 0;

  const rankPosition =
    totalMatches > 0 ? (profile?.leaderboard?.position ?? 0) : 0;

  const topPercent =
    totalMatches > 0 ? (profile?.leaderboard?.topPercent ?? 0) : 0;

  const todayRatingChange = profile?.todayRatingChange ?? 0;

  const wins = profile?.ranked?.wins ?? 0;

  const losses = profile?.ranked?.losses ?? 0;

  const currentStreak = profile?.ranked?.currentWinStreak ?? 0;

  const bestStreak = profile?.ranked?.bestWinStreak ?? 0;

  const winRate = profile?.ranked?.winRate ?? 0;

  const stats = [
    {
      title: text("Hạng hiện tại", "Current rank"),
      value:
        totalMatches > 0 && rankPosition > 0
          ? `#${number(rankPosition)}`
          : "--",
      icon: BarChart3,
      color: "text-blue-600 bg-blue-50",
      note:
        totalMatches > 0 && topPercent > 0
          ? text(
              `Top ${topPercent}% người chơi`,
              `Top ${topPercent}% of players`,
            )
          : text("Chưa có hạng", "Not ranked yet"),
    },

    {
      title: text("Điểm xếp hạng", "Rating"),
      value: profile ? `${number(rating)} Elo` : "—",
      icon: Trophy,
      color: "text-amber-500 bg-amber-50",
      note: profile
        ? text(
            `Hôm nay: ${todayRatingChange > 0 ? "+" : ""}${number(todayRatingChange)} Elo`,
            `Today: ${todayRatingChange > 0 ? "+" : ""}${number(todayRatingChange)} Elo`,
          )
        : text("Đang tải Elo…", "Loading Elo…"),
      ratingChange: todayRatingChange,
    },

    {
      title: text("Tổng số trận", "Total matches"),
      value: number(totalMatches),
      icon: Target,
      color: "text-violet-600 bg-violet-50",
      note: text(
        `Thắng ${number(wins)} · Thua ${number(losses)}`,
        `${number(wins)} wins · ${number(losses)} losses`,
      ),
    },

    {
      title: text("Chuỗi thắng", "Win streak"),
      value: text(
        `${number(currentStreak)} trận`,
        `${number(currentStreak)} matches`,
      ),
      icon: Flame,
      color: "text-orange-500 bg-orange-50",
      note: text(
        `Kỷ lục: ${number(bestStreak)} trận`,
        `Best: ${number(bestStreak)} matches`,
      ),
    },

    {
      title: text("Tỷ lệ thắng", "Win rate"),
      value: `${winRate}%`,
      icon: BarChart3,
      color: "text-blue-500 bg-blue-50",
      progress: true,
    },
  ];

  return (
    <section
      aria-label={text("Thống kê của bạn", "Your statistics")}
      className="grid min-w-0 gap-3 @min-[340px]/arena:grid-cols-2 @min-[640px]/arena:grid-cols-3 @min-[1080px]/arena:grid-cols-5 sm:gap-4"
    >
      {stats.map((stat) => {
        const isPositive =
          stat.ratingChange !== undefined && stat.ratingChange > 0;

        const isNegative =
          stat.ratingChange !== undefined && stat.ratingChange < 0;

        return (
          <article
            key={stat.title}
            className={cn(surface, "flex min-w-0 items-center gap-3 p-4 @min-[340px]/arena:last:col-span-2 @min-[640px]/arena:p-5 @min-[640px]/arena:last:col-span-1")}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl @min-[640px]/arena:size-11",
                stat.color,
              )}
            >
              <stat.icon className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">
                {stat.title}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className={cn(
                    "text-xl font-bold tracking-tight text-slate-900",
                    stat.progress && "text-blue-600",
                  )}
                >
                  {stat.value}
                </p>
              </div>

              {stat.progress ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, winRate))}%`,
                    }}
                  />
                </div>
              ) : (
                <p
                  className={cn(
                    "mt-0.5 text-xs text-slate-500",
                    isPositive && "text-emerald-600",
                    isNegative && "text-red-600",
                  )}
                >
                  {stat.note}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
