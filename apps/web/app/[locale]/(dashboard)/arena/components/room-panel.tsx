"use client";

import { Check, Copy, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  | "text"
  | "panel"
  | "setOpponent"
  | "roomName"
  | "setRoomName"
  | "capacity"
  | "setCapacity"
  | "roomCode"
  | "setRoomCode"
  | "copied"
  | "startGame"
  | "copyCode"
>;

export function RoomPanel({
  text,
  panel,
  setOpponent,
  roomName,
  setRoomName,
  capacity,
  setCapacity,
  roomCode,
  setRoomCode,
  copied,
  startGame,
  copyCode,
}: Props) {
  return (
    <>
      {panel === "room" && (
        <div className="mt-5">
          {!roomCode ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!roomName.trim()) return;
                setRoomCode(
                  `VOC-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                );
              }}
              className="space-y-4"
            >
              <label className="block text-xs font-semibold text-slate-700">
                {text("Tên phòng", "Room name")}
                <input
                  required
                  maxLength={50}
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder={text(
                    "Ví dụ: Hội yêu từ vựng",
                    "e.g. Vocabulary club",
                  )}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                {text("Số người chơi tối đa", "Maximum players")}
                <select
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {[3, 4, 5, 6, 7, 8].map((value) => (
                    <option key={value} value={value}>
                      {value} {text("người chơi", "players")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg bg-violet-50 p-3 text-xs leading-5 text-violet-600">
                {text(
                  "Chủ đề: Từ vựng tổng hợp · 5 câu hỏi trong trận thử.",
                  "Topic: General vocabulary · 5 questions in the demo.",
                )}
              </div>
              <Button type="submit" className="w-full">
                <Plus />
                {text("Tạo phòng", "Create room")}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-violet-50">
                <Trophy className="size-7 text-violet-600" />
              </span>
              <h3 className="mt-3 font-bold text-slate-900">{roomName}</h3>
              <p className="mt-1 text-xs text-slate-500">
                1 / {capacity} {text("người chơi", "players")}
              </p>
              <div className="mt-5 rounded-xl border border-dashed border-violet-200 bg-violet-50 p-4">
                <p className="text-xs text-violet-600">
                  {text(
                    "Chia sẻ mã phòng với bạn bè",
                    "Share this room code with friends",
                  )}
                </p>
                <p className="mt-2 select-all text-2xl font-bold tracking-widest text-violet-700">
                  {roomCode}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyCode}
                  className="mt-2"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied
                    ? text("Đã sao chép", "Copied")
                    : text("Sao chép mã", "Copy code")}
                </Button>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setOpponent("Trần Phương Thảo");
                  startGame();
                }}
                className="mt-5 w-full"
              >
                {text("Bắt đầu trận thử", "Start demo match")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
