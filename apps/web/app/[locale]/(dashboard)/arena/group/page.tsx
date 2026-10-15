"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Crown,
  Gamepad2,
  Info,
  Link2,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  Settings,
  Share2,
  Smile,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";

interface Player {
  id: string;
  name: string;
  avatar?: string;
  isHost: boolean;
  isMe: boolean;
  isReady: boolean;
  status: "ready" | "not_ready";
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatar?: string;
  text: string;
  time: string;
}

function PlayerAvatar({ avatar, name }: { avatar?: string; name: string }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="size-full rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-full items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-sm">
      <UserRound className="size-6 text-blue-500" />
    </span>
  );
}

export default function GroupArenaWaitingRoomPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const { t } = useTranslation("common");
  const currentUser = useAppSelector((state) => state.auth.user);

  // Room state
  const [roomCode] = useState("QZ7K9F");
  const [copied, setCopied] = useState(false);
  const [gameMode, setGameMode] = useState<"WORD_CHAIN" | "CLASSIC">("WORD_CHAIN");
  const [maxPlayers, setMaxPlayers] = useState("8");
  const [turnTime, setTurnTime] = useState("20");

  // Dialogs
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [startAlert, setStartAlert] = useState<string | null>(null);

  // Players list state
  const [players, setPlayers] = useState<Player[]>([
    {
      id: "p1",
      name: currentUser?.username || (locale === "vi" ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar:
        currentUser?.avatarUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      isHost: true,
      isMe: true,
      isReady: true,
      status: "ready",
    },
    {
      id: "p2",
      name: "Minh Anh",
      avatar:
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80",
      isHost: false,
      isMe: false,
      isReady: true,
      status: "ready",
    },
    {
      id: "p3",
      name: "Lan Chi",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      isHost: false,
      isMe: false,
      isReady: true,
      status: "ready",
    },
    {
      id: "p4",
      name: "Tuấn Anh",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isHost: false,
      isMe: false,
      isReady: false,
      status: "not_ready",
    },
  ]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m1",
      senderId: "p1",
      senderName: currentUser?.username || (locale === "vi" ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar:
        currentUser?.avatarUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      text: locale === "vi" ? "Hello mọi người!" : "Hello everyone!",
      time: "14:05",
    },
    {
      id: "p3",
      senderId: "p3",
      senderName: "Lan Chi",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      text: locale === "vi" ? "Bắt đầu khi đủ người nhé!" : "Let's start when full!",
      time: "14:06",
    },
    {
      id: "p2",
      senderId: "p2",
      senderName: "Minh Anh",
      avatar:
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80",
      text: "Ok 👍",
      time: "14:06",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: "p1",
      senderName: currentUser?.username || (locale === "vi" ? "Nguyễn Văn A" : "Alex Nguyen"),
      avatar:
        currentUser?.avatarUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      text: chatInput.trim(),
      time: timeStr,
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  const toggleMyReady = () => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.isMe) {
          const nextReady = !p.isReady;
          return {
            ...p,
            isReady: nextReady,
            status: nextReady ? "ready" : "not_ready",
          };
        }
        return p;
      })
    );
  };

  const handleStartGame = () => {
    const unreadyPlayers = players.filter((p) => !p.isReady);
    if (players.length < 2) {
      setStartAlert(
        t("group_arena.min_players_alert", "Cần tối thiểu 2 người chơi để bắt đầu trận!")
      );
      setTimeout(() => setStartAlert(null), 3000);
      return;
    }
    if (unreadyPlayers.length > 0) {
      setStartAlert(
        t("group_arena.unready_alert", "Còn {{names}} chưa sẵn sàng!", {
          names: unreadyPlayers.map((p) => p.name).join(", "),
        })
      );
      setTimeout(() => setStartAlert(null), 3500);
      return;
    }
    router.push(`/${locale}/arena/group/${roomCode}`);
  };

  const maxSlots = parseInt(maxPlayers, 10) || 8;
  const emptySlotsCount = Math.max(0, maxSlots - players.length);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f5f9ff] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* ===================== BREADCRUMB & TOP HEADER ===================== */}
        <header className="mb-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <button
              onClick={() => router.push(`/${locale}/arena`)}
              className="hover:text-blue-600 transition"
            >
              {locale === "vi" ? "Đấu trường" : "Arena"}
            </button>
            <span>›</span>
            <span className="text-slate-800 font-semibold">
              {t("group_arena.title", "Phòng chơi nhóm")}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="flex size-11 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm transition hover:bg-blue-50 active:scale-95"
                title={locale === "vi" ? "Quay lại Đấu trường" : "Back to Arena"}
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    {t("group_arena.title", "Phòng chơi nhóm")}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                    <Users className="size-3.5" />
                    <span>
                      {players.length}/{maxSlots}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  {t("group_arena.subtitle", "Mời bạn bè và cùng luyện từ vựng!")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 sm:text-sm"
              >
                <Share2 className="size-4 text-blue-600" />
                <span>{t("group_arena.invite", "Mời bạn")}</span>
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 sm:text-sm"
              >
                <Settings className="size-4 text-purple-600" />
                <span>{t("group_arena.settings", "Cài đặt phòng")}</span>
              </button>

              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 sm:text-sm"
              >
                <LogOut className="size-4 text-rose-500" />
                <span>{t("group_arena.leave", "Rời phòng")}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Start Alert Toast Notification */}
        {startAlert && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800 shadow-sm">
            {startAlert}
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
                    {t("group_arena.room_code", "Mã phòng")}
                  </span>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-black tracking-widest text-blue-600 sm:text-3xl">
                      {roomCode}
                    </span>
                    <button
                      onClick={copyRoomCode}
                      className="group flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      title={t("group_arena.copy_code", "Sao chép mã phòng")}
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
                      {t("group_arena.game_mode", "Chế độ chơi")}
                    </span>
                    <p className="truncate text-base font-bold text-slate-900">
                      {gameMode === "WORD_CHAIN"
                        ? t("group_arena.word_chain", "Nối từ")
                        : t("group_arena.classic", "Classic")}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {gameMode === "WORD_CHAIN"
                        ? t("group_arena.word_chain_desc", "Nối từ tiếng Anh theo chữ cái")
                        : t("group_arena.classic_desc", "Nghĩa → Từ")}
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
                      {t("group_arena.player_count", "Số người chơi")}
                    </span>
                    <p className="text-base font-bold text-slate-900">
                      {players.length} / {maxSlots}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {t("group_arena.waiting_players", "Đang chờ thêm người chơi")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Players Grid (8 Slots) */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
              {/* Occupied Player Cards */}
              {players.map((player) => (
                <div
                  key={player.id}
                  className="group relative flex min-h-[215px] flex-col items-center justify-between rounded-3xl border border-blue-100 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                >
                  {/* Host badge if host */}
                  {player.isHost && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 shadow-xs">
                        <Crown className="size-3 fill-amber-500 text-amber-500" />
                        {t("group_arena.host", "Chủ phòng")}
                      </span>
                    </div>
                  )}

                  {/* Options button on top right (if not me) */}
                  {!player.isMe && (
                    <button
                      className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 opacity-60 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                      title="Options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}

                  {/* Avatar with Status indicator */}
                  <div className="relative mt-2 flex size-18 items-center justify-center sm:size-20">
                    <div className="size-full overflow-hidden rounded-full ring-4 ring-blue-50/80 shadow-xs">
                      <PlayerAvatar avatar={player.avatar} name={player.name} />
                    </div>
                    {/* Online / Ready dot */}
                    <span
                      className={`absolute bottom-0 right-1 size-4 rounded-full border-2 border-white ${
                        player.isReady
                          ? "bg-emerald-500 ring-2 ring-emerald-100"
                          : "bg-amber-400 ring-2 ring-amber-100"
                      }`}
                      title={
                        player.isReady
                          ? t("group_arena.ready", "Đã sẵn sàng")
                          : t("group_arena.not_ready", "Chưa sẵn sàng")
                      }
                    />
                  </div>

                  {/* Name and Tag */}
                  <div className="text-center">
                    <span className="block truncate text-sm font-bold text-slate-900 max-w-[110px] sm:max-w-[130px]">
                      {player.name}
                    </span>
                    {player.isMe && (
                      <span className="mt-1 inline-block rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                        {t("group_arena.you", "Bạn")}
                      </span>
                    )}
                  </div>

                  {/* Ready Status Badge / Button */}
                  <div className="w-full">
                    {player.isMe ? (
                      <button
                        onClick={toggleMyReady}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold shadow-xs transition active:scale-95 ${
                          player.isReady
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {player.isReady ? (
                          <>
                            <Check className="size-3.5" />
                            <span>{t("group_arena.ready", "Đã sẵn sàng")}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="size-3.5" />
                            <span>{t("group_arena.not_ready", "Chưa sẵn sàng")}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div
                        className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold ${
                          player.isReady
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {player.isReady ? (
                          <>
                            <Check className="size-3.5" />
                            <span>{t("group_arena.ready", "Đã sẵn sàng")}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="size-3.5" />
                            <span>{t("group_arena.not_ready", "Chưa sẵn sàng")}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty Slots */}
              {Array.from({ length: emptySlotsCount }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  onClick={() => setShowInviteModal(true)}
                  className="group flex min-h-[215px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50/60"
                  role="button"
                  tabIndex={0}
                  title={t("group_arena.invite", "Mời thêm người chơi")}
                >
                  <div className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-transform group-hover:scale-110">
                    <Plus className="size-5" />
                  </div>
                  <span className="mt-3 text-xs font-bold text-blue-600">
                    {t("group_arena.waiting_slot", "Đang chờ người chơi...")}
                  </span>
                </div>
              ))}
            </section>

            {/* Bottom Row: Chat Room & Start Match CTA */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_300px]">
              {/* In-Room Chat Card */}
              <section className="flex flex-col rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                {/* Chat Header */}
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <MessageSquare className="size-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {t("group_arena.chat_room", "Trò chuyện phòng")}
                  </h3>
                </div>

                {/* Messages List */}
                <div className="flex h-36 flex-col gap-2.5 overflow-y-auto pr-1 text-xs sm:h-40">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2.5">
                      <div className="size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                        <PlayerAvatar avatar={msg.avatar} name={msg.senderName} />
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
                    placeholder={t("group_arena.chat_placeholder", "Nhập tin nhắn...")}
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
                  onClick={handleStartGame}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 px-6 text-base font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] sm:text-lg"
                >
                  <Play className="size-5 fill-white transition group-hover:scale-110" />
                  <span>{t("group_arena.start_match", "Bắt đầu trận")}</span>
                </button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  {t(
                    "group_arena.start_requirement",
                    "Cần tối thiểu 2 người và tất cả phải sẵn sàng"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN (SIDEBAR) ================= */}
          <div className="flex flex-col gap-4">
            {/* Card 1: Room Settings */}
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Settings className="size-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {t("group_arena.settings", "Cài đặt phòng")}
                </h3>
              </div>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Classic Mode */}
                <button
                  onClick={() => setGameMode("CLASSIC")}
                  className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                    gameMode === "CLASSIC"
                      ? "border-blue-500 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  {gameMode === "CLASSIC" && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <BookOpen className="size-6 text-blue-600" />
                  <strong className="mt-2 text-sm">
                    {t("group_arena.classic", "Classic")}
                  </strong>
                  <span className="text-[11px] text-slate-500">
                    {t("group_arena.classic_desc", "Nghĩa → Từ")}
                  </span>
                </button>

                {/* Word Chain Mode */}
                <button
                  onClick={() => setGameMode("WORD_CHAIN")}
                  className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                    gameMode === "WORD_CHAIN"
                      ? "border-blue-500 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  {gameMode === "WORD_CHAIN" && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <Link2 className="size-6 text-violet-500" />
                  <strong className="mt-2 text-sm">
                    {t("group_arena.word_chain", "Nối từ")}
                  </strong>
                  <span className="text-[11px] text-slate-500">
                    {t("group_arena.word_chain_desc", "Nối từ theo chữ cái")}
                  </span>
                </button>
              </div>

              {/* Setting Controls */}
              <div className="mt-4 space-y-3">
                {/* Max Players */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Users className="size-4 text-slate-400" />
                    <span>{t("group_arena.max_players", "Số người tối đa")}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs font-bold text-slate-800 shadow-2xs outline-none hover:border-blue-300"
                    >
                      <option value="4">4 {t("group_arena.players", "người")}</option>
                      <option value="6">6 {t("group_arena.players", "người")}</option>
                      <option value="8">8 {t("group_arena.players", "người")}</option>
                      <option value="10">10 {t("group_arena.players", "người")}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Turn Time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Clock className="size-4 text-slate-400" />
                    <span>{t("group_arena.turn_time", "Thời gian mỗi lượt")}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={turnTime}
                      onChange={(e) => setTurnTime(e.target.value)}
                      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs font-bold text-slate-800 shadow-2xs outline-none hover:border-blue-300"
                    >
                      <option value="15">15 {t("group_arena.seconds", "giây")}</option>
                      <option value="20">20 {t("group_arena.seconds", "giây")}</option>
                      <option value="30">30 {t("group_arena.seconds", "giây")}</option>
                      <option value="45">45 {t("group_arena.seconds", "giây")}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Game Rules / Hints Box */}
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50/80 border border-blue-100 p-3.5 text-xs text-slate-600">
                <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
                <ul className="space-y-1 text-[11px] leading-relaxed">
                  <li>• {t("group_arena.rules.r1", "Từ phải bắt đầu bằng chữ được yêu cầu")}</li>
                  <li>• {t("group_arena.rules.r2", "Chỉ cho phép từ tiếng Anh hợp lệ")}</li>
                  <li>• {t("group_arena.rules.r3", "Không được trùng từ đã dùng")}</li>
                  <li>• {t("group_arena.rules.r4", "Hết thời gian sẽ thua lượt")}</li>
                </ul>
              </div>
            </section>

            {/* Card 2: Players List (Summary) */}
            <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {t("group_arena.player_list", "Danh sách người chơi")} ({players.length}/{maxSlots})
                  </h3>
                </div>
              </div>

              {/* List */}
              <div className="divide-y divide-slate-100">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/50 rounded-xl px-1"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                        <PlayerAvatar avatar={player.avatar} name={player.name} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-slate-900 max-w-[120px]">
                            {player.name}
                          </p>
                          {player.isHost && (
                            <Crown className="size-3 text-amber-500 shrink-0 fill-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`size-2 rounded-full ${
                              player.isReady ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                          />
                          <span
                            className={`text-[10px] font-semibold ${
                              player.isReady
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {player.isReady
                              ? t("group_arena.ready", "Đã sẵn sàng")
                              : t("group_arena.not_ready", "Chưa sẵn sàng")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      title="Options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Share2 className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t("group_arena.invite_modal_title", "Mời bạn bè tham gia")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    "group_arena.invite_modal_desc",
                    "Gửi mã hoặc link phòng để bạn bè cùng tham gia"
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <span className="text-[11px] font-bold text-slate-500">
                {t("group_arena.room_code", "Mã phòng")}
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xl font-black tracking-widest text-blue-600">
                  {roomCode}
                </span>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>{t("group_arena.copied", "Đã sao chép")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>{t("group_arena.copy_code", "Sao chép")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs font-bold text-slate-800">
                {t("group_arena.online_friends", "Bạn bè đang trực tuyến")}
              </span>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-slate-100">
                {[
                  {
                    name: "Hoàng Nam",
                    avatar:
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
                    level: "Rank Kim Cương",
                  },
                  {
                    name: "Bảo Trâm",
                    avatar:
                      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
                    level: "Rank Vàng",
                  },
                ].map((friend, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={friend.avatar}
                        alt=""
                        className="size-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{friend.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {friend.level}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => alert(`Đã gửi lời mời tới ${friend.name}!`)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 transition"
                    >
                      {t("group_arena.invite", "Mời")}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              {locale === "vi" ? "Đóng" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* 2. Leave Room Confirm Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl text-slate-900">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <LogOut className="size-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {t("group_arena.leave_modal_title", "Rời phòng chờ?")}
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">
              {t(
                "group_arena.leave_modal_desc",
                "Bạn có chắc chắn muốn rời khỏi phòng chơi nhóm này không?"
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                {t("group_arena.stay", "Ở lại")}
              </button>
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white transition hover:bg-rose-700 shadow-xs"
              >
                {t("group_arena.confirm_leave", "Rời phòng")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Settings Modal (Mobile/Tablet quick view) */}
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
              {t("group_arena.settings", "Cài đặt phòng")}
            </h3>
            <p className="text-xs text-slate-500">
              {locale === "vi"
                ? "Tùy chỉnh thông số trận đấu theo nhóm của bạn"
                : "Customize game settings for your group"}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t("group_arena.game_mode", "Chế độ chơi")}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGameMode("CLASSIC")}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
                      gameMode === "CLASSIC"
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t("group_arena.classic", "Classic")}
                  </button>
                  <button
                    onClick={() => setGameMode("WORD_CHAIN")}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
                      gameMode === "WORD_CHAIN"
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t("group_arena.word_chain", "Nối từ")}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t("group_arena.max_players", "Số người tối đa")}: {maxPlayers}{" "}
                  {t("group_arena.players", "người")}
                </label>
                <div className="mt-2 flex gap-2">
                  {["4", "6", "8", "10"].map((num) => (
                    <button
                      key={num}
                      onClick={() => setMaxPlayers(num)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        maxPlayers === num
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t("group_arena.turn_time", "Thời gian mỗi lượt")}: {turnTime}s
                </label>
                <div className="mt-2 flex gap-2">
                  {["15", "20", "30", "45"].map((sec) => (
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
              {locale === "vi" ? "Lưu & Đóng" : "Save & Close"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
