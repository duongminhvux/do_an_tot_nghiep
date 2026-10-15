"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Clock3,
  Copy,
  Crown,
  Gamepad2,
  Info,
  Link2,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Play,
  Search,
  Send,
  Settings,
  Share2,
  Smile,
  Sparkles,
  Star,
  Swords,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { arenaSocket } from "@/lib/arena-socket";
import {
  friendlyRequest,
  type FriendMode,
  type FriendInvite,
  type FriendPlayer,
  type FriendSnapshot,
} from "@/lib/friendly-arena";
import apiClient from "@/lib/axios";
import { useMatchExit } from "../hooks/use-match-exit";
import type { ApiResponse } from "@/services/types";

export function FriendlyAvatar({
  avatar,
  name,
}: {
  avatar?: string;
  name: string;
}) {
  return avatar ? (
    <img src={avatar} alt={name} className="size-full rounded-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center rounded-full bg-blue-50 text-blue-500">
      <UserRound className="size-10" />
    </span>
  );
}

interface ChatMessage {
  id: string;
  senderName: string;
  avatar?: string;
  text: string;
  time: string;
}

export default function FriendlyInvitePage() {
  return (
    <Suspense
      fallback={<div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f9ff]" />}
    >
      <FriendlyLobby />
    </Suspense>
  );
}

function FriendlyLobby() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId") || "";
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const vi = locale === "vi";
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?._id ? String(user._id) : "";

  // State
  const [mode, setMode] = useState<FriendMode>("CLASSIC");
  const [picker, setPicker] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<FriendPlayer[]>([]);
  const [opponent, setOpponent] = useState<FriendPlayer | null>(null);
  const [pending, setPending] = useState<FriendInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [room, setRoom] = useState<FriendSnapshot | null>(null);
  const [connected, setConnected] = useState(arenaSocket.connected);
  const [copied, setCopied] = useState(false);
  const [rounds, setRounds] = useState("10");
  const [turnTime, setTurnTime] = useState("20");

  // In-room chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m1",
      senderName: user?.username || (vi ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar: user?.avatarUrl,
      text: vi ? "Hello! Sẵn sàng chưa?" : "Hello! Ready yet?",
      time: "14:05",
    },
    {
      id: "m2",
      senderName: vi ? "Minh Anh" : "Sarah",
      avatar:
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80",
      text: vi ? "Sẵn sàng rồi nè! 🎉" : "Ready to play! 🎉",
      time: "14:06",
    },
    {
      id: "m3",
      senderName: user?.username || (vi ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar: user?.avatarUrl,
      text: vi ? "Ok bắt đầu thôi! 💪" : "Let's begin! 💪",
      time: "14:06",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const host = room?.hostId === currentUserId;
  const me = room?.players.find((p) => p.userId === currentUserId);
  const lobbyOpponent = room?.players.find((p) => p.userId !== currentUserId);
  const selectedOpponent = matchId ? lobbyOpponent : opponent;
  const waiting = room?.status === "WAITING";
  const waitingForReturn =
    room?.status === "FINISHED" && !lobbyOpponent?.returnedToLobby;
  const opponentLeft = !!lobbyOpponent?.leftLobby;

  const displayRoomCode = matchId
    ? matchId.length > 8
      ? matchId.slice(-6).toUpperCase()
      : matchId.toUpperCase()
    : "AB12CD";

  useMatchExit(matchId, !!room && (waiting || room.status === "FINISHED"), [
    "/" + locale + "/arena/friend/" + matchId,
    "/" +
      locale +
      "/arena/friend?matchId=" +
      encodeURIComponent(room?.nextMatchId || matchId),
  ]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!matchId) {
      setRoom(null);
      return;
    }
    if (!currentUserId) return;
    let active = true;
    setRoom(null);
    setPending(null);
    setOpponent(null);
    setPicker(false);
    setNotice("");
    const snapshot = (data: FriendSnapshot) => {
      if (!active || data.matchId !== matchId) return;
      const me = data.players.find((p) => p.userId === currentUserId);
      if (data.nextMatchId && me?.returnedToLobby) {
        setRoom(data);
        router.replace(
          "/" +
            locale +
            "/arena/friend?matchId=" +
            encodeURIComponent(data.nextMatchId),
        );
        return;
      }
      if (
        data.status === "PLAYING" ||
        (data.status === "FINISHED" && !me?.returnedToLobby)
      ) {
        router.replace(`/${locale}/arena/friend/${matchId}`);
        return;
      }
      if (
        data.status === "CANCELLED" ||
        (data.status === "FINISHED" &&
          data.players.some((p) => p.userId !== currentUserId && p.leftLobby))
      ) {
        setNotice(vi ? "Người chơi đã rời phòng." : "A player left the lobby.");
        router.replace(`/${locale}/arena/friend`);
        return;
      }
      setRoom(data);
      setMode(data.mode);
    };
    const join = async () => {
      setConnected(arenaSocket.connected);
      if (!arenaSocket.connected) return;
      if (!/^[a-f\d]{24}$/i.test(matchId)) {
        setNotice(vi ? "Mã phòng không hợp lệ." : "Invalid lobby ID.");
        return;
      }
      try {
        snapshot(
          await friendlyRequest<FriendSnapshot>("friend:join", {
            matchId,
            returnToLobby: true,
          }),
        );
      } catch (e) {
        if (active)
          setNotice(e instanceof Error ? e.message : "Unable to join lobby");
      }
    };
    const ready = (data: {
      matchId: string;
      userId: string;
      isReady: boolean;
    }) => {
      if (data.matchId !== matchId) return;
      setRoom((current) =>
        current
          ? {
              ...current,
              players: current.players.map((p) =>
                p.userId === data.userId ? { ...p, isReady: data.isReady } : p,
              ),
            }
          : current,
      );
    };
    const connection = (data: {
      matchId: string;
      userId: string;
      disconnectedAt: string | null;
    }) => {
      if (data.matchId !== matchId) return;
      setRoom((current) =>
        current
          ? {
              ...current,
              players: current.players.map((p) =>
                p.userId === data.userId
                  ? { ...p, disconnectedAt: data.disconnectedAt }
                  : p,
              ),
            }
          : current,
      );
    };
    const started = (data: { matchId: string }) => {
      if (data.matchId === matchId)
        router.replace(`/${locale}/arena/friend/${matchId}`);
    };
    const cancelled = (data: { matchId: string }) => {
      if (data.matchId !== matchId) return;
      setRoom(null);
      setNotice(vi ? "Người chơi đã rời phòng." : "A player left the lobby.");
      router.replace(`/${locale}/arena/friend`);
    };
    const connectedHandler = () => setConnected(true);
    const disconnectedHandler = () => setConnected(false);
    arenaSocket.on("friend:snapshot", snapshot);
    arenaSocket.on("friend:ready-update", ready);
    arenaSocket.on("friend:connection", connection);
    arenaSocket.on("friend:match-start", started);
    arenaSocket.on("friend:cancelled", cancelled);
    arenaSocket.on("connect", connectedHandler);
    arenaSocket.on("arena:authenticated", join);
    arenaSocket.on("disconnect", disconnectedHandler);
    void join();
    return () => {
      active = false;
      arenaSocket.off("friend:snapshot", snapshot);
      arenaSocket.off("friend:ready-update", ready);
      arenaSocket.off("friend:connection", connection);
      arenaSocket.off("friend:match-start", started);
      arenaSocket.off("friend:cancelled", cancelled);
      arenaSocket.off("connect", connectedHandler);
      arenaSocket.off("arena:authenticated", join);
      arenaSocket.off("disconnect", disconnectedHandler);
    };
  }, [matchId, currentUserId, locale, router, vi]);

  useEffect(() => {
    if (matchId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await apiClient.get<ApiResponse<FriendPlayer[]>>(
          "/arena/friend/players",
          { params: { search } },
        );
        if (active) setPlayers(response.data.data);
      } catch {
        if (active)
          setNotice(
            vi
              ? "Không tải được danh sách người chơi."
              : "Unable to load players.",
          );
      }
    };
    const delay = window.setTimeout(() => void load(), 250);
    const refresh = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearTimeout(delay);
      window.clearInterval(refresh);
    };
  }, [search, vi, matchId]);

  useEffect(() => {
    const sent = (data: FriendInvite) => {
      setPending(data);
      setPicker(false);
    };
    const closed = (data: { inviteId: string }) =>
      setPending((current) => {
        if (current?.inviteId !== data.inviteId) return current;
        setOpponent(null);
        setNotice(
          vi
            ? "Lời mời đã kết thúc hoặc bị từ chối."
            : "Invitation ended or was declined.",
        );
        return null;
      });
    arenaSocket.on("friend:invite-sent", sent);
    for (const event of [
      "friend:invite-declined",
      "friend:invite-expired",
      "friend:invite-cancelled",
    ])
      arenaSocket.on(event, closed);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(timer);
      arenaSocket.off("friend:invite-sent", sent);
      for (const event of [
        "friend:invite-declined",
        "friend:invite-expired",
        "friend:invite-cancelled",
      ])
        arenaSocket.off(event, closed);
    };
  }, [vi]);

  const invite = async (player: FriendPlayer) => {
    setBusy(true);
    setNotice("");
    setOpponent(player);
    try {
      setPending(
        await friendlyRequest<FriendInvite>("friend:invite", {
          friendId: player.userId,
          mode,
        }),
      );
      setPicker(false);
    } catch (e) {
      setOpponent(null);
      setNotice(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!pending) return true;
    setBusy(true);
    try {
      await friendlyRequest("friend:invite-cancel", {
        inviteId: pending.inviteId,
      });
      setPending(null);
      setOpponent(null);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const lobbyAction = async (event: string, extra: object = {}) => {
    if (!matchId) return false;
    setBusy(true);
    setNotice("");
    try {
      await friendlyRequest(event, { matchId, ...extra });
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (matchId) {
      if (!(await lobbyAction("friend:leave"))) return;
    } else if (pending && !(await cancel())) return;
    router.push(`/${locale}/arena`);
  };

  const chooseMode = (value: FriendMode) => {
    if (matchId) void lobbyAction("friend:mode", { mode: value });
    else setMode(value);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(displayRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const currentTime = new Date();
    const timeStr = `${String(currentTime.getHours()).padStart(2, "0")}:${String(
      currentTime.getMinutes(),
    ).padStart(2, "0")}`;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user?.username || (vi ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar: user?.avatarUrl,
      text: chatInput.trim(),
      time: timeStr,
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  const opponentCount = selectedOpponent || pending ? 2 : 1;

  const renderPlayerGroups = () => (
    <div className="mt-4">
      <h3 className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <Clock3 className="size-4 text-slate-400" />
        {vi ? "Đã từng đấu" : "Previously played"}
      </h3>
      <div className="mt-2 divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
        {players
          .filter((p) => p.recent && p.userId !== currentUserId)
          .map((p) => (
            <div key={p.userId} className="flex items-center gap-3 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-100">
                <FriendlyAvatar avatar={p.avatarUrl} name={p.username} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">
                  {p.username}
                </p>
                <p
                  className={`text-[10px] font-medium ${p.online ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {p.online
                    ? vi
                      ? "Đang online"
                      : "Online"
                    : vi
                      ? "Chơi gần đây"
                      : "Played recently"}
                </p>
              </div>
              <button
                disabled={!p.online || busy || !!pending || !!matchId}
                onClick={() => void invite(p)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Send className="size-3" />
                {vi ? "Mời" : "Invite"}
              </button>
            </div>
          ))}
      </div>
      {!players.some((p) => p.recent && p.userId !== currentUserId) && (
        <p className="py-6 text-center text-xs text-slate-400">
          {vi
            ? "Chưa có người từng đấu phù hợp."
            : "No previous opponents found."}
        </p>
      )}
    </div>
  );

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f5f9ff] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* ===================== TOP HEADER ===================== */}
        <header className="mb-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <button
              disabled={busy}
              onClick={() => void leave()}
              className="hover:text-blue-600 transition"
            >
              {vi ? "Đấu trường" : "Arena"}
            </button>
            <span>›</span>
            <span className="text-slate-800 font-semibold">
              {vi ? "Đấu 1vs1 với bạn bè" : "Friendly 1v1"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                disabled={busy}
                onClick={() => void leave()}
                className="flex size-11 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm transition hover:bg-blue-50 active:scale-95 disabled:opacity-50"
                aria-label={vi ? "Quay lại" : "Go back"}
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {vi ? "Đấu 1vs1 với bạn bè" : "Friendly 1vs1 match"}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  {vi
                    ? "Mời bạn vào phòng và sẵn sàng trước khi bắt đầu"
                    : "Invite friends to the lobby and ready up to begin"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={() => setPicker(true)}
                disabled={busy || !!matchId}
                className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 sm:text-sm disabled:opacity-50"
              >
                <Share2 className="size-4 text-blue-600" />
                <span>{vi ? "Mời bạn" : "Invite"}</span>
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 sm:text-sm"
              >
                <Settings className="size-4 text-purple-600" />
                <span>{vi ? "Chế độ chơi" : "Game mode"}</span>
              </button>

              <button
                disabled={busy}
                onClick={() => void leave()}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 sm:text-sm disabled:opacity-50"
              >
                <LogOut className="size-4 text-rose-500" />
                <span>{vi ? "Rời phòng" : "Leave lobby"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Notices */}
        {notice && (
          <div
            role="alert"
            className="mb-4 animate-in fade-in rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800 shadow-sm"
          >
            {notice}
          </div>
        )}

        {/* ===================== MAIN GRID ===================== */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ================= LEFT COLUMN ================= */}
          <div className="flex flex-col gap-4">
            {/* Top Room Info Banner */}
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-slate-100">
                {/* 1. Room Code */}
                <div className="flex flex-col justify-center sm:pr-4">
                  <span className="text-xs font-semibold text-slate-500">
                    {vi ? "Mã phòng" : "Room code"}
                  </span>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-black tracking-widest text-blue-600 sm:text-3xl">
                      {displayRoomCode}
                    </span>
                    <button
                      onClick={copyCode}
                      className="group flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      title={vi ? "Sao chép mã" : "Copy code"}
                    >
                      {copied ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : (
                        <Copy className="size-4 transition group-hover:scale-110" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Game Mode */}
                <div className="flex items-center gap-3.5 sm:px-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 shadow-sm">
                    <Gamepad2 className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-500">
                      {vi ? "Chế độ chơi" : "Game mode"}
                    </span>
                    <p className="truncate text-base font-bold text-slate-900">
                      {mode === "CLASSIC" ? "Classic" : vi ? "Nối từ" : "Word Chain"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {mode === "CLASSIC"
                        ? vi
                          ? "Nghĩa → Từ"
                          : "Meaning → Word"
                        : vi
                          ? "Nối từ theo 2 chữ cuối"
                          : "Chain last 2 letters"}
                    </p>
                  </div>
                </div>

                {/* 3. Number of players */}
                <div className="flex items-center gap-3.5 sm:pl-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm">
                    <UserPlus className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-500">
                      {vi ? "Số người chơi" : "Players"}
                    </span>
                    <p className="text-base font-bold text-slate-900">
                      {opponentCount} / 2
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {opponentCount === 2
                        ? vi
                          ? "Đã đủ người, sẵn sàng!"
                          : "Ready to start!"
                        : vi
                          ? "Đang chờ đối thủ..."
                          : "Waiting for opponent..."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Main 1v1 VS Section */}
            <section className="relative rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_120px_1fr]">
                {/* Player 1 Card (You / Host) */}
                <div className="relative flex flex-col items-center justify-between rounded-3xl border border-blue-200 bg-blue-50/20 p-5 shadow-xs transition hover:border-blue-300">
                  {/* Host badge */}
                  {(matchId ? host : true) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 shadow-xs">
                        <Crown className="size-3 fill-amber-500 text-amber-500" />
                        {vi ? "Chủ phòng" : "Host"}
                      </span>
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="relative mt-2 flex size-24 items-center justify-center sm:size-28">
                    <div className="size-full overflow-hidden rounded-full ring-4 ring-blue-100 shadow-sm">
                      <FriendlyAvatar
                        avatar={user?.avatarUrl}
                        name={user?.username || (vi ? "Bạn" : "You")}
                      />
                    </div>
                    <span className="absolute bottom-1 right-1 size-5 rounded-full border-2 border-white bg-emerald-500 ring-2 ring-emerald-100" />
                  </div>

                  {/* Name and Tag */}
                  <div className="mt-3 text-center">
                    <strong className="block text-base font-bold text-slate-900">
                      {user?.username || (vi ? "Nguyễn Văn A" : "Alex")}
                    </strong>
                    <span className="mt-1 inline-block rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                      {vi ? "Bạn" : "You"}
                    </span>
                  </div>

                  {/* Status Button */}
                  <div className="mt-4 w-full">
                    <button
                      disabled={busy || !matchId || host}
                      onClick={() => void lobbyAction(me?.isReady ? "friend:ready" : "friend:ready")}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold shadow-xs transition ${
                        (matchId ? (host || me?.isReady) : true)
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      <Check className="size-4" />
                      <span>{vi ? "Đã sẵn sàng" : "Ready"}</span>
                    </button>
                  </div>
                </div>

                {/* Center VS Element */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-5xl font-black italic tracking-tighter text-transparent bg-gradient-to-br from-blue-600 via-indigo-500 to-fuchsia-500 bg-clip-text sm:text-6xl drop-shadow-sm">
                    VS
                  </span>
                  <div className="mt-2 flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-600">
                    <Sparkles className="size-3.5 text-blue-500" />
                    <span>1 vs 1</span>
                  </div>
                </div>

                {/* Player 2 Card (Opponent / Guest) */}
                {pending || selectedOpponent || matchId ? (
                  <div className="relative flex flex-col items-center justify-between rounded-3xl border border-slate-200 bg-slate-50/50 p-5 shadow-xs transition hover:border-blue-200">
                    {/* Guest badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-xs">
                        <Users className="size-3 text-slate-500" />
                        {selectedOpponent?.userId === room?.hostId
                          ? vi ? "Chủ phòng" : "Host"
                          : vi ? "Khách mời" : "Guest"}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className="relative mt-2 flex size-24 items-center justify-center sm:size-28">
                      <div className="size-full overflow-hidden rounded-full ring-4 ring-slate-200 shadow-sm">
                        <FriendlyAvatar
                          avatar={selectedOpponent?.avatarUrl}
                          name={selectedOpponent?.username || "Player"}
                        />
                      </div>
                      <span
                        className={`absolute bottom-1 right-1 size-5 rounded-full border-2 border-white ${
                          selectedOpponent?.disconnectedAt
                            ? "bg-slate-300"
                            : "bg-emerald-500 ring-2 ring-emerald-100"
                        }`}
                      />
                    </div>

                    {/* Name */}
                    <div className="mt-3 text-center">
                      <strong className="block text-base font-bold text-slate-900 truncate max-w-[150px]">
                        {selectedOpponent?.username ||
                          (vi ? "Minh Anh" : "Opponent")}
                      </strong>
                      <span className="mt-1 inline-block rounded-md bg-slate-200/60 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {vi ? "Đối thủ" : "Opponent"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="mt-4 w-full">
                      {pending ? (
                        <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-600">
                          <span className="size-2 rounded-full bg-blue-500 animate-ping" />
                          <span>
                            {vi ? "Đang mời" : "Waiting"} ·{" "}
                            {Math.max(
                              0,
                              Math.ceil((Date.parse(pending.expiresAt) - now) / 1000),
                            )}
                            s
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold ${
                            selectedOpponent?.isReady || (matchId && !host && selectedOpponent?.userId === room?.hostId)
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <Check className="size-4" />
                          <span>
                            {selectedOpponent?.isReady || (matchId && !host && selectedOpponent?.userId === room?.hostId)
                              ? vi ? "Đã sẵn sàng" : "Ready"
                              : vi ? "Chưa sẵn sàng" : "Not ready"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setPicker(true)}
                    className="group flex min-h-[220px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-5 text-center transition-all hover:border-blue-400 hover:bg-blue-50/60"
                  >
                    <div className="flex size-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-transform group-hover:scale-110 shadow-xs">
                      <UserPlus className="size-7" />
                    </div>
                    <strong className="mt-3 text-sm font-bold text-blue-600">
                      {vi ? "Mời bạn bè" : "Invite a friend"}
                    </strong>
                    <span className="mt-1 text-xs text-slate-400">
                      {vi ? "Bấm để chọn người chơi" : "Click to select a friend"}
                    </span>
                  </button>
                )}
              </div>

              {/* Banner under VS Cards */}
              <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-blue-50/70 border border-blue-100 p-3 text-center text-xs font-medium text-slate-700">
                <BookOpen className="size-4 text-blue-600 shrink-0" />
                <span>
                  <strong>{mode === "CLASSIC" ? "Classic" : vi ? "Nối từ" : "Word Chain"}</strong>:{" "}
                  {vi
                    ? "Chơi vui cùng bạn bè · Không tính điểm rank hay elo"
                    : "Friendly match for practice · No Elo rating changes"}
                </span>
              </div>
            </section>

            {/* Bottom Row: Chat Room & Start Match CTA */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_300px]">
              {/* In-Room Chat Card */}
              <section className="flex flex-col rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                {/* Chat Header */}
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <MessageSquare className="size-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {vi ? "Trò chuyện phòng" : "Room chat"}
                  </h3>
                </div>

                {/* Messages List */}
                <div className="flex h-36 flex-col gap-2.5 overflow-y-auto pr-1 text-xs sm:h-40">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2.5">
                      <div className="size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                        <FriendlyAvatar avatar={msg.avatar} name={msg.senderName} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {msg.time}
                          </span>
                        </div>
                        <div className="mt-0.5 inline-block rounded-2xl rounded-tl-none bg-slate-100 px-3 py-1.5 text-xs text-slate-800">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input Box */}
                <form
                  onSubmit={handleSendMessage}
                  className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-blue-500 focus-within:bg-white transition"
                >
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    title="Emoji"
                  >
                    <Smile className="size-4" />
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={vi ? "Nhập tin nhắn..." : "Type a message..."}
                    className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-xs"
                    title="Send"
                  >
                    <Send className="size-3.5" />
                  </button>
                </form>
              </section>

              {/* Start Match CTA Box */}
              <div className="flex flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white p-5 shadow-sm text-center">
                <button
                  disabled={
                    busy ||
                    (matchId
                      ? !waiting ||
                        opponentLeft ||
                        !connected ||
                        (host
                          ? !lobbyOpponent?.isReady ||
                            !!lobbyOpponent?.disconnectedAt
                          : !!me?.isReady || !!lobbyOpponent?.disconnectedAt)
                      : !opponent || !!pending)
                  }
                  onClick={() =>
                    matchId
                      ? void lobbyAction(host ? "friend:start" : "friend:ready")
                      : opponent && void invite(opponent)
                  }
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 px-6 text-base font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 sm:text-lg"
                >
                  <Play className="size-5 fill-white transition group-hover:scale-110" />
                  <span>
                    {matchId
                      ? !room
                        ? vi ? "Đang tải phòng…" : "Loading lobby…"
                        : waitingForReturn
                          ? vi ? "Chờ đối thủ" : "Waiting for opponent"
                          : host
                            ? vi ? "Bắt đầu trận" : "Start match"
                            : me?.isReady
                              ? vi ? "Đã sẵn sàng" : "Ready"
                              : vi ? "Sẵn sàng" : "Ready up"
                      : pending
                        ? vi ? "Đang chờ chấp nhận…" : "Waiting for response…"
                        : vi ? "Bắt đầu trận" : "Start match"}
                  </span>
                </button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  {matchId
                    ? host
                      ? vi
                        ? "Chỉ chủ phòng mới có thể bắt đầu"
                        : "Only host can start the match"
                      : vi
                        ? "Bấm Sẵn sàng để chủ phòng bắt đầu"
                        : "Ready up to let host start"
                    : vi
                      ? "Cần tối thiểu 2 người và tất cả phải sẵn sàng"
                      : "Requires 2 players ready to begin"}
                </p>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN (SIDEBAR) ================= */}
          <div className="flex flex-col gap-4">
            {/* Card 1: Match Settings */}
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Settings className="size-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {vi ? "Cài đặt trận" : "Match settings"}
                </h3>
              </div>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Classic Mode */}
                <button
                  disabled={!!pending || busy || (!!matchId && (!waiting || !host || !connected))}
                  onClick={() => chooseMode("CLASSIC")}
                  className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                    mode === "CLASSIC"
                      ? "border-blue-500 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  {mode === "CLASSIC" && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <BookOpen className="size-6 text-blue-600" />
                  <strong className="mt-2 text-sm">Classic</strong>
                  <span className="text-[11px] text-slate-500">
                    {vi ? "Nghĩa → Từ" : "Meaning → Word"}
                  </span>
                </button>

                {/* Word Chain Mode */}
                <button
                  disabled={!!pending || busy || (!!matchId && (!waiting || !host || !connected))}
                  onClick={() => chooseMode("WORD_CHAIN")}
                  className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                    mode === "WORD_CHAIN"
                      ? "border-blue-500 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  {mode === "WORD_CHAIN" && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <Gamepad2 className="size-6 text-violet-500" />
                  <strong className="mt-2 text-sm">{vi ? "Nối từ" : "Word Chain"}</strong>
                  <span className="text-[11px] text-slate-500">
                    {vi ? "Nối từ tiếng Anh" : "English word chain"}
                  </span>
                </button>
              </div>

              {/* Setting Controls */}
              <div className="mt-4 space-y-3">
                {/* Rounds */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Users className="size-4 text-slate-400" />
                    <span>{vi ? "Số vòng" : "Rounds"}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={rounds}
                      onChange={(e) => setRounds(e.target.value)}
                      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs font-bold text-slate-800 shadow-2xs outline-none hover:border-blue-300"
                    >
                      <option value="5">5 {vi ? "câu" : "rounds"}</option>
                      <option value="10">10 {vi ? "câu" : "rounds"}</option>
                      <option value="15">15 {vi ? "câu" : "rounds"}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Turn Time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Clock className="size-4 text-slate-400" />
                    <span>{vi ? "Thời gian mỗi câu" : "Time per turn"}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={turnTime}
                      onChange={(e) => setTurnTime(e.target.value)}
                      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs font-bold text-slate-800 shadow-2xs outline-none hover:border-blue-300"
                    >
                      <option value="15">15 {vi ? "giây" : "seconds"}</option>
                      <option value="20">20 {vi ? "giây" : "seconds"}</option>
                      <option value="30">30 {vi ? "giây" : "seconds"}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Game Rules / Hints Box */}
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50/80 border border-blue-100 p-3.5 text-xs text-slate-600">
                <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
                <ul className="space-y-1 text-[11px] leading-relaxed">
                  <li>• {vi ? "Cần cả 2 người chơi sẵn sàng để bắt đầu" : "Both players must be ready to begin"}</li>
                  <li>• {vi ? "Không ảnh hưởng bảng xếp hạng hay điểm Elo" : "Friendly match - no Elo rating changes"}</li>
                </ul>
              </div>
            </section>

            {/* Card 2: Invite Friends Sidebar */}
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {vi ? "Mời bạn bè" : "Invite friends"}
                  </h3>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="size-4 text-slate-400" />
                <input
                  aria-label={vi ? "Tìm bạn bè" : "Search friends"}
                  placeholder={vi ? "Tìm bạn bè…" : "Search friends…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-900 outline-none"
                />
              </label>

              {renderPlayerGroups()}
            </section>
          </div>
        </div>
      </div>

      {/* Friend Picker Modal (Mobile or Triggered) */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <UserPlus className="size-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {vi ? "Mời bạn bè thi đấu" : "Invite friends"}
                </h2>
              </div>
              <button
                aria-label={vi ? "Đóng" : "Close"}
                onClick={() => setPicker(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="size-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={vi ? "Tìm bạn bè…" : "Search friends…"}
                className="w-full bg-transparent text-xs text-slate-900 outline-none"
              />
            </label>

            {renderPlayerGroups()}

            <button
              onClick={() => setPicker(false)}
              className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              {vi ? "Đóng" : "Close"}
            </button>
          </section>
        </div>
      )}

      {/* Game Mode Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900">
              {vi ? "Cài đặt chế độ chơi" : "Game mode settings"}
            </h3>
            <p className="text-xs text-slate-500">
              {vi
                ? "Chọn thể loại câu hỏi và quy định thời gian"
                : "Choose game mode and round durations"}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {vi ? "Chế độ chơi" : "Game mode"}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => chooseMode("CLASSIC")}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
                      mode === "CLASSIC"
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => chooseMode("WORD_CHAIN")}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
                      mode === "WORD_CHAIN"
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {vi ? "Nối từ" : "Word Chain"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  {vi ? "Số vòng" : "Rounds"}: {rounds} {vi ? "câu" : "rounds"}
                </label>
                <div className="mt-2 flex gap-2">
                  {["5", "10", "15"].map((num) => (
                    <button
                      key={num}
                      onClick={() => setRounds(num)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        rounds === num
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {num} {vi ? "câu" : "rounds"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  {vi ? "Thời gian mỗi câu" : "Time per turn"}: {turnTime}s
                </label>
                <div className="mt-2 flex gap-2">
                  {["15", "20", "30"].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setTurnTime(sec)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        turnTime === sec
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 shadow-xs"
            >
              {vi ? "Lưu & Đóng" : "Save & Close"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
