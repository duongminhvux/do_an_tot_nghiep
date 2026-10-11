"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  | "text"
  | "panel"
  | "search"
  | "setSearch"
  | "opponent"
  | "setOpponent"
  | "invited"
  | "setInvited"
  | "filteredFriends"
  | "startGame"
  | "button"
>;

export function FriendsPanel({
  text,
  panel,
  search,
  setSearch,
  opponent,
  setOpponent,
  invited,
  setInvited,
  filteredFriends,
  startGame,
  button,
}: Props) {
  return (
    <>
      {panel === "friends" && (
        <div className="mt-5">
          <label className="relative block">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <input
              aria-label={text("Tìm tên bạn bè", "Search friends")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text("Tìm tên bạn bè...", "Search friends...")}
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <div className="mt-3 space-y-2">
            {filteredFriends.map((friend) => (
              <div
                key={friend.name}
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
              >
                <Avatar initials={friend.initials} color={friend.color} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800">
                    {friend.name}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {friend.rating} Elo ·{" "}
                    <span className={friend.online ? "text-emerald-500" : ""}>
                      {friend.online ? "Online" : "Offline"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!friend.online || invited}
                  onClick={() => {
                    setOpponent(friend.name);
                    setInvited(true);
                  }}
                  className={cn(
                    button,
                    "min-h-8 bg-blue-50 px-2.5 text-[10px] text-blue-600",
                  )}
                >
                  {text("Thách đấu", "Challenge")}
                </button>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                {text("Không tìm thấy bạn bè.", "No friends found.")}
              </p>
            )}
          </div>
          {invited && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700" role="status">
                {text(
                  `Đã gửi lời mời đến ${opponent}.`,
                  `Invitation sent to ${opponent}.`,
                )}
              </p>
              <button
                type="button"
                onClick={startGame}
                className={cn(button, "mt-3 w-full bg-emerald-600 text-white")}
              >
                {text("Chơi thử trận đấu", "Play demo match")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
