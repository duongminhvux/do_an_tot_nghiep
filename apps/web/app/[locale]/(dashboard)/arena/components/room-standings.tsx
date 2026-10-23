"use client";
import type { FriendPlayer } from "@/lib/friendly-arena";
import { FriendlyAvatar } from "./friendly-avatar";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/page";

export function RoomStandings({
  players,
  currentUserId,
  currentTurnUserId,
  winnerId,
  vi = true,
}: {
  players: FriendPlayer[];
  currentUserId?: string;
  currentTurnUserId?: string;
  winnerId?: string | null;
  vi?: boolean;
}) {
  const ordered = [...players].sort(
    (a, b) =>
      Number(b.userId === winnerId) - Number(a.userId === winnerId) ||
      Number(!!a.eliminated) - Number(!!b.eliminated) ||
      (b.score ?? 0) - (a.score ?? 0),
  );
  return (
    <section
      aria-label={vi ? "Bảng điểm phòng" : "Room scoreboard"}
      className={cn(surface, "my-4 p-4 sm:p-5")}
    >
      <h2 className="mb-3 text-base font-semibold text-slate-900">
        {vi ? "Bảng điểm phòng" : "Room scoreboard"}
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {ordered.map((player) => (
          <li
            key={player.userId}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3",
              player.userId === currentTurnUserId
                ? "border-blue-300 bg-blue-50 ring-1 ring-blue-300"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="size-10 shrink-0 overflow-hidden rounded-full">
              <FriendlyAvatar
                avatar={player.avatarUrl}
                name={player.username}
              />
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-semibold text-slate-900">
                {player.username}
                {player.userId === currentUserId
                  ? vi
                    ? " (Bạn)"
                    : " (You)"
                  : ""}
              </strong>
              <span className="text-xs text-slate-500">
                {player.userId === winnerId
                  ? vi
                    ? "Chiến thắng"
                    : "Winner"
                  : player.eliminated
                    ? vi
                      ? "Đã bị loại"
                      : "Eliminated"
                    : player.userId === currentTurnUserId
                      ? vi
                        ? "Đang đến lượt"
                        : "Current turn"
                      : player.disconnectedAt
                        ? vi
                          ? "Mất kết nối"
                          : "Disconnected"
                        : ""}
              </span>
            </div>
            <span className="font-bold tabular-nums text-blue-600">
              {player.score ?? 0}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
