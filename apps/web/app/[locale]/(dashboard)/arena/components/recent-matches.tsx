"use client";

import { ArrowRight, ChevronRight, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  surface,
} from "@/components/ui/page";
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
    <section className={cn(surface, "@container/matches min-w-0 overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-base font-semibold text-slate-900">
          {text("Trận đấu gần đây", "Recent matches")}
        </h2>
        {recentMatches.length > 5 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="h-auto px-0"
          >
            {showAll
              ? text("Thu gọn", "Show less")
              : text("Xem thêm", "Show more")}
            <ArrowRight />
          </Button>
        )}
      </div>
      <div className="px-2 pb-3 sm:px-3 sm:pb-4">
        {matchesLoading ? (
          <LoadingState
            className="min-h-[160px]"
            label={text("Đang tải trận đấu...", "Loading matches...")}
          />
        ) : matchesError ? (
          <div className="px-2">
            <ErrorState
              message={text("Không thể tải trận đấu.", "Unable to load matches.")}
              onRetry={() => void retryMatches()}
              retryLabel={text("Thử lại", "Retry")}
            />
          </div>
        ) : recentMatches.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon={Swords}
              className="py-8"
              title={text(
                "Chưa có trận đấu hoàn thành.",
                "No completed matches yet.",
              )}
            />
          </div>
        ) : (
          recentMatches.slice(0, showAll ? undefined : 5).map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => {
                setSelectedMatch(match);
                setPanel("match");
              }}
              className="grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_52px_48px_16px] items-center gap-1.5 rounded-lg border-b border-slate-100 px-1 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50 @min-[520px]/matches:grid-cols-[minmax(0,1fr)_64px_65px_110px_16px] @min-[520px]/matches:gap-2 @min-[520px]/matches:px-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  initials={match.initials}
                  image={match.avatarUrl}
                  color={match.color}
                  className="size-8"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {match.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {timeLabel(match.minutes)}
                  </p>
                </div>
              </div>
              <Badge
                className="w-fit"
                tone={match.draw ? "amber" : match.won ? "emerald" : "red"}
              >
                {match.draw
                  ? text("Hòa", "Draw")
                  : match.won
                    ? text("Thắng", "Win")
                    : text("Thua", "Loss")}
              </Badge>
              <span className="text-center text-sm font-semibold tabular-nums text-slate-700">
                {match.mode === "word-chain"
                  ? text("Nối từ", "Word Chain")
                  : `${match.score[0]} - ${match.score[1]}`}
              </span>
              <Badge
                tone="blue"
                className="hidden w-fit max-w-full truncate @min-[520px]/matches:inline-flex"
              >
                {modeLabel(match.mode)}
              </Badge>
              <ChevronRight className="size-4 text-slate-400" />
            </button>
          ))
        )}
      </div>
    </section>
  );
}
