"use client";

import { Crown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Segmented,
  surface,
} from "@/components/ui/page";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  | "text"
  | "number"
  | "period"
  | "setPeriod"
  | "rankings"
  | "leaderboardMe"
  | "currentUser"
  | "profile"
  | "rankingsLoading"
  | "rankingsError"
  | "retryRankings"
>;

export function ArenaLeaderboard({
  text,
  number,
  period,
  setPeriod,
  rankings,
  leaderboardMe,
  currentUser,
  profile,
  rankingsLoading,
  rankingsError,
  retryRankings,
}: Props) {
  return (
    <section className={cn(surface, "flex min-w-0 flex-col p-4 sm:p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {text("Bảng xếp hạng", "Leaderboard")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {text(
              "Elo · đã hoàn thành trận rank",
              "Elo · completed ranked matches",
            )}
          </p>
        </div>
        <Segmented
          value={period}
          onChange={setPeriod}
          items={[
            { value: "week" as const, label: text("Tuần này", "This week") },
            { value: "month" as const, label: text("Tháng này", "This month") },
            { value: "all" as const, label: text("Tất cả", "All time") },
          ]}
        />
      </div>
      <div>
        {rankingsLoading ? (
          <LoadingState
            className="min-h-[160px]"
            label={text("Đang tải bảng xếp hạng...", "Loading rankings...")}
          />
        ) : rankingsError ? (
          <ErrorState
            message={text(
              "Không thể tải bảng xếp hạng.",
              "Unable to load rankings.",
            )}
            onRetry={() => void retryRankings()}
            retryLabel={text("Thử lại", "Retry")}
          />
        ) : rankings.length === 0 ? (
          <EmptyState
            icon={Trophy}
            className="py-8"
            title={text(
              "Chưa có người chơi hoàn thành trận rank trong khoảng này.",
              "No completed ranked matches in this period.",
            )}
          />
        ) : (
          rankings.map((player, index) => (
            <div
              key={player.userId}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
            >
              <span className="flex w-6 justify-center text-xs font-semibold text-slate-500">
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
                  player.position
                )}
              </span>
              <Avatar
                initials={player.initials}
                image={player.avatarUrl}
                color={player.color}
                className="size-8 text-[11px]"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                {player.name}
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-900">
                {number(player.rating)}
              </span>
            </div>
          ))
        )}
      </div>
      {!rankingsLoading && !rankingsError && (
        <div className="mt-auto flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-2 py-2.5">
          <span className="w-6 text-center text-xs font-semibold text-blue-600">
            {leaderboardMe?.position ?? "--"}
          </span>
          <span className="relative">
            <Avatar
              initials={
                leaderboardMe?.initials ??
                (currentUser?.username?.slice(0, 2).toUpperCase() || "?")
              }
              image={leaderboardMe?.avatarUrl ?? currentUser?.avatarUrl}
              color="blue"
              className="size-8 text-[11px]"
            />
            <span className="absolute bottom-0 right-0 size-2 rounded-full border border-white bg-blue-600" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-700">
            {leaderboardMe?.name ?? currentUser?.username ?? text("Bạn", "You")}{" "}
            <span className="text-xs font-normal">
              ({text("Bạn", "You")})
            </span>
            {!leaderboardMe && (
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                {text(
                  "Chưa có hạng trong khoảng này",
                  "Not ranked in this period",
                )}
              </span>
            )}
          </span>
          <span className="text-sm font-bold tabular-nums text-blue-700">
            {number(leaderboardMe?.rating ?? profile?.rating ?? 0)}
          </span>
        </div>
      )}
    </section>
  );
}
