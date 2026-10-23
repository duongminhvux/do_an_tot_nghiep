"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Flame,
  Gamepad2,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Swords,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FriendlyAvatar } from "./friendly-avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { surface } from "@/components/ui/page";
import { arenaSocket } from "@/lib/arena-socket";
import apiClient from "@/lib/axios";
import {
  friendlyRequest,
  type FriendMode,
  type FriendPlayer,
  type FriendPresenceUpdate,
  type FriendRoomSnapshot,
  type FriendRoomSettings,
  type FriendInvite,
} from "@/lib/friendly-arena";

export function FriendlyLobby({
  multiplayer = false,
}: {
  multiplayer?: boolean;
}) {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const code = typeof params.code === "string" ? params.code.toUpperCase() : "";
  const vi = locale === "vi";
  const text = (vn: string, en: string) => (vi ? vn : en);
  const userId = useAppSelector((state) => state.auth.user?._id) || "";

  const [room, setRoom] = useState<FriendRoomSnapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(arenaSocket.connected);
  const [players, setPlayers] = useState<FriendPlayer[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{
    inviteId: string;
    expiresAt: string;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<FriendMode>("CLASSIC");
  const [questionCount, setQuestionCount] = useState(10);
  const [seconds, setSeconds] = useState(15);
  const [capacity, setCapacity] = useState(8);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const host = room?.hostId === userId;
  const waiting = room?.status === "WAITING";
  const settingsChanged =
    host &&
    !!room &&
    (capacity !== room.maxPlayers ||
      mode !== room.mode ||
      (mode === "CLASSIC"
        ? questionCount !== room.settings.questionCount ||
          seconds !== room.settings.timePerQuestion
        : mode === "WORD_CHAIN" && seconds !== room.settings.turnTime));
  const base = `/${locale}/arena/${multiplayer ? "group" : "friend"}`;
  const full = !!room && room.players.length >= room.maxPlayers;
  const myPlayer = room?.players.find((p) => p.userId === userId);
  const myReady = !!myPlayer?.isReady;

  const requiredMinPlayers = room ? (room.maxPlayers > 2 ? 3 : 2) : 2;
  const readyPlayersCount = room
    ? room.players.filter((p) => p.userId === room.hostId || p.isReady).length
    : 0;
  const guestsReady = room
    ? room.players
        .filter((p) => p.userId !== room.hostId)
        .every((p) => p.isReady)
    : false;
  const canStart =
    !!room && room.players.length >= requiredMinPlayers && guestsReady;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setConnected(true);
      try {
        if (code) {
          const data = await friendlyRequest<FriendRoomSnapshot>(
            "friend-room:join",
            { code, roomType: multiplayer ? "ROOM" : "FRIEND" },
          );
          if (active) {
            setRoom(data);
            setNotice("");
          }
          const invitations = await friendlyRequest<FriendInvite[]>(
            "friend:invite-pending",
            {},
          );
          if (active)
            setPending(
              invitations.find(
                (invite) =>
                  invite.senderId === userId && invite.roomId === data.roomId,
              ) ?? null,
            );
        } else {
          if (active) router.replace(`/${locale}/arena`);
        }
      } catch (e) {
        if (active) {
          setNotice(e instanceof Error ? e.message : "ROOM_NOT_FOUND");
          if (code)
            router.replace(
              `/${locale}/arena?roomType=${multiplayer ? "ROOM" : "FRIEND"}&roomError=${encodeURIComponent(e instanceof Error ? e.message : "ROOM_NOT_FOUND")}`,
            );
        }
      }
    };

    const update = (data: FriendRoomSnapshot) => {
      if (data.code !== code) return;
      if (data.players.some((p) => p.userId === userId)) setRoom(data);
      else {
        setRoom(null);
        router.replace(`/${locale}/arena`);
      }
    };

    const started = (data: { code: string; matchId: string }) => {
      if (data.code === code)
        router.push(`/${locale}/arena/friend/${data.matchId}`);
    };

    const offline = () => setConnected(false);
    const inviteClosed = (data: { inviteId: string }) =>
      setPending((p) => (p?.inviteId === data.inviteId ? null : p));
    const declined = (data: { inviteId: string }) => {
      inviteClosed(data);
      setNotice(vi ? "Người chơi đã từ chối lời mời." : "Invitation declined.");
    };
    const expired = (data: { inviteId: string }) => {
      inviteClosed(data);
      setNotice(vi ? "Lời mời đã hết hạn." : "Invitation expired.");
    };

    arenaSocket.on("arena:authenticated", load);
    arenaSocket.on("disconnect", offline);
    arenaSocket.on("friend-room:update", update);
    arenaSocket.on("friend-room:started", started);
    arenaSocket.on("friend:invite-declined", declined);
    arenaSocket.on("friend:invite-expired", expired);
    arenaSocket.on("friend:invite-cancelled", inviteClosed);
    arenaSocket.on("friend:invite-accepted", inviteClosed);

    if (arenaSocket.connected && userId) void load();
    const timer = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      active = false;
      window.clearInterval(timer);
      arenaSocket.off("arena:authenticated", load);
      arenaSocket.off("disconnect", offline);
      arenaSocket.off("friend-room:update", update);
      arenaSocket.off("friend-room:started", started);
      arenaSocket.off("friend:invite-declined", declined);
      arenaSocket.off("friend:invite-expired", expired);
      arenaSocket.off("friend:invite-cancelled", inviteClosed);
      arenaSocket.off("friend:invite-accepted", inviteClosed);
    };
  }, [code, userId, base, router, vi, multiplayer]);

  useEffect(() => {
    if (!room) return;
    setCapacity(room.maxPlayers);
    setMode(room.mode);
    setQuestionCount(room.settings.questionCount ?? 10);
    setSeconds(room.settings.timePerQuestion ?? room.settings.turnTime ?? 20);
    if (room.status === "IN_MATCH" && room.currentMatchId)
      router.replace(`/${locale}/arena/friend/${room.currentMatchId}`);
  }, [room, base, router, locale]);

  const openInvite = () => {
    setSearch("");
    setNotice("");
    setInviteOpen(true);
  };

  useEffect(() => {
    if (!host || !waiting || full) setInviteOpen(false);
  }, [host, waiting, full]);

  const memberIds =
    room?.players
      .map((player) => player.userId)
      .sort()
      .join(",") || "";

  useEffect(() => {
    if (!room?.roomId || !host || !waiting || full || !inviteOpen) return;
    let active = true;
    let requestVersion = 0;
    let timer: number | undefined;
    const members = new Set(memberIds.split(","));

    const loadPlayers = async () => {
      const version = ++requestVersion;
      try {
        const result = await apiClient.get<{ data: FriendPlayer[] }>(
          "/arena/friend/players",
          { params: { search } },
        );
        if (active && version === requestVersion) {
          setPlayers(
            result.data.data.filter((player) => !members.has(player.userId)),
          );
        }
      } catch {
        if (active && version === requestVersion) setPlayers([]);
      } finally {
        if (active && version === requestVersion) setPlayersLoading(false);
      }
    };

    const refresh = () => {
      setPlayersLoading(true);
      // An older HTTP snapshot must not overwrite a newer presence event.
      requestVersion++;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadPlayers(), 250);
    };
    const presenceChanged = ({ userId, online }: FriendPresenceUpdate) => {
      setPlayers((current) =>
        current.map((player) =>
          player.userId === userId ? { ...player, online } : player,
        ),
      );
      refresh();
    };

    arenaSocket.on("arena:presence-changed", presenceChanged);
    arenaSocket.on("arena:authenticated", refresh);
    refresh();
    return () => {
      active = false;
      requestVersion++;
      window.clearTimeout(timer);
      arenaSocket.off("arena:presence-changed", presenceChanged);
      arenaSocket.off("arena:authenticated", refresh);
    };
  }, [room?.roomId, memberIds, full, host, waiting, search, inviteOpen]);

  useEffect(() => {
    if (!room?.roomId) return;
    const roomId = room.roomId;
    const initial = window.location.pathname;
    return () =>
      queueMicrotask(() => {
        const destination = window.location.pathname;
        if (
          destination !== initial &&
          !destination.startsWith(`${base}/`) &&
          !destination.startsWith(`/${locale}/arena/friend/`) &&
          !destination.startsWith(`/${locale}/arena/group/`)
        )
          arenaSocket.emit("friend-room:leave", { roomId });
      });
  }, [room?.roomId, base, locale]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(
        e instanceof Error && e.message === "ROOM_CAPACITY_TOO_SMALL"
          ? text(
              "Số chỗ không được nhỏ hơn số người đang trong phòng.",
              "Capacity cannot be lower than the current player count.",
            )
          : e instanceof Error && e.message === "INVALID_ROOM_CAPACITY"
            ? text(
                "Số người tối đa phải từ 3 đến 8.",
                "Maximum players must be between 3 and 8.",
              )
            : e instanceof Error
              ? e.message
              : "Request failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    run(async () => {
      const settings: FriendRoomSettings =
        mode === "CLASSIC"
          ? { questionCount, timePerQuestion: seconds }
          : mode === "WORD_CHAIN"
            ? { turnTime: seconds }
            : {};
      setRoom(
        await friendlyRequest<FriendRoomSnapshot>(
          "friend-room:settings-update",
          {
            roomId: room!.roomId,
            mode,
            settings,
            ...(room!.maxPlayers > 2 ? { maxPlayers: capacity } : {}),
          },
        ),
      );
    });

  const leave = () =>
    run(async () => {
      if (room)
        await friendlyRequest("friend-room:leave", { roomId: room.roomId });
      setRoom(null);
      router.push(`/${locale}/arena`);
    });

  const handleCopyCode = async () => {
    if (!room?.code) return;
    await navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const modeBadge = (m: FriendMode) => {
    switch (m) {
      case "WORD_GUESS":
        return {
          title: text("Đoán từ bí mật", "Word Guess"),
          sub: text("5 ký tự / 5 lượt", "5 letters / 5 tries"),
          icon: Sparkles,
          color:
            "from-amber-500 to-orange-500 text-amber-500 border-amber-500/20 bg-amber-50/70",
        };
      case "WORD_CHAIN":
        return {
          title: text("Nối từ thần tốc", "Word Chain"),
          sub: text("Từ tiếp nối ký tự cuối", "Chain by last letter"),
          icon: Flame,
          color:
            "from-rose-500 to-pink-500 text-rose-500 border-rose-500/20 bg-rose-50/70",
        };
      default:
        return {
          title: text("Classic Đối kháng", "Classic Duel"),
          sub: text("Nghĩa tiếng Việt sang Từ vựng", "Meaning to English word"),
          icon: Swords,
          color:
            "from-blue-600 to-indigo-600 text-blue-600 border-blue-500/20 bg-blue-50/70",
        };
    }
  };

  const currentModeInfo = modeBadge(room?.mode ?? mode);

  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] bg-background px-3 py-4 text-slate-900 sm:px-6 sm:py-6">

      <div className="mx-auto max-w-7xl">
        {/* Top Navigation Bar */}
        <header
          className={cn(
            surface,
            "mb-6 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void leave()}
              disabled={busy}
              aria-label={text("Quay lại đấu trường", "Back to Arena")}
              className="shrink-0"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  {multiplayer
                    ? text("Phòng Đấu Nhóm", "Battle Party Room")
                    : text("Đấu Trường Solo 1v1", "Friendly 1v1 Arena")}
                </h1>
                <span className="hidden rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100 sm:inline-flex">
                  {multiplayer ? text("Nhiều người", "Multiplayer") : "1 vs 1"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {room
                  ? text(
                      "Phòng chờ sẵn sàng · Chuẩn bị xuất kích",
                      "Lobby · Get ready to duel",
                    )
                  : text("Đang kết nối phòng đấu…", "Connecting to room…")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 md:flex">
              <span
                className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`}
              />
              {connected
                ? text("Máy chủ trực tuyến", "Server online")
                : text("Đang kết nối lại…", "Reconnecting…")}
            </div>

            <Button
              variant="outline"
              onClick={() => void leave()}
              disabled={busy}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut />
              <span>{text("Rời phòng", "Leave room")}</span>
            </Button>
          </div>
        </header>

        {/* Status Alerts */}
        {!connected && (
          <div
            role="status"
            className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800"
          >
            <Loader2 className="size-5 animate-spin text-amber-600" />
            <p className="text-sm font-medium">
              {text(
                "Đang kết nối lại tới máy chủ Đấu trường… Vui lòng đợi trong giây lát.",
                "Reconnecting to Arena server… Please wait a moment.",
              )}
            </p>
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900"
          >
            <p className="text-sm font-medium">{notice}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotice("")}
              className="shrink-0 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
            >
              {text("Đóng", "Dismiss")}
            </Button>
          </div>
        )}

        {!room ? (
          <div
            className={cn(
              surface,
              "flex min-h-[360px] flex-col items-center justify-center gap-4 p-12 text-center",
            )}
          >
            <div className="relative">
              <div className="size-16 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
              <Swords className="absolute inset-0 m-auto size-7 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {text(
                "Đang chuẩn bị đấu trường phòng…",
                "Preparing arena lobby…",
              )}
            </p>
          </div>
        ) : (
          <>
            {/* HERO BAR: Room Code & Quick Info Hub */}
            <section
              className={cn(
                surface,
                "relative mb-6 overflow-hidden p-4 sm:p-6",
              )}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                {/* Room Code Badge */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                      <Gamepad2 className="size-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                        {text("MÃ PHÒNG ĐẤU", "ROOM CODE")}
                      </span>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-3xl font-black tracking-[0.22em] text-slate-900">
                          {room.code}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void handleCopyCode()}
                    >
                      {copiedCode ? (
                        <>
                          <Check className="size-4 text-emerald-600" />
                          <span className="text-emerald-700">
                            {text("Đã chép mã!", "Copied!")}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-4 text-blue-600" />
                          <span>{text("Chép mã", "Copy code")}</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => void handleCopyLink()}
                    >
                      {copiedLink ? (
                        <>
                          <Check className="size-4 text-emerald-600" />
                          <span className="text-emerald-700">
                            {text("Đã chép link!", "Link copied!")}
                          </span>
                        </>
                      ) : (
                        <>
                          <Share2 className="size-4 text-slate-500" />
                          <span className="hidden sm:inline">
                            {text("Chia sẻ link", "Share link")}
                          </span>
                          <span className="sm:hidden">
                            {text("Link", "Link")}
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Game Specs Pills */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <currentModeInfo.icon className="size-5 text-blue-600" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {text("Chế độ", "Game mode")}
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {currentModeInfo.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <Clock className="size-5 text-amber-600" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {room.mode === "WORD_CHAIN"
                          ? text("Lượt chơi", "Turn time")
                          : text("Thời gian", "Time")}
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {room.settings.timePerQuestion ??
                          room.settings.turnTime ??
                          15}
                        s
                      </p>
                    </div>
                  </div>

                  {room.mode === "CLASSIC" && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                      <Zap className="size-5 text-emerald-600" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {text("Số câu", "Questions")}
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {room.settings.questionCount ?? 10}{" "}
                          {text("câu", "qs")}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <Users className="size-5 text-violet-600" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {text("Thành viên", "Players")}
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        <span className="text-blue-600">
                          {room.players.length}
                        </span>
                        <span className="text-slate-400">
                          {" "}
                          / {room.maxPlayers}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* MAIN CONTENT GRID: ARENA STAGE (LEFT) + SETTINGS / INVITES (RIGHT) */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(320px,1.15fr)]">
              {/* ARENA STAGE */}
              <div className="space-y-6">
                {/* 1V1 VERSUS FACE-OFF STAGE */}
                {!multiplayer ? (
                  <section
                    className={cn(
                      surface,
                      "relative overflow-hidden p-5 sm:p-6",
                    )}
                  >
                    {/* Stage Header */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Swords className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            {text("SÀN ĐẤU ĐỐI ĐẦU 1V1", "1V1 FACE-OFF ARENA")}
                          </h2>
                          <p className="text-xs text-slate-500">
                            {readyPlayersCount === 2
                              ? text(
                                  "🔥 Hai bên đã sẵn sàng, trận đấu có thể bắt đầu!",
                                  "🔥 Both duelists ready, match can start!",
                                )
                              : text(
                                  "Chờ đối thủ gia nhập và sẵn sàng xuất chiến",
                                  "Waiting for challenger to join and ready up",
                                )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {readyPlayersCount}/2 {text("sẵn sàng", "ready")}
                        </span>
                      </div>
                    </div>

                    {/* The 1v1 Battle Rink */}
                    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                      {/* Host Duelist Card */}
                      {(() => {
                        const hostPlayer = room.players.find(
                          (p) => p.userId === room.hostId,
                        );
                        const isMe = hostPlayer?.userId === userId;

                        return hostPlayer ? (
                          <div className="relative flex flex-col items-center rounded-xl border border-blue-200 bg-blue-50/40 p-6 text-center transition-colors">
                            {/* Crown badge */}
                            <div className="absolute -top-3 flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-[11px] font-bold tracking-wider text-amber-700">
                              <Crown className="size-3.5" />
                              <span>{text("CHỦ PHÒNG", "HOST")}</span>
                            </div>

                            {/* Avatar Frame with Aura */}
                            <div className="relative my-3">
                              <div className="relative size-24 overflow-hidden rounded-full border-4 border-blue-500 bg-white p-0.5 sm:size-28">
                                <FriendlyAvatar
                                  avatar={hostPlayer.avatarUrl}
                                  name={hostPlayer.username}
                                />
                              </div>
                              <span className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                                <Check className="size-3 stroke-[3] text-white" />
                              </span>
                            </div>

                            <strong className="mt-2 block max-w-full truncate text-lg font-bold text-slate-900">
                              {hostPlayer.username}
                            </strong>

                            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                              {isMe && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                                  {text("Bạn", "You")}
                                </span>
                              )}
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                                <CheckCircle2 className="size-3" />
                                {text("Sẵn sàng chiến", "Ready")}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* VS Centerpiece */}
                      <div className="my-2 flex flex-col items-center justify-center">
                        <div className="relative flex size-16 items-center justify-center rounded-full bg-blue-600 font-black italic tracking-wider text-white shadow-sm ring-4 ring-blue-100 sm:size-20">
                          <span className="text-xl font-black sm:text-2xl">
                            VS
                          </span>
                        </div>
                        <span className="mt-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-inset ring-slate-200">
                          {text("Thách đấu", "Duel")}
                        </span>
                      </div>

                      {/* Opponent Duelist Card */}
                      {(() => {
                        const guestPlayer = room.players.find(
                          (p) => p.userId !== room.hostId,
                        );
                        const isMe = guestPlayer?.userId === userId;

                        return guestPlayer ? (
                          <div
                            className={`relative flex flex-col items-center rounded-xl border p-6 text-center transition-colors ${
                              guestPlayer.isReady
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-amber-200 bg-amber-50/40"
                            }`}
                          >
                            <div className="absolute -top-3 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-0.5 text-[11px] font-bold tracking-wider text-slate-700">
                              <Swords className="size-3.5" />
                              <span>{text("ĐỐI THỦ", "CHALLENGER")}</span>
                            </div>

                            {/* Avatar Frame with Aura */}
                            <div className="relative my-3">
                              <div
                                className={`relative size-24 overflow-hidden rounded-full border-4 bg-white p-0.5 sm:size-28 ${
                                  guestPlayer.isReady
                                    ? "border-emerald-500"
                                    : "border-amber-500"
                                }`}
                              >
                                <FriendlyAvatar
                                  avatar={guestPlayer.avatarUrl}
                                  name={guestPlayer.username}
                                />
                              </div>
                              <span
                                className={`absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full border-2 border-white ${
                                  guestPlayer.isReady
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                }`}
                              >
                                {guestPlayer.isReady ? (
                                  <Check className="size-3 stroke-[3] text-white" />
                                ) : (
                                  <Clock className="size-3 stroke-[3] text-white" />
                                )}
                              </span>
                            </div>

                            <strong className="mt-2 block max-w-full truncate text-lg font-bold text-slate-900">
                              {guestPlayer.username}
                            </strong>

                            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                              {isMe && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                                  {text("Bạn", "You")}
                                </span>
                              )}
                              <span
                                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                  guestPlayer.isReady
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                    : "bg-amber-50 text-amber-700 ring-amber-100"
                                }`}
                              >
                                {guestPlayer.isReady ? (
                                  <>
                                    <CheckCircle2 className="size-3" />
                                    {text("Đã sẵn sàng!", "Ready!")}
                                  </>
                                ) : (
                                  <>
                                    <Clock className="size-3" />
                                    {text("Đang chuẩn bị…", "Preparing…")}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Click the open seat to invite a challenger. */
                          <button
                            type="button"
                            onClick={openInvite}
                            disabled={!host || !waiting}
                            aria-haspopup="dialog"
                            className="relative flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors enabled:hover:border-blue-400 enabled:hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                          >
                            <span className="relative mb-3 flex size-20 items-center justify-center rounded-full border-2 border-blue-100 bg-blue-50">
                              <span className="absolute inset-0 animate-ping rounded-full border border-blue-300 opacity-50" />
                              <UserPlus className="size-8 text-blue-600" />
                            </span>
                            <strong className="text-base font-semibold text-slate-800">
                              {text(
                                "Chờ đối thủ gia nhập…",
                                "Waiting for challenger…",
                              )}
                            </strong>
                            <span className="mt-1.5 max-w-[220px] text-sm font-medium text-blue-600">
                              {host
                                ? text(
                                    "Bấm để mời người chơi",
                                    "Click to invite a player",
                                  )
                                : text(
                                    "Chờ chủ phòng mời người chơi",
                                    "Waiting for the host to invite a player",
                                  )}
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </section>
                ) : (
                  /* MULTIPLAYER / PARTY ROOM STAGE */
                  <section
                    className={cn(
                      surface,
                      "relative overflow-hidden p-5 sm:p-6",
                    )}
                  >
                    {/* Header */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                          <Users className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            {text(
                              "DANH SÁCH THÀNH VIÊN",
                              "ROOM DUELISTS ROSTER",
                            )}
                          </h2>
                          <p className="text-xs text-slate-500">
                            {text(
                              "Cần tối thiểu 3 người và tất cả sẵn sàng để khởi tranh",
                              "Need at least 3 players & all ready to start",
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {readyPlayersCount}/{room.players.length}{" "}
                          {text("đã sẵn sàng", "ready")}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Ready Players */}
                    <div className="mb-6 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                        style={{
                          width: `${(readyPlayersCount / Math.max(1, room.players.length)) * 100}%`,
                        }}
                      />
                    </div>

                    {/* Roster Grid */}
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: room.maxPlayers }, (_, index) => {
                        const player = room.players[index];
                        const isOwner = player?.userId === room.hostId;
                        const isMe = player?.userId === userId;

                        return player ? (
                          <div
                            key={player.userId}
                            className={`relative flex items-center gap-3.5 rounded-lg border p-3.5 transition-colors ${
                              isOwner
                                ? "border-amber-200 bg-amber-50/50"
                                : player.isReady
                                  ? "border-emerald-200 bg-emerald-50/50"
                                  : "border-slate-200 bg-white"
                            } ${isMe ? "ring-2 ring-blue-500/30" : ""}`}
                          >
                            {/* Slot Number Tag */}
                            <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-slate-400">
                              #{String(index + 1).padStart(2, "0")}
                            </span>

                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div
                                className={`size-13 overflow-hidden rounded-full border-2 bg-white p-0.5 ${
                                  isOwner
                                    ? "border-amber-400"
                                    : player.isReady
                                      ? "border-emerald-500"
                                      : "border-slate-300"
                                }`}
                              >
                                <FriendlyAvatar
                                  avatar={player.avatarUrl}
                                  name={player.username}
                                />
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white ${
                                  isOwner || player.isReady
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              >
                                {isOwner || player.isReady ? (
                                  <Check className="size-2.5 stroke-[3] text-white" />
                                ) : null}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 pr-6">
                              <strong className="block truncate text-sm font-semibold text-slate-900">
                                {player.username}
                              </strong>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {isMe && (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                                    {text("Bạn", "You")}
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                    isOwner
                                      ? "bg-amber-50 text-amber-700 ring-amber-100"
                                      : player.isReady
                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                        : "bg-slate-100 text-slate-600 ring-slate-200"
                                  }`}
                                >
                                  {isOwner ? (
                                    <>
                                      <Crown className="size-3 text-amber-600" />
                                      {text("Chủ phòng", "Host")}
                                    </>
                                  ) : player.isReady ? (
                                    <>
                                      <CheckCircle2 className="size-3" />
                                      {text("Sẵn sàng", "Ready")}
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="size-3" />
                                      {text("Chưa sẵn sàng", "Not ready")}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Open seats launch the invite dialog for the host. */
                          <button
                            key={`empty-${index}`}
                            type="button"
                            onClick={openInvite}
                            disabled={!host || !waiting}
                            aria-haspopup="dialog"
                            aria-label={text(
                              `Mời vào vị trí ${index + 1}`,
                              `Invite to seat ${index + 1}`,
                            )}
                            className="flex min-h-[76px] w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3.5 text-left text-slate-400 transition-colors enabled:hover:border-blue-300 enabled:hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                          >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                              <UserPlus className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-600">
                                {text("Vị trí trống", "Open Slot")} #
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {host
                                  ? text(
                                      "Bấm để mời người chơi",
                                      "Click to invite a player",
                                    )
                                  : text(
                                      "Chờ người chơi vào…",
                                      "Waiting for player…",
                                    )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* BOTTOM CTA LAUNCH PAD */}
                <div
                  className={cn(
                    surface,
                    "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-blue-600" />
                      <h3 className="text-base font-semibold text-slate-900">
                        {canStart && !settingsChanged
                          ? text(
                              "Đấu trường đã sẵn sàng khai hỏa!",
                              "Arena ready for battle!",
                            )
                          : host
                            ? text(
                                "Chờ tất cả người chơi sẵn sàng",
                                "Waiting for all duelists to ready up",
                              )
                            : myReady
                              ? text(
                                  "Bạn đã sẵn sàng! Chờ chủ phòng bắt đầu",
                                  "You are ready! Waiting for host to start",
                                )
                              : text(
                                  "Hãy bấm Sẵn Sàng để tham chiến",
                                  "Click Ready to prepare for match",
                                )}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {settingsChanged
                        ? text(
                            "⚠️ Cài đặt đã thay đổi, chủ phòng cần lưu trước khi bắt đầu.",
                            "⚠️ Settings changed, host must save before starting.",
                          )
                        : text(
                            "Đấu giao hữu cùng bạn bè · Rèn luyện phản xạ · Không tính Elo",
                            "Friendly match with friends · Reflex practice · No Elo changes",
                          )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {host ? (
                      <Button
                        size="lg"
                        className="h-12 w-full px-7 sm:w-auto"
                        disabled={
                          busy ||
                          !connected ||
                          !waiting ||
                          !canStart ||
                          settingsChanged
                        }
                        onClick={() =>
                          void run(async () => {
                            await friendlyRequest("friend-room:start", {
                              roomId: room.roomId,
                            });
                          })
                        }
                      >
                        <Swords className="size-5" />
                        <span>{text("BẮT ĐẦU TRẬN ĐẤU", "START MATCH")}</span>
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        variant={myReady ? "outline" : "default"}
                        className={cn(
                          "h-12 w-full px-7 sm:w-auto",
                          myReady &&
                            "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
                        )}
                        disabled={busy || !connected || !waiting}
                        onClick={() =>
                          void run(async () => {
                            setRoom(
                              await friendlyRequest<FriendRoomSnapshot>(
                                "friend-room:ready",
                                { roomId: room.roomId, ready: !myReady },
                              ),
                            );
                          })
                        }
                      >
                        {myReady ? (
                          <>
                            <CheckCircle2 className="size-5" />
                            <span>
                              {text(
                                "ĐÃ SẴN SÀNG (HỦY)",
                                "READY (CLICK TO CANCEL)",
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <Zap className="size-5 fill-current" />
                            <span>{text("SẴN SÀNG CHIẾN", "READY UP")}</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDEBAR: ROOM SETTINGS / INFORMATION */}
              <div className="space-y-6">
                {/* Only the host can see the settings controls. */}
                {host ? (
                  <section
                    className={cn(
                      surface,
                      "relative overflow-hidden p-5 sm:p-6",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <Settings className="size-4 text-blue-600" />
                        {text("CÀI ĐẶT TRẬN ĐẤU", "MATCH SETTINGS")}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {/* Capacity (multiplayer only) */}
                      {room.maxPlayers > 2 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            {text("Số người chơi tối đa", "Maximum duelists")}
                          </label>
                          <Select
                            value={String(capacity)}
                            disabled={!host || !waiting || busy}
                            onValueChange={(value) =>
                              setCapacity(Number(value))
                            }
                          >
                            <SelectTrigger
                              aria-label={text(
                                "Số người chơi tối đa",
                                "Maximum players",
                              )}
                              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-slate-200 bg-white text-slate-900">
                              {[3, 4, 5, 6, 7, 8].map((count) => (
                                <SelectItem
                                  key={count}
                                  value={String(count)}
                                  disabled={count < room.players.length}
                                >
                                  {count} {text("người chơi", "players")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Mode selection buttons */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          {text("Chế độ thi đấu", "Game mode")}
                        </label>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {[
                            {
                              id: "CLASSIC" as FriendMode,
                              name: "Classic",
                              desc: text("Nghĩa -> Từ vựng", "Meaning to word"),
                              icon: Swords,
                            },
                            {
                              id: "WORD_GUESS" as FriendMode,
                              name: "Word Guess",
                              desc: text(
                                "Đoán từ 5 ký tự",
                                "5-letter secret word",
                              ),
                              icon: Sparkles,
                            },
                            {
                              id: "WORD_CHAIN" as FriendMode,
                              name: "Word Chain",
                              desc: text("Nối từ thần tốc", "Chain reaction"),
                              icon: Flame,
                            },
                          ].map((item) => {
                            const isSelected = mode === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={!host || !waiting || busy}
                                onClick={() => {
                                  setMode(item.id);
                                  setSeconds(item.id === "CLASSIC" ? 15 : 20);
                                }}
                                className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-left transition-colors ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-50 text-blue-900"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                } disabled:cursor-not-allowed`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <item.icon
                                    className={`size-4 ${isSelected ? "text-blue-600" : "text-slate-400"}`}
                                  />
                                  <div>
                                    <span className="block text-sm font-semibold">
                                      {item.name}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                      {item.desc}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="size-4 text-blue-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Question count (Classic mode only) */}
                      {mode === "CLASSIC" && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            {text("Số câu hỏi", "Question count")}
                          </label>
                          <div className="mt-1.5 flex gap-1.5">
                            {[5, 10, 15, 20].map((count) => (
                              <button
                                key={count}
                                type="button"
                                disabled={!host || !waiting || busy}
                                onClick={() => setQuestionCount(count)}
                                className={`flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-colors ${
                                  questionCount === count
                                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                } disabled:cursor-not-allowed`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Seconds per question / turn */}
                      {mode !== "WORD_GUESS" && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            {mode === "CLASSIC"
                              ? text("Thời gian mỗi câu", "Time per question")
                              : text("Thời gian mỗi lượt", "Time per turn")}
                          </label>
                          <div className="mt-1.5 flex gap-1.5">
                            {[10, 15, 20, 30].map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={!host || !waiting || busy}
                                onClick={() => setSeconds(s)}
                                className={`flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-colors ${
                                  seconds === s
                                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                } disabled:cursor-not-allowed`}
                              >
                                {s}s
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mode Rule Explanation */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                        <p>
                          {mode === "WORD_GUESS"
                            ? text(
                                "💡 Đoán từ bí mật 5 chữ cái trong 5 lượt. Xanh: đúng vị trí; Vàng: sai vị trí; Xám: không có. Người đoán đúng trước sẽ chiến thắng!",
                                "💡 Guess secret 5-letter word in 5 tries. Green: correct; Yellow: misplaced; Gray: absent. First solver wins!",
                              )
                            : mode === "CLASSIC"
                              ? text(
                                  "💡 Đọc nghĩa tiếng Việt, gõ từ tiếng Anh chuẩn xác nhanh nhất để ghi điểm tối đa.",
                                  "💡 Read Vietnamese definition and quickly type correct English word for points.",
                                )
                              : text(
                                  "💡 Chủ phòng ra từ trước. Từ tiếp theo phải bắt đầu bằng chữ cái cuối của từ đối thủ. Hết giờ là xử thua!",
                                  "💡 Host goes first. Next word must start with previous word's last letter. Timeout loses!",
                                )}
                        </p>
                      </div>

                      {/* Host Save Settings Button */}
                      {host && (
                        <Button
                          variant={settingsChanged ? "default" : "outline"}
                          className="w-full"
                          disabled={
                            busy || !connected || !waiting || !settingsChanged
                          }
                          onClick={() => void saveSettings()}
                        >
                          <RefreshCw
                            className={`size-3.5 ${busy ? "animate-spin" : ""}`}
                          />
                          <span>
                            {settingsChanged
                              ? text("LƯU CÀI ĐẶT MỚI", "SAVE NEW SETTINGS")
                              : text("CÀI ĐẶT ĐÃ LƯU", "SETTINGS SAVED")}
                          </span>
                        </Button>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className={cn(surface, "overflow-hidden p-5 sm:p-6")}>
                    <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-semibold text-slate-900">
                      <Gamepad2 className="size-4 text-blue-600" />
                      {text("THÔNG TIN PHÒNG", "ROOM INFORMATION")}
                    </h2>
                    <dl
                      className="divide-y divide-slate-100"
                      aria-live="polite"
                    >
                      {[
                        {
                          label: text("Mã phòng", "Room code"),
                          value: room.code,
                        },
                        {
                          label: text("Chủ phòng", "Host"),
                          value:
                            room.players.find(
                              (player) => player.userId === room.hostId,
                            )?.username ?? "—",
                        },
                        {
                          label: text("Chế độ thi đấu", "Game mode"),
                          value: currentModeInfo.title,
                        },
                        {
                          label: text("Người chơi", "Players"),
                          value: room.players.length + "/" + room.maxPlayers,
                        },
                        {
                          label: text("Trạng thái", "Status"),
                          value: waiting
                            ? text("Đang chờ", "Waiting")
                            : text("Đang thi đấu", "In match"),
                        },
                        ...(room.mode === "CLASSIC"
                          ? [
                              {
                                label: text("Số câu hỏi", "Question count"),
                                value: room.settings.questionCount ?? 10,
                              },
                              {
                                label: text(
                                  "Thời gian mỗi câu",
                                  "Time per question",
                                ),
                                value:
                                  (room.settings.timePerQuestion ?? 15) +
                                  text(" giây", " seconds"),
                              },
                            ]
                          : room.mode === "WORD_CHAIN"
                            ? [
                                {
                                  label: text(
                                    "Thời gian mỗi lượt",
                                    "Time per turn",
                                  ),
                                  value:
                                    (room.settings.turnTime ?? 20) +
                                    text(" giây", " seconds"),
                                },
                              ]
                            : [
                                {
                                  label: text("Độ dài từ", "Word length"),
                                  value: text("5 chữ cái", "5 letters"),
                                },
                                {
                                  label: text("Số lượt đoán", "Guess limit"),
                                  value: 5,
                                },
                              ]),
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex items-start justify-between gap-4 py-3 text-sm"
                        >
                          <dt className="shrink-0 text-slate-500">{label}</dt>
                          <dd className="min-w-0 break-words text-right font-semibold text-slate-900">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {/* Invite players from the open seats, without a sidebar card. */}
                {host && waiting && !full && (
                  <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogContent
                      closeLabel={text("Đóng", "Close")}
                      className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto"
                    >
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 pr-6">
                          <UserPlus className="size-5 text-blue-600" />
                          {text("Mời bạn bè vào phòng", "Invite friends")}
                        </DialogTitle>
                        <DialogDescription>
                          {text(
                            "Chọn người chơi để gửi lời mời vào phòng.",
                            "Choose a player to invite to the room.",
                          )}
                        </DialogDescription>
                      </DialogHeader>
                      {notice && (
                        <p
                          role="alert"
                          className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
                        >
                          {notice}
                        </p>
                      )}
                      {/* Search box */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          aria-label={text("Tìm người chơi", "Search players")}
                          placeholder={text(
                            "Tìm tên người chơi…",
                            "Search players…",
                          )}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      {/* Pending invite notification */}
                      {pending && (
                        <div
                          role="status"
                          className="mt-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-700"
                        >
                          <span className="flex items-center gap-1.5 font-bold">
                            <Loader2 className="size-3.5 animate-spin text-blue-600" />
                            {text("Đang chờ phản hồi", "Waiting")} ·{" "}
                            {Math.max(
                              0,
                              Math.ceil(
                                (Date.parse(pending.expiresAt) - now) / 1000,
                              ),
                            )}
                            s
                          </span>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await friendlyRequest("friend:invite-cancel", {
                                  inviteId: pending.inviteId,
                                });
                                setPending(null);
                              })
                            }
                            className="cursor-pointer font-semibold text-red-600 hover:text-red-700"
                          >
                            {text("Hủy", "Cancel")}
                          </button>
                        </div>
                      )}

                      {playersLoading && (
                        <p
                          role="status"
                          className="flex items-center gap-2 text-sm text-slate-500"
                        >
                          <Loader2 className="size-4 animate-spin" />
                          {text(
                            "Đang tải danh sách người chơi…",
                            "Loading players…",
                          )}
                        </p>
                      )}
                      {/* Player list */}
                      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                        {players.map((player) => (
                          <div
                            key={player.userId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 transition-colors hover:bg-slate-50"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-slate-200">
                                <FriendlyAvatar
                                  avatar={player.avatarUrl}
                                  name={player.username}
                                />
                              </div>
                              <div className="min-w-0">
                                <strong className="block truncate text-sm font-semibold text-slate-900">
                                  {player.username}
                                </strong>
                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <span
                                    className={`size-1.5 rounded-full ${player.online ? "bg-emerald-500" : "bg-slate-400"}`}
                                  />
                                  {player.online ? "Online" : "Offline"}
                                </span>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="secondary"
                              className="shrink-0"
                              disabled={
                                busy ||
                                !connected ||
                                !player.online ||
                                !!pending
                              }
                              onClick={() =>
                                void run(async () =>
                                  setPending(
                                    await friendlyRequest("friend:invite", {
                                      friendId: player.userId,
                                      roomId: room.roomId,
                                      mode: room.mode,
                                    }),
                                  ),
                                )
                              }
                            >
                              {text("Mời", "Invite")}
                            </Button>
                          </div>
                        ))}

                        {!playersLoading && !players.length && (
                          <div className="py-4 text-center">
                            <p className="text-sm text-slate-500">
                              {text(
                                "Không tìm thấy người chơi trực tuyến.",
                                "No online players found.",
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {text(
                                "Hãy chia sẻ mã phòng để bạn bè cùng tham gia!",
                                "Share room code with friends to duel!",
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
