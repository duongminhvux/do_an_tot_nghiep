"use client";
import { GameAudioToggle } from "@/features/minigames/shared/game-audio-toggle";

import Image from "next/image";
import {
  ArrowLeft,
  Award,
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
import { Button } from "@/components/ui/button";
import { surface } from "@/components/ui/page";

export interface MatchResultViewProps {
  audioEnabled?: boolean;
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
  audioEnabled = true,
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
      case 'DISCONNECT_FORFEIT':
        return vi ? 'Trận đấu kết thúc do người chơi không kết nối lại đúng hạn.' : 'The match ended because a player did not reconnect in time.';
      case 'BOTH_DISCONNECTED':
        return vi ? 'Cả hai người chơi mất kết nối quá hạn. Trận đã hủy và không thay đổi Elo.' : 'Both players exceeded their reconnect deadline. The match was cancelled without changing Elo.';
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
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-background px-3 py-6 sm:px-6">
      <div className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="mb-3 flex justify-end"><GameAudioToggle enabled={audioEnabled} /></div>
        <div className={cn(surface, "relative overflow-hidden p-6 sm:p-8")}>
          {/* Result accent */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-1",
              won ? "bg-emerald-500" : isDraw ? "bg-amber-400" : "bg-red-400",
            )}
          />

          {/* Trophy / Result Icon */}
          <div className="relative mx-auto flex flex-col items-center text-center">
            <div
              className={cn(
                "relative flex size-20 items-center justify-center rounded-2xl ring-8",
                won
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-50/60"
                  : isDraw
                    ? "bg-amber-50 text-amber-600 ring-amber-50/60"
                    : "bg-red-50 text-red-600 ring-red-50/60",
              )}
            >
              {won ? (
                <>
                  <Trophy className="size-10" />
                  <Sparkles className="absolute -right-2 -top-2 size-5 text-amber-500" />
                  <Crown className="absolute -left-2 -top-3 size-5 -rotate-12 text-amber-500" />
                </>
              ) : isDraw ? (
                <Swords className="size-10" />
              ) : (
                <Shield className="size-10" />
              )}
            </div>

            {/* Title */}
            <h1
              className={cn(
                "mt-5 text-2xl font-bold tracking-tight sm:text-3xl",
                won
                  ? "text-emerald-600"
                  : isDraw
                    ? "text-amber-600"
                    : "text-red-600",
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

            <p className="mt-1.5 text-sm text-slate-500">
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
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                <span>{reasonText}</span>
              </div>
            )}
          </div>

          {/* Versus Score Card */}
          <div className="relative mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
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
                      "relative size-16 overflow-hidden rounded-xl ring-4 sm:size-20",
                      won ? "ring-emerald-400" : "ring-blue-100",
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
                      <span className="absolute inset-x-0 bottom-0 bg-emerald-600 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                        {vi ? "THẮNG" : "WINNER"}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <span className="max-w-[110px] truncate text-sm font-semibold text-slate-900">
                      {myName}
                    </span>
                    <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
                      {vi ? "BẠN" : "YOU"}
                    </span>
                  </div>

                  {!isWordChain && (
                    <p
                      className={cn(
                        "mt-1 text-3xl font-black tabular-nums sm:text-4xl",
                        won ? "text-emerald-600" : "text-blue-600",
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
                  <span className="text-2xl font-black italic tracking-tighter text-slate-300 sm:text-3xl">
                    VS
                  </span>
                  <span className="mt-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
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
                      "relative size-16 overflow-hidden rounded-xl ring-4 sm:size-20",
                      !won && !isDraw ? "ring-emerald-400" : "ring-slate-200",
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
                      <div className="flex size-full items-center justify-center bg-slate-100 text-slate-500">
                        <UserRound className="size-8 sm:size-10" />
                      </div>
                    )}
                    {!won && !isDraw && (
                      <span className="absolute inset-x-0 bottom-0 bg-emerald-600 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                        {vi ? "THẮNG" : "WINNER"}
                      </span>
                    )}
                  </div>

                  <span className="mt-3 max-w-[120px] truncate text-sm font-semibold text-slate-900">
                    {opponentName}
                  </span>

                  {!isWordChain && (
                    <p
                      className={cn(
                        "mt-1 text-3xl font-black tabular-nums sm:text-4xl",
                        !won && !isDraw ? "text-emerald-600" : "text-slate-700",
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
              <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      ratingChange > 0
                        ? "bg-emerald-50 text-emerald-600"
                        : ratingChange < 0
                          ? "bg-red-50 text-red-600"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    <Award className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {vi ? "Điểm xếp hạng Elo" : "Rank Rating (Elo)"}
                    </p>
                    <p className="text-xs text-slate-500">
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
                    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-base font-black tabular-nums",
                    ratingChange > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : ratingChange < 0
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-700",
                  )}
                >
                  <span>
                    {ratingChange > 0 ? `+${ratingChange}` : ratingChange}
                  </span>
                  <span className="text-xs font-bold">Elo</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance Stats Chips */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {accuracy !== undefined && (
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Target className="size-4" />
                </div>
                <span className="mt-2 text-base font-bold tabular-nums text-slate-900">
                  {accuracy}%
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {vi ? "Chính xác" : "Accuracy"}
                </span>
              </div>
            )}

            {streak > 0 && (
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Flame className="size-4" />
                </div>
                <span className="mt-2 text-base font-bold tabular-nums text-slate-900">
                  {streak}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {vi ? "Chuỗi cao nhất" : "Max Streak"}
                </span>
              </div>
            )}

            {turnCount !== undefined && turnCount > 0 && (
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <Layers className="size-4" />
                </div>
                <span className="mt-2 text-base font-bold tabular-nums text-slate-900">
                  {turnCount}
                </span>
                <span className="text-xs font-medium text-slate-500">
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
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Clock className="size-4" />
                </div>
                <span className="mt-2 text-base font-bold tabular-nums text-slate-900">
                  {Math.floor(durationSeconds / 60)}
                  {vi ? " phút " : "m "}
                  {durationSeconds % 60}
                  {vi ? " giây" : "s"}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {vi ? "Thời gian" : "Duration"}
                </span>
              </div>
            )}
          </div>

          {/* Result Notice */}
          {resultNotice && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-center text-sm font-medium text-blue-700">
              {resultNotice}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {isFriendly && onBackToRoom && (
              <Button
                type="button"
                size="lg"
                onClick={onBackToRoom}
                className="flex-1"
              >
                <RotateCcw />
                <span>{vi ? "Trở về phòng" : "Back to room"}</span>
              </Button>
            )}

            {!isFriendly && onFindNextMatch && (
              <Button
                type="button"
                size="lg"
                onClick={onFindNextMatch}
                className="flex-1"
              >
                <Zap />
                <span>{vi ? "Tìm trận tiếp theo" : "Find Next Match"}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onBackToArena}
              className={isFriendly ? "flex-1" : "flex-1 sm:flex-initial"}
            >
              <ArrowLeft />
              <span>{vi ? "Về đấu trường" : "Back to Arena"}</span>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
