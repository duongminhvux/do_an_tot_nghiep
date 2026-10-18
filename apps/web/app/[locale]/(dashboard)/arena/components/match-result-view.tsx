"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Layers,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";
import type { FriendPlayer } from "@/lib/friendly-arena";
import { RoomStandings } from "./room-standings";
import { cn } from "@/lib/utils";

export interface MatchResultViewProps {
  standings?: FriendPlayer[];
  currentUserId?: string;
  winnerId?: string | null;
  won: boolean;
  isDraw: boolean;
  finishReason?: string;
  requiredLetter?: string;
  myScore: number;
  opponentScore: number;
  myName: string;
  opponentName: string;
  myAvatar?: string;
  opponentAvatar?: string;
  myRating?: number;
  ratingChange?: number;
  ratingAfter?: number;
  history?: boolean[];
  streak?: number;
  turnCount?: number;
  durationSeconds?: number;
  isFriendly?: boolean;
  isWordChain?: boolean;
  onBackToRoom?: () => void;
  resultNotice?: string;
  onBackToArena: () => void;
  onFindNextMatch?: () => void;
  locale?: string;
}

export function MatchResultView({
  standings,
  currentUserId,
  winnerId,
  won,
  isDraw,
  finishReason,
  requiredLetter,
  myScore,
  opponentScore,
  myName,
  opponentName,
  myAvatar,
  opponentAvatar,
  myRating,
  ratingChange,
  ratingAfter,
  history = [],
  streak = 0,
  turnCount,
  durationSeconds,
  isFriendly = false,
  isWordChain = false,
  onBackToRoom,
  resultNotice,
  onBackToArena,
  onFindNextMatch,
  locale = "vi",
}: MatchResultViewProps) {
  const vi = locale === "vi";

  // Calculate Accuracy
  const correctCount = history.filter(Boolean).length;
  const accuracy =
    history.length > 0
      ? Math.round((correctCount / history.length) * 100)
      : undefined;

  // Format finish reason
  const getFinishReasonText = () => {
    switch (finishReason) {
      case "PLAYER_LEFT":
        return vi
          ? "Người chơi đã rời khỏi trận đấu."
          : "A player has left the match.";
      case "TURN_TIMEOUT":
        return vi
          ? `Hết thời gian tìm từ${requiredLetter ? ` bắt đầu bằng chữ "${requiredLetter.toUpperCase()}"` : ""}.`
          : `Turn time expired${requiredLetter ? ` for a word starting with "${requiredLetter.toUpperCase()}"` : ""}.`;
      case "DISCONNECT_TIMEOUT":
        return vi
          ? "Hết thời gian chờ đối thủ kết nối lại."
          : "Reconnection grace period expired.";
      case "ALL_QUESTIONS_COMPLETED":
      case "COMPLETED":
        return vi
          ? "Đã hoàn thành toàn bộ câu hỏi thi đấu."
          : "Completed all match questions.";
      default:
        return finishReason
          ? vi
            ? "Trận đấu đã kết thúc."
            : "The match has ended."
          : "";
    }
  };

  const reasonText = getFinishReasonText();

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50 to-white px-3 py-6 sm:px-6">
      <div className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-md sm:p-9">
          {/* Header Glow Backdrop */}
          <div
            className={cn(
              "pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl opacity-35",
              won ? "bg-amber-400" : isDraw ? "bg-blue-400" : "bg-rose-400",
            )}
          />

          {/* Trophy / Result Icon */}
          <div className="relative mx-auto flex flex-col items-center text-center">
            <div
              className={cn(
                "relative flex size-24 items-center justify-center rounded-3xl p-1 shadow-lg transition-transform",
                won
                  ? "bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-200 text-amber-950 shadow-amber-500/25 ring-8 ring-amber-100/70"
                  : isDraw
                    ? "bg-gradient-to-tr from-blue-500 via-indigo-400 to-sky-300 text-white shadow-blue-500/25 ring-8 ring-blue-100/70"
                    : "bg-gradient-to-tr from-slate-600 via-slate-500 to-slate-400 text-white shadow-slate-500/25 ring-8 ring-slate-100/70",
              )}
            >
              {won ? (
                <>
                  <Trophy className="size-12 animate-pulse" />
                  <Sparkles className="absolute -right-2 -top-2 size-6 text-amber-500" />
                  <Crown className="absolute -left-2 -top-3 size-6 -rotate-12 text-amber-500" />
                </>
              ) : isDraw ? (
                <Swords className="size-12" />
              ) : (
                <Shield className="size-12 text-slate-100" />
              )}
            </div>

            {/* Title */}
            <h1
              className={cn(
                "mt-6 text-3xl font-black tracking-tight sm:text-4xl",
                won
                  ? "text-transparent bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text"
                  : isDraw
                    ? "text-blue-600"
                    : "text-slate-800",
              )}
            >
              {won
                ? vi
                  ? "CHIẾN THẮNG!"
                  : "VICTORY!"
                : isDraw
                  ? vi
                    ? "HÒA NHAU!"
                    : "DRAW!"
                  : vi
                    ? "THẤT BẠI"
                    : "DEFEAT"}
            </h1>

            <p className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">
              {won
                ? vi
                  ? "Xuất sắc! Bạn đã thi đấu ấn tượng và giành chiến thắng."
                  : "Outstanding play! You dominated the arena."
                : isDraw
                  ? vi
                    ? "Một trận đấu nghẹt thở cân tài cân sức đến giây phút cuối."
                    : "An intense battle of equal skill until the very end."
                  : vi
                    ? "Đừng nản lòng! Hãy tích lũy thêm từ vựng và phục thù ở trận sau."
                    : "Good effort! Sharpen your reflexes and challenge again."}
            </p>

            {reasonText && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/80 px-3.5 py-1 text-[11px] font-semibold text-slate-600">
                <span>{reasonText}</span>
              </div>
            )}
          </div>

          {/* Versus Score Card */}
          <div className="relative mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-5 shadow-inner sm:p-6">
            {standings ? (
              <RoomStandings
                players={standings}
                currentUserId={currentUserId}
                winnerId={winnerId}
                vi={vi}
              />
            ) : (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                {/* YOU */}
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative size-16 sm:size-20 overflow-hidden rounded-2xl ring-4 shadow-md",
                      won
                        ? "ring-amber-400 shadow-amber-200"
                        : "ring-blue-200 shadow-slate-100",
                    )}
                  >
                    {myAvatar ? (
                      <Image
                        src={myAvatar}
                        alt={myName}
                        width={80}
                        height={80}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-blue-100 text-blue-600">
                        <UserRound className="size-8 sm:size-10" />
                      </div>
                    )}
                    {won && (
                      <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[9px] font-black text-amber-950 py-0.5 uppercase tracking-wider">
                        {vi ? "THẮNG" : "WINNER"}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <span className="truncate max-w-[110px] text-xs font-bold text-slate-800 sm:text-sm">
                      {myName}
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-700">
                      {vi ? "BẠN" : "YOU"}
                    </span>
                  </div>

                  {!isWordChain && (
                    <p
                      className={cn(
                        "mt-1 text-3xl font-black tabular-nums sm:text-4xl",
                        won ? "text-amber-600" : "text-blue-600",
                      )}
                    >
                      {myScore}
                      <span className="ml-1 text-xs font-medium text-slate-400">
                        {vi ? "điểm" : "pts"}
                      </span>
                    </p>
                  )}
                </div>

                {/* VS Divider */}
                <div className="flex flex-col items-center px-2">
                  <span className="text-2xl sm:text-3xl font-black italic tracking-tighter text-slate-300">
                    VS
                  </span>
                  <span className="mt-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {isWordChain
                      ? vi
                        ? "Nối từ"
                        : "Word Chain"
                      : vi
                        ? "Cổ điển 1v1"
                        : "Classic 1v1"}
                  </span>
                </div>

                {/* OPPONENT */}
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative size-16 sm:size-20 overflow-hidden rounded-2xl ring-4 shadow-md",
                      !won && !isDraw
                        ? "ring-amber-400 shadow-amber-200"
                        : "ring-violet-200 shadow-slate-100",
                    )}
                  >
                    {opponentAvatar ? (
                      <Image
                        src={opponentAvatar}
                        alt={opponentName}
                        width={80}
                        height={80}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-violet-100 text-violet-600">
                        <UserRound className="size-8 sm:size-10" />
                      </div>
                    )}
                    {!won && !isDraw && (
                      <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[9px] font-black text-amber-950 py-0.5 uppercase tracking-wider">
                        {vi ? "THẮNG" : "WINNER"}
                      </span>
                    )}
                  </div>

                  <span className="mt-3 truncate max-w-[120px] text-xs font-bold text-slate-800 sm:text-sm">
                    {opponentName}
                  </span>

                  {!isWordChain && (
                    <p
                      className={cn(
                        "mt-1 text-3xl font-black tabular-nums sm:text-4xl",
                        !won && !isDraw ? "text-amber-600" : "text-violet-600",
                      )}
                    >
                      {opponentScore}
                      <span className="ml-1 text-xs font-medium text-slate-400">
                        {vi ? "điểm" : "pts"}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Elo Change Badge (Ranked Mode Only) */}
            {!isFriendly && ratingChange !== undefined && (
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl",
                      ratingChange > 0
                        ? "bg-emerald-50 text-emerald-600"
                        : ratingChange < 0
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-50 text-slate-600",
                    )}
                  >
                    <Award className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {vi ? "Điểm xếp hạng Elo" : "Rank Rating (Elo)"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {ratingAfter !== undefined
                        ? vi
                          ? `Hiện tại: ${ratingAfter.toLocaleString(locale)} Elo`
                          : `Current: ${ratingAfter.toLocaleString(locale)} Elo`
                        : myRating !== undefined
                          ? `${myRating.toLocaleString(locale)} Elo`
                          : ""}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-1 rounded-xl px-3 py-1.5 text-base font-black tabular-nums",
                    ratingChange > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : ratingChange < 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-700",
                  )}
                >
                  <span>
                    {ratingChange > 0 ? `+${ratingChange}` : ratingChange}
                  </span>
                  <span className="text-[10px] font-bold">Elo</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance Stats Chips */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {accuracy !== undefined && (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Target className="size-4" />
                </div>
                <span className="mt-2 text-base font-black text-slate-800 tabular-nums">
                  {accuracy}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {vi ? "Chính xác" : "Accuracy"}
                </span>
              </div>
            )}

            {streak > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Flame className="size-4" />
                </div>
                <span className="mt-2 text-base font-black text-slate-800 tabular-nums">
                  {streak}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {vi ? "Chuỗi cao nhất" : "Max Streak"}
                </span>
              </div>
            )}

            {turnCount !== undefined && turnCount > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Layers className="size-4" />
                </div>
                <span className="mt-2 text-base font-black text-slate-800 tabular-nums">
                  {turnCount}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isWordChain
                    ? vi
                      ? "Từ đã nối"
                      : "Words linked"
                    : vi
                      ? "Lượt trả lời"
                      : "Turns"}
                </span>
              </div>
            )}

            {durationSeconds !== undefined && durationSeconds > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Clock className="size-4" />
                </div>
                <span className="mt-2 text-base font-black text-slate-800 tabular-nums">
                  {Math.floor(durationSeconds / 60)}
                  {vi ? " phút " : "m "}
                  {durationSeconds % 60}
                  {vi ? " giây" : "s"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {vi ? "Thời gian" : "Duration"}
                </span>
              </div>
            )}
          </div>

          {/* Result Notice */}
          {resultNotice && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/80 p-2.5 text-center text-xs font-semibold text-blue-700 animate-pulse">
              {resultNotice}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            {isFriendly && onBackToRoom && (
              <button
                type="button"
                onClick={onBackToRoom}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-xs sm:text-sm font-bold text-white transition",
                  "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-500/25",
                  "hover:brightness-110 active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <RotateCcw className="size-4" />
                <span>{vi ? "Trở về phòng" : "Back to room"}</span>
              </button>
            )}

            {!isFriendly && onFindNextMatch && (
              <button
                type="button"
                onClick={onFindNextMatch}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-xs sm:text-sm font-bold text-white transition",
                  "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-500/25",
                  "hover:brightness-110 active:scale-[0.99]",
                )}
              >
                <Zap className="size-4" />
                <span>{vi ? "Tìm trận tiếp theo" : "Find Next Match"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToArena}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6",
                "text-xs sm:text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900",
                isFriendly ? "flex-1" : "flex-1 sm:flex-initial",
              )}
            >
              <ArrowLeft className="size-4" />
              <span>{vi ? "Về đấu trường" : "Back to Arena"}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
