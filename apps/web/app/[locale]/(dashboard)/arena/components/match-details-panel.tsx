"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  "text" | "panel" | "selectedMatch" | "modeLabel" | "timeLabel"
>;

export function MatchDetailsPanel({
  text,
  panel,
  selectedMatch,
  modeLabel,
  timeLabel,
}: Props) {
  return (
    <>
      {panel === "match" && selectedMatch && (
        <div className="mt-5 text-center">
          <span
            className={cn(
              "mx-auto flex size-16 items-center justify-center rounded-full",
              selectedMatch.draw
                ? "bg-blue-50 text-blue-500"
                : selectedMatch.won
                  ? "bg-emerald-50 text-emerald-500"
                  : "bg-rose-50 text-rose-500",
            )}
          >
            <Trophy className="size-8" />
          </span>
          <h3 className="mt-3 text-xl font-bold text-slate-900">
            {selectedMatch.draw
              ? text("Hòa!", "Draw!")
              : selectedMatch.won
                ? text("Chiến thắng!", "Victory!")
                : text("Cố gắng ở trận sau!", "Better luck next time!")}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            {modeLabel(selectedMatch.mode)} · {timeLabel(selectedMatch.minutes)}
          </p>
          <div className="my-6 flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <span className="text-xs font-semibold">{text("Bạn", "You")}</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {selectedMatch.score[0]} : {selectedMatch.score[1]}
            </span>
            <span className="max-w-24 text-xs font-semibold">
              {selectedMatch.name}
            </span>
          </div>
          <p
            className={cn(
              "text-sm font-semibold",
              selectedMatch.draw
                ? "text-blue-600"
                : selectedMatch.won
                  ? "text-emerald-600"
                  : "text-rose-500",
            )}
          >
            {selectedMatch.points > 0 ? "+" : ""}
            {selectedMatch.points} {text("điểm xếp hạng", "rating points")}
          </p>
        </div>
      )}
    </>
  );
}
