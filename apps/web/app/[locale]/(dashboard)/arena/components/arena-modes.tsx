"use client";

import {
  KeyRound,
  Loader2,
  Plus,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { arenaSocket } from "@/lib/arena-socket";
import { friendlyRequest, type FriendRoomSnapshot } from "@/lib/friendly-arena";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arenaService } from "@/services/arena.service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, surface } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type RoomEntry = "friends" | "room";

type Props = Pick<ArenaController, "text" | "openPanel">;

export function ArenaModes({ text, openPanel }: Props) {
  const router = useRouter();
  const params = useParams();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const { data: presence } = useQuery({
    queryKey: ["arena-presence"],
    queryFn: arenaService.getPresence,
    refetchInterval: 5000,
  });
  const onlineCount = presence?.data.onlineCount;
  const joinButtonRef = useRef<HTMLButtonElement | null>(null);
  const [joinFor, setJoinFor] = useState<RoomEntry | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<RoomEntry | null>(null);
  const [connected, setConnected] = useState(arenaSocket.connected);
  const [notices, setNotices] = useState<Partial<Record<RoomEntry, string>>>(
    {},
  );
  useEffect(() => {
    const authenticated = () => setConnected(true);
    const disconnected = () => setConnected(false);
    arenaSocket.on("arena:authenticated", authenticated);
    arenaSocket.on("disconnect", disconnected);
    const query = new URLSearchParams(window.location.search);
    const error = query.get("roomError");
    if (error) {
      const entry = query.get("roomType") === "ROOM" ? "room" : "friends";
      setNotices({ [entry]: error });
      setJoinFor(entry);
    }
    return () => {
      arenaSocket.off("arena:authenticated", authenticated);
      arenaSocket.off("disconnect", disconnected);
    };
  }, []);
  const roomType = (entry: RoomEntry) => (entry === "room" ? "ROOM" : "FRIEND");
  const enterRoom = (room: FriendRoomSnapshot) =>
    router.push(
      `/${locale}/arena/${room.maxPlayers > 2 ? "group" : "friend"}/room/${room.code}`,
    );
  const message = (entry: RoomEntry, code: string) => {
    const messages: Record<string, string> = {
      ROOM_TYPE_MISMATCH:
        entry === "friends"
          ? text(
              "Đây là mã phòng Room (3–8 người). Hãy nhập mã phòng 1vs1.",
              "This code belongs to a Room (3–8 players). Enter a 1v1 code.",
            )
          : text(
              "Đây là mã phòng 1vs1. Hãy nhập mã phòng Room (3–8 người).",
              "This is a 1v1 code. Enter a Room code (3–8 players).",
            ),
      ROOM_NOT_FOUND: text(
        "Mã phòng không tồn tại hoặc phòng đã đóng.",
        "The code does not exist or the room has closed.",
      ),
      ROOM_FULL: text("Phòng đã đủ người chơi.", "The room is full."),
      ROOM_IN_MATCH: text(
        "Phòng đang thi đấu. Vui lòng thử lại sau.",
        "The room is playing. Please try again later.",
      ),
      ALREADY_IN_ROOM: text(
        "Bạn đang ở phòng khác. Hãy rời phòng đó trước khi tham gia.",
        "You are in another room. Leave it before joining.",
      ),
      ALREADY_IN_MATCH: text(
        "Bạn đang có một trận đấu chưa kết thúc.",
        "You already have an active match.",
      ),
      "Socket disconnected": text(
        "Đang kết nối lại. Vui lòng chờ một chút.",
        "Reconnecting. Please wait a moment.",
      ),
    };
    return (
      messages[code] ??
      text(
        "Chưa thể vào phòng. Vui lòng thử lại.",
        "Unable to enter the room. Please try again.",
      )
    );
  };
  const run = async (
    entry: RoomEntry,
    action: () => Promise<FriendRoomSnapshot>,
  ) => {
    if (busy) return;
    setBusy(entry);
    setNotices((old) => ({ ...old, [entry]: "" }));
    try {
      const room = await action();
      setJoinFor(null);
      setJoinCode("");
      enterRoom(room);
    } catch (error) {
      setNotices((old) => ({
        ...old,
        [entry]: error instanceof Error ? error.message : "Request failed",
      }));
    } finally {
      setBusy(null);
    }
  };
  const createRoom = (entry: RoomEntry) =>
    run(entry, async () => {
      const current = await friendlyRequest<FriendRoomSnapshot | null>(
        "friend-room:current",
        {},
      );
      if (current) {
        if ((current.maxPlayers > 2 ? "ROOM" : "FRIEND") !== roomType(entry))
          throw new Error("ALREADY_IN_ROOM");
        return current;
      }
      return friendlyRequest<FriendRoomSnapshot>(
        "friend-room:create",
        entry === "room" ? { maxPlayers: 8 } : {},
      );
    });

  return (
    <section
      aria-label={text("Chọn chế độ chơi", "Choose a game mode")}
      className="grid min-w-0 gap-3 @min-[560px]/arena:grid-cols-2 @min-[900px]/arena:grid-cols-3 sm:gap-4"
    >
      {[
        {
          key: "rank" as const,
          icon: Swords,
          title: text("Chơi xếp hạng", "Ranked play"),
          description: text(
            "Đấu 1 vs 1 với đối thủ cùng trình độ, tích điểm và leo hạng.",
            "Play 1 vs 1 against a similar-rated opponent and climb the ranks.",
          ),
          action: text("Tìm trận ngay", "Find a match"),
          footer:
            onlineCount === undefined
              ? text(
                  "Đang cập nhật số người online…",
                  "Checking online players…",
                )
              : text(
                  `${onlineCount} người đang online`,
                  `${onlineCount} players online`,
                ),
          accent: "bg-blue-600",
          iconTone: "bg-blue-50 text-blue-600",
        },
        {
          key: "friends" as const,
          icon: Users,
          title: text("Đấu bạn bè 1vs1", "Friendly 1v1"),
          description: text(
            "Tạo phòng 1vs1 hoặc nhập mã để đấu cùng một người bạn.",
            "Create a 1v1 room or enter a code to play with a friend.",
          ),
          action: text("Tìm bạn để thách đấu", "Challenge a friend"),
          footer: text(
            "Chơi cùng bạn bè vui hơn!",
            "Better together with friends!",
          ),
          accent: "bg-amber-400",
          iconTone: "bg-amber-50 text-amber-600",
        },
        {
          key: "room" as const,
          icon: Trophy,
          title: text("Phòng đấu", "Battle room"),
          description: text(
            "Tạo phòng và mời bạn bè tham gia cùng chơi.",
            "Create a room and invite your friends to join.",
          ),
          action: text("Tạo phòng đấu", "Create a room"),
          footer: text("Hỗ trợ 3 - 8 người chơi", "For 3 – 8 players"),
          accent: "bg-violet-500",
          iconTone: "bg-violet-50 text-violet-600",
        },
      ].map((mode) => (
        <article
          key={mode.key}
          className={cn(
            surface,
            "relative flex min-w-0 flex-col overflow-hidden p-5 @min-[560px]/arena:last:col-span-2 @min-[900px]/arena:last:col-span-1",
          )}
        >
          <span
            aria-hidden
            className={cn("absolute inset-x-0 top-0 h-1", mode.accent)}
          />
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                mode.iconTone,
              )}
            >
              <mode.icon className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                {mode.title}
                {mode.key === "rank" && <Badge tone="emerald">Online</Badge>}
              </h2>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                {mode.description}
              </p>
            </div>
          </div>
          {mode.key === "rank" ? (
            <Button
              type="button"
              onClick={() => openPanel("rank")}
              className="mt-4 w-full"
            >
              <Zap className="fill-current" />
              {mode.action}
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  disabled={!!busy || !connected}
                  onClick={() => void createRoom(mode.key as RoomEntry)}
                  className="w-full"
                >
                  {busy === mode.key ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  {text("Tạo phòng", "Create room")}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!!busy}
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    joinButtonRef.current = event.currentTarget;
                    setJoinFor(mode.key as RoomEntry);
                    setJoinCode("");
                    setNotices((old) => ({ ...old, [mode.key]: "" }));
                  }}
                  className="w-full"
                >
                  <KeyRound />
                  {text("Nhập mã", "Enter code")}
                </Button>
              </div>
              {joinFor !== mode.key && notices[mode.key] && (
                <p
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-800"
                >
                  {message(mode.key, notices[mode.key]!)}
                </p>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2.5 border-t border-slate-100 pt-3">
            <div className="flex -space-x-2">
              <Avatar
                initials="HM"
                color="blue"
                className="size-5 text-[7px]"
              />
              <Avatar
                initials="PT"
                color="rose"
                className="size-5 text-[7px]"
              />
              <Avatar
                initials="TT"
                color="amber"
                className="size-5 text-[7px]"
              />
            </div>
            <span className="text-xs text-slate-500">{mode.footer}</span>
          </div>
        </article>
      ))}
      <Dialog
        open={joinFor !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setJoinFor(null);
            setJoinCode("");
          }
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          closeLabel={text("Đóng", "Close")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            joinButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <span
              className={cn(
                "mb-2 flex size-12 items-center justify-center rounded-xl",
                joinFor === "room"
                  ? "bg-violet-50 text-violet-600"
                  : "bg-amber-50 text-amber-600",
              )}
            >
              <KeyRound className="size-6" />
            </span>
            <DialogTitle>
              {joinFor === "room"
                ? text("Tham gia phòng Room", "Join a Room")
                : text("Tham gia phòng 1vs1", "Join a 1v1 room")}
            </DialogTitle>
            <DialogDescription>
              {joinFor === "room"
                ? text(
                    "Nhập mã 6 ký tự của phòng Room (3–8 người) để tham gia cùng bạn bè.",
                    "Enter a 6-character Room code (3–8 players) to join your friends.",
                  )
                : text(
                    "Nhập mã 6 ký tự của phòng 1vs1 để thi đấu cùng một người bạn.",
                    "Enter a 6-character 1v1 code to play with a friend.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (joinFor && joinCode.length === 6)
                void run(joinFor, () =>
                  friendlyRequest<FriendRoomSnapshot>("friend-room:join", {
                    code: joinCode.trim().toUpperCase(),
                    roomType: roomType(joinFor),
                  }),
                );
            }}
          >
            <div className="space-y-2">
              <label
                htmlFor="arena-join-code"
                className="text-sm font-semibold text-slate-700"
              >
                {text("Mã phòng", "Room code")}
              </label>
              <input
                id="arena-join-code"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                required
                minLength={6}
                maxLength={6}
                value={joinCode}
                disabled={!!busy}
                aria-invalid={!!(joinFor && notices[joinFor])}
                aria-describedby={
                  joinFor && notices[joinFor] ? "arena-join-error" : undefined
                }
                onChange={(event) => {
                  setJoinCode(
                    event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                  );
                  if (joinFor) setNotices((old) => ({ ...old, [joinFor]: "" }));
                }}
                placeholder="AB23CD"
                className="h-14 w-full rounded-lg border border-slate-200 bg-white px-4 text-center font-mono text-xl font-bold uppercase tracking-[0.3em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
            </div>
            {joinFor && notices[joinFor] && (
              <p
                id="arena-join-error"
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800"
              >
                {message(joinFor, notices[joinFor]!)}
              </p>
            )}
            {!connected && (
              <p role="status" className="text-sm text-slate-500">
                {text("Đang kết nối lại…", "Reconnecting…")}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={() => {
                  setJoinFor(null);
                  setJoinCode("");
                }}
              >
                {text("Hủy", "Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!!busy || !connected || joinCode.length !== 6}
              >
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {text("Vào phòng", "Join room")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
