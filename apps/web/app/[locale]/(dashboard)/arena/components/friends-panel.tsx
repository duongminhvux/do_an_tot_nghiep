"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <div className="mt-3 space-y-2">
            {filteredFriends.map((friend) => (
              <div
                key={friend.name}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <Avatar initials={friend.initials} color={friend.color} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {friend.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {friend.rating} Elo ·{" "}
                    <span className={friend.online ? "text-emerald-600" : ""}>
                      {friend.online ? "Online" : "Offline"}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!friend.online || invited}
                  onClick={() => {
                    setOpponent(friend.name);
                    setInvited(true);
                  }}
                >
                  {text("Thách đấu", "Challenge")}
                </Button>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                {text("Không tìm thấy bạn bè.", "No friends found.")}
              </p>
            )}
          </div>
          {invited && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700" role="status">
                {text(
                  `Đã gửi lời mời đến ${opponent}.`,
                  `Invitation sent to ${opponent}.`,
                )}
              </p>
              <Button type="button" onClick={startGame} className="mt-3 w-full">
                {text("Chơi thử trận đấu", "Play demo match")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
