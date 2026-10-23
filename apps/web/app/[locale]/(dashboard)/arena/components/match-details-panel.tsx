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
                ? "bg-amber-50 text-amber-600"
                : selectedMatch.won
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600",
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
          <p className="mt-1.5 text-sm text-slate-500">
            {modeLabel(selectedMatch.mode)} · {timeLabel(selectedMatch.minutes)}
          </p>
          <div className="my-6 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-700">{text("Bạn", "You")}</span>
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {selectedMatch.mode === "word-chain"
                ? text("Nối từ", "Word Chain")
                : `${selectedMatch.score[0]} : ${selectedMatch.score[1]}`}
            </span>
            <span className="max-w-24 truncate text-sm font-semibold text-slate-700">
              {selectedMatch.name}
            </span>
          </div>
          {selectedMatch.mode === "word-chain" ? (
            <p className="text-sm font-semibold text-blue-600">
              {text(
                "Kết quả dựa trên số lượt nối từ hợp lệ",
                "Result based on valid word-chain turns",
              )}
            </p>
          ) : (
            <p
              className={cn(
                "text-sm font-semibold",
                selectedMatch.draw
                  ? "text-amber-600"
                  : selectedMatch.won
                    ? "text-emerald-600"
                    : "text-red-600",
              )}
            >
              {selectedMatch.points > 0 ? "+" : ""}
              {selectedMatch.points} {text("điểm xếp hạng", "rating points")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
