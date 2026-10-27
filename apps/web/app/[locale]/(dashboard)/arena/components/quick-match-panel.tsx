"use client";

import Image from "next/image";
import { ArenaIllustration } from './arena-illustration';

import {
  BarChart3,
  Clock3,
  Loader2,
  Shield,
  Swords,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { ArenaController } from "../hooks/use-arena-controller";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

type Props = Pick<
  ArenaController,
  | "text"
  | "number"
  | "panel"
  | "profile"
  | "rankedStatus"
  | "rankedError"
  | "handleFindMatch"
  | "rankedOpponent"
  | "matchCountdown"
  | "cancelRankedQueue"
>;

export function QuickMatchPanel({
  text,
  number,
  panel,
  profile,
  rankedStatus,
  rankedError,
  handleFindMatch,
  rankedOpponent,
  matchCountdown,
  cancelRankedQueue,
}: Props) {
  if (panel !== "rank") {
    return null;
  }
  if (rankedError)
    return (
      <div className="p-6 text-center">
        <p role="alert" className="text-sm text-red-600">
          {rankedError}
        </p>
        <Button onClick={handleFindMatch} className="mt-5">
          {text("Thử lại", "Retry")}
        </Button>
        <Button
          variant="ghost"
          onClick={cancelRankedQueue}
          className="mt-2 w-full"
        >
          {text("Hủy tìm trận", "Cancel")}
        </Button>
      </div>
    );

  const searching = rankedStatus === "SEARCHING";

  const matchFound = rankedStatus === "FOUND" && rankedOpponent !== null;

  const rating = profile?.rating ?? 0;

  const totalMatches = profile?.ranked?.matches ?? 0;

  const rankPosition =
    totalMatches > 0 ? (profile?.leaderboard?.position ?? 0) : 0;

  const rankValue =
    totalMatches > 0 && rankPosition > 0 ? `#${number(rankPosition)}` : "--";
  return (
    <div className="w-full text-center">
      <div className="w-full px-4 pb-5 pt-5 sm:px-6 sm:pb-6">
        {/* HEADER */}
        <div
          aria-hidden="true"
          className="relative mx-auto mb-1 flex h-9 w-16 items-center justify-center"
        >
          <Swords
            className="size-8 fill-blue-100 text-blue-600"
            strokeWidth={1.7}
          />
        </div>

        <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {matchFound
            ? text("Đã tìm thấy đối thủ!", "Opponent found!")
            : text("Đang tìm đối thủ", "Finding an opponent")}
        </h3>

        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          {text(
            "Đấu Rank 1v1 · Ghép cặp theo điểm xếp hạng",
            "Ranked 1v1 · Matched by rating",
          )}
        </p>

        <div
          className={cn(
            "mt-3",
            searching &&
              "sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6",
          )}
        >
          {/* SEARCHING */}
          {searching && <SearchingView text={text} />}

          {/* MATCH FOUND */}
          {matchFound && (
            <FoundView
              text={text}
              number={number}
              opponent={rankedOpponent}
              countdown={matchCountdown}
              myRating={rating}
            />
          )}

          <div className="min-w-0">
            {/* STATS */}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-0">
              <StatItem
                icon={Shield}
                label={text("Xếp hạng hiện tại", "Current tier")}
                value={rankValue}
                color="bg-amber-50 text-amber-600"
              />

              <StatItem
                icon={BarChart3}
                label={text("Điểm rank", "Rank rating")}
                value={number(rating)}
                color="bg-violet-50 text-violet-600"
              />

              <StatItem
                icon={Clock3}
                label={text("Trạng thái", "Status")}
                value={
                  matchFound
                    ? text("Đã ghép trận", "Match found")
                    : text("Đang tìm...", "Searching...")
                }
                color="bg-blue-50 text-blue-600"
              />
            </div>

            {/* SEARCH ACTION */}
            {searching && (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-1">
                <Button
                  type="button"
                  disabled
                  size="lg"
                  className="w-full px-3 disabled:opacity-100"
                >
                  <Loader2 className="animate-spin" />

                  {text("Đang tìm đối thủ...", "Searching for opponent...")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={cancelRankedQueue}
                  className="w-full px-3"
                >
                  {text("Hủy tìm trận", "Cancel search")}
                </Button>
              </div>
            )}

            {/* FOUND STATUS */}
            {matchFound && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-700">
                  {text(
                    `Trận đấu bắt đầu sau ${matchCountdown} giây`,
                    `Match starts in ${matchCountdown} seconds`,
                  )}
                </p>

                <p className="mt-0.5 text-xs text-emerald-600">
                  {text(
                    "Đang chuyển tới màn hình thi đấu...",
                    "Opening match...",
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   SEARCHING
   ====================================================== */

function SearchingView({ text }: { text: (vi: string, en: string) => string }) {
  return (
    <div className="py-1">
      <div className="relative mx-auto flex size-44 items-center justify-center sm:size-52">
        {/* radar circles */}
        <div className="absolute inset-0 rounded-full border border-blue-100 bg-blue-50/20" />

        <div className="absolute inset-5 rounded-full border border-blue-100 bg-blue-50/40" />

        <div className="absolute inset-10 rounded-full border border-blue-200/70 bg-blue-100/40" />

        <div className="absolute inset-[30%] rounded-full bg-blue-100/70 ring-8 ring-blue-50" />

        {/* animated radar dots */}
        <div className="absolute inset-10 animate-[spin_6s_linear_infinite]">
          <span className="absolute left-1 top-5 size-2 rounded-full bg-blue-500 shadow-[0_0_12px_#60a5fa]" />

          <span className="absolute bottom-4 right-2 size-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa]" />
        </div>

        {/* surrounding fake players */}
        <span className="absolute left-2 top-[42%] flex size-7 items-center justify-center rounded-full bg-slate-300 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>

        <span className="absolute right-6 top-7 flex size-8 items-center justify-center rounded-full bg-slate-300 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>

        <span className="absolute bottom-7 right-8 flex size-8 items-center justify-center rounded-full bg-slate-300 text-white ring-4 ring-blue-50">
          <UserRound className="size-4 fill-white" />
        </span>

        {/* current user */}
        <div className="relative size-16 overflow-hidden rounded-full border-4 border-white bg-blue-200 shadow-lg ring-4 ring-blue-200/60">
          <ArenaIllustration
            className="absolute -left-5 -top-2 h-auto w-[180px] max-w-none"
          />
        </div>
      </div>

      <p className="mx-auto mt-2 max-w-56 text-xs leading-5 text-slate-500">
        {text(
          "Đang tìm người chơi có trình độ phù hợp...",
          "Looking for a player at your skill level...",
        )}
      </p>

      <div className="mt-1 flex justify-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-bounce rounded-full bg-blue-500"
            style={{
              animationDelay: `${index * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ======================================================
   MATCH FOUND
   ====================================================== */

function FoundView({
  text,
  number,
  opponent,
  countdown,
  myRating,
}: {
  text: (vi: string, en: string) => string;

  number: (value: number) => string;

  opponent: {
    userId: string;
    rating: number;
    username?: string;
    avatar?: string;
  };

  countdown: number;

  myRating: number;
}) {
  const { user } = useSelector((state: RootState) => state.auth);
  return (
    <div className="py-3">
      <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        {/* YOU */}
        <PlayerCard
          label={text("Bạn", "You")}
          name={text("Bạn", "You")}
          rating={myRating}
          image={user?.avatarUrl ?? ""}
          number={number}
        />

        {/* VS */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-2xl font-black italic tracking-tight text-blue-600 sm:text-3xl">
            VS
          </span>

          <span className="mt-2 flex size-10 items-center justify-center rounded-full bg-blue-600 text-xl font-bold tabular-nums text-white shadow-sm sm:size-12">
            {countdown}
          </span>

          <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {text("Bắt đầu sau", "Starts in")}
          </span>
        </div>

        {/* OPPONENT */}
        <PlayerCard
          label={text("Đối thủ", "Opponent")}
          name={opponent.username ?? text("Người chơi", "Player")}
          rating={opponent.rating}
          image={opponent.avatar}
          number={number}
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-emerald-600">
        {text("Ghép trận thành công!", "Match found!")}
      </p>
    </div>
  );
}

/* ======================================================
   PLAYER CARD
   ====================================================== */

function PlayerCard({
  label,
  name,
  rating,
  image,
  number,
}: {
  label: string;
  name: string;
  rating: number;
  image?: string;
  number: (value: number) => string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-3 shadow-sm sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <div className="mx-auto mt-2 flex size-14 items-center justify-center overflow-hidden rounded-full bg-white bg-slate-100 ring-4 ring-slate-50 sm:size-16">
        {image ? (
          <Image
            src={image}
            alt={name}
            width={80}
            height={80}
            className="size-full object-cover"
          />
        ) : (
          <UserRound className="size-9 text-slate-400" />
        )}
      </div>

      <p className="mt-2 truncate text-sm font-bold text-slate-900">{name}</p>

      <p className="mt-1 text-sm font-semibold text-blue-600">
        {number(rating)} Elo
      </p>
    </div>
  );
}

/* ======================================================
   STAT
   ====================================================== */

function StatItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          color,
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="w-full min-w-0 text-center">
        <p className="text-[11px] leading-4 text-slate-500">{label}</p>

        <p className="mt-0.5 text-xs font-bold leading-4 text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}
