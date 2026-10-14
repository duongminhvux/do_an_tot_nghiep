"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock3,
  Gamepad2,
  Link2,
  Search,
  Send,
  Sparkles,
  Star,
  Swords,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { arenaSocket } from "@/lib/arena-socket";
import {
  friendlyRequest,
  type FriendMode,
  type FriendInvite,
  type FriendPlayer,
} from "@/lib/friendly-arena";
import apiClient from "@/lib/axios";
import type { ApiResponse } from "@/services/types";

export function FriendlyAvatar({
  avatar,
  name,
}: {
  avatar?: string;
  name: string;
}) {
  return avatar ? (
    <img src={avatar} alt={name} className="size-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center bg-blue-50 text-blue-500">
      <UserRound className="size-10" />
    </span>
  );
}

export default function FriendlyInvitePage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const vi = locale === "vi";
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?._id ? String(user._id) : "";
  const [mode, setMode] = useState<FriendMode>("CLASSIC");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<FriendPlayer[]>([]);
  const [opponent, setOpponent] = useState<FriendPlayer | null>(null);
  const [pending, setPending] = useState<FriendInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
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
  }, [search, vi]);
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
    if (!pending) return;
    setBusy(true);
    try {
      await friendlyRequest("friend:invite-cancel", {
        inviteId: pending.inviteId,
      });
      setPending(null);
      setOpponent(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const renderPlayerGroups = () => (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Clock3 className="size-4 text-slate-500" />
        {vi ? "Đã từng đấu" : "Previously played"}
      </h3>
      <div className="mt-3 divide-y divide-slate-100">
        {players
          .filter((p) => p.recent && p.userId !== currentUserId)
          .map((p) => (
            <div key={p.userId} className="flex items-center gap-3 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="size-5 text-slate-400" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">
                  {p.username}
                </p>
                <p
                  className={`text-xs ${p.online ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {p.online
                    ? vi
                      ? "Đang online"
                      : "Online"
                    : vi
                      ? "Chơi 1 tuần trước"
                      : "Played recently"}
                </p>
              </div>
              <button
                disabled={!p.online || busy}
                onClick={() => void invite(p)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Send className="size-3.5" />
                {vi ? "Mời" : "Invite"}
              </button>
            </div>
          ))}
      </div>
      {!players.some((p) => p.recent && p.userId !== currentUserId) && (
        <p className="py-8 text-center text-sm text-slate-400">
          {vi
            ? "Chưa có người từng đấu phù hợp."
            : "No previous opponents found."}
        </p>
      )}
    </div>
  );
  const highlights: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
  }[] = [
    {
      icon: Gamepad2,
      title: vi ? "Chế độ Friendly" : "Friendly mode",
      subtitle: vi ? "Đấu vui cùng bạn bè" : "Play with friends",
    },
    {
      icon: Star,
      title: vi ? "Không tính điểm rank" : "No rank rating",
      subtitle: vi ? "Chỉ để luyện tập" : "Just for practice",
    },
    {
      icon: Users,
      title: vi ? "Mời bạn để bắt đầu" : "Invite to begin",
      subtitle: vi ? "Chọn một người bạn" : "Choose a friend",
    },
  ];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f5f9ff] px-4 py-5 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="hover:text-blue-600"
              >
                {vi ? "Đấu trường" : "Arena"}
              </button>
              <span>›</span>
              <span>{vi ? "Mời bạn bè" : "Invite friends"}</span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="mt-1 flex size-11 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-500 shadow-sm"
                aria-label={vi ? "Quay lại" : "Go back"}
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {vi ? "Đấu với bạn bè" : "Play with friends"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {vi
                    ? "Mời một người bạn để bắt đầu trận đấu 1v1 và cùng luyện từ vựng."
                    : "Invite a friend to start a 1v1 vocabulary match."}
                </p>
              </div>
            </div>
          </div>
          <button className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm sm:flex">
            <BookOpen className="size-4 text-blue-600" />
            {vi ? "Hướng dẫn" : "Guide"}
          </button>
        </header>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_332px]">
          <div className="min-w-0">
            <section className="grid min-h-[300px] items-center gap-5 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:grid-cols-[1fr_100px_1fr] sm:p-8">
              <div className="flex flex-col items-center">
                <div className="relative flex size-36 items-center justify-center overflow-hidden rounded-3xl bg-blue-50 ring-8 ring-blue-50/70">
                  <FriendlyAvatar
                    avatar={user?.avatarUrl}
                    name={user?.username || "You"}
                  />
                  <span className="absolute bottom-2 right-2 size-5 rounded-full border-4 border-white bg-emerald-500" />
                </div>
                <strong className="mt-4 text-base">
                  {user?.username || (vi ? "Bạn" : "You")}
                </strong>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  <Check className="size-3.5" />
                  {vi ? "Sẵn sàng thi đấu" : "Ready to play"}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black italic tracking-tighter text-transparent bg-gradient-to-br from-blue-600 via-violet-500 to-fuchsia-500 bg-clip-text sm:text-6xl">
                  VS
                </span>
                <Sparkles className="mt-2 size-5 text-blue-300" />
              </div>
              {pending || opponent ? (
                <div className="flex flex-col items-center">
                  <div className="relative flex size-36 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 ring-8 ring-slate-50">
                    <FriendlyAvatar
                      avatar={opponent?.avatarUrl}
                      name={opponent?.username || "Player"}
                    />
                  </div>
                  <strong className="mt-4">
                    {opponent?.username || (vi ? "Người chơi" : "Player")}
                  </strong>
                  <p className="mt-2 text-xs font-semibold text-blue-600">
                    {vi ? "Đang chờ chấp nhận" : "Waiting for acceptance"} ·{" "}
                    {pending
                      ? Math.max(
                          0,
                          Math.ceil(
                            (Date.parse(pending.expiresAt) - now) / 1000,
                          ),
                        )
                      : 10}
                    s
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => void cancel()}
                    className="mt-2 text-xs text-slate-400 hover:text-red-500"
                  >
                    {vi ? "Hủy lời mời" : "Cancel invitation"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPicker(true)}
                  className="group flex min-h-44 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/30 text-blue-600 transition hover:bg-blue-50"
                >
                  <span className="flex size-16 items-center justify-center rounded-full bg-blue-100/80">
                    <UserPlus className="size-8" />
                  </span>
                  <strong className="mt-3">
                    {vi ? "Mời bạn bè" : "Invite a friend"}
                  </strong>
                  <span className="mt-1 text-xs text-slate-500">
                    {vi ? "Bấm để chọn người chơi" : "Choose a player"}
                  </span>
                </button>
              )}
            </section>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {highlights.map(({ icon: Icon, title, subtitle }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold">{title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <section className="mt-3 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-bold">
                {vi ? "Chọn chế độ chơi" : "Choose game mode"}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(["CLASSIC", "WORD_CHAIN"] as FriendMode[]).map((value) => (
                  <button
                    key={value}
                    disabled={!!pending || busy}
                    onClick={() => setMode(value)}
                    className={`relative rounded-2xl border p-5 text-center transition disabled:opacity-60 ${mode === value ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200"}`}
                  >
                    {mode === value && (
                      <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                    {value === "CLASSIC" ? (
                      <BookOpen className="mx-auto size-7 text-blue-600" />
                    ) : (
                      <Link2 className="mx-auto size-7 text-violet-500" />
                    )}
                    <strong className="mt-3 block text-sm">
                      {value === "CLASSIC"
                        ? "Classic"
                        : vi
                          ? "Nối từ"
                          : "Word Chain"}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {value === "CLASSIC"
                        ? vi
                          ? "Nghĩa → Từ"
                          : "Meaning → Word"
                        : vi
                          ? "Nối từ theo chữ cái cuối"
                          : "Chain words by their last letter"}
                    </p>
                  </button>
                ))}
              </div>
              <button
                disabled={!opponent || !!pending || busy}
                onClick={() => opponent && void invite(opponent)}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Swords className="size-4" />
                {vi ? "Bắt đầu trận đấu" : "Start match"}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <Star className="size-3.5 text-slate-400" />
                {vi
                  ? "Đây là trận đấu giao hữu để luyện tập và giải trí, không ảnh hưởng đến Elo hay bảng xếp hạng."
                  : "Friendly matches are for practice and do not affect Elo or rankings."}
              </p>
            </section>
            {notice && (
              <p
                role="status"
                className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm"
              >
                {notice}
              </p>
            )}
          </div>

          <aside className="hidden rounded-3xl border border-blue-100 bg-white p-5 shadow-sm lg:block">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">
                {vi ? "Mời bạn bè" : "Invite friends"}
              </h2>
              <button
                aria-label={vi ? "Đóng" : "Close"}
                onClick={() => setPicker(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="size-4 text-slate-400" />
              <input
                aria-label={vi ? "Tìm bạn bè" : "Search friends"}
                placeholder={vi ? "Tìm bạn bè…" : "Search friends…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            {renderPlayerGroups()}
          </aside>
        </div>
      </div>
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 lg:hidden">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="friend-picker-title"
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="friend-picker-title" className="text-lg font-bold">
                {vi ? "Mời bạn bè" : "Invite friends"}
              </h2>
              <button
                aria-label={vi ? "Đóng" : "Close"}
                onClick={() => setPicker(false)}
              >
                <X />
              </button>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-xl border p-3">
              <Search className="size-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={vi ? "Tìm bạn bè…" : "Search friends…"}
                className="w-full outline-none"
              />
            </label>
            {renderPlayerGroups()}
          </section>
        </div>
      )}
    </main>
  );
}
