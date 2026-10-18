"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Flame,
  Layers,
  Link2,
  Loader2,
  Sparkles,
  Swords,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { arenaSocket } from "@/lib/arena-socket";
import { friendlyRequest, type FriendInvite } from "@/lib/friendly-arena";
import { cn } from "@/lib/utils";

export function FriendlyInvitations() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const vi = locale === "vi";
  const [invites, setInvites] = useState<FriendInvite[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const invite = invites[0];

  useEffect(() => {
    const received = (data: FriendInvite) =>
      setInvites((items) =>
        items.some((i) => i.inviteId === data.inviteId)
          ? items
          : [...items, data],
      );
    const closed = (data: { inviteId: string }) =>
      setInvites((items) => items.filter((i) => i.inviteId !== data.inviteId));
    const created = (data: {
      code: string;
      inviteId: string;
      maxPlayers: number;
    }) => {
      closed(data);
      router.push(
        `/${locale}/arena/${data.maxPlayers > 2 ? "group" : "friend"}/room/${data.code}`,
      );
    };

    arenaSocket.on("friend:invite-received", received);
    arenaSocket.on("friend:invite-expired", closed);
    arenaSocket.on("friend:invite-cancelled", closed);
    arenaSocket.on("friend:invite-declined", closed);
    arenaSocket.on("friend:invite-accepted", created);

    return () => {
      arenaSocket.off("friend:invite-received", received);
      arenaSocket.off("friend:invite-expired", closed);
      arenaSocket.off("friend:invite-cancelled", closed);
      arenaSocket.off("friend:invite-declined", closed);
      arenaSocket.off("friend:invite-accepted", created);
    };
  }, [locale, pathname, router]);

  useEffect(() => {
    if (!invite) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [invite]);

  if (!invite) return null;

  // Friendly invitations expire after 10 seconds on the server.
  const totalMilliseconds = 10_000;
  const remainingMilliseconds = Math.max(0, Date.parse(invite.expiresAt) - now);
  const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
  const progress = Math.min(1, remainingMilliseconds / totalMilliseconds);

  const respond = async (accept: boolean) => {
    setBusy(true);
    setError("");
    try {
      await friendlyRequest(
        accept ? "friend:invite-accept" : "friend:invite-decline",
        { inviteId: invite.inviteId },
      );
      setInvites((items) =>
        items.filter((i) => i.inviteId !== invite.inviteId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const isClassic = invite.mode === "CLASSIC";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4 transition-all">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="friendly-invite-title"
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-[2rem] border border-blue-100/50 bg-white shadow-2xl",
          "shadow-blue-500/10 animate-in fade-in-0 zoom-in-95 duration-250",
        )}
      >
        {/* Glow Header Accent */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 pt-7 pb-6 text-white overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute -top-12 -right-12 size-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 size-28 rounded-full bg-indigo-400/20 blur-lg pointer-events-none" />

          {/* Top Row: Category Badge & Countdown */}
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wide backdrop-blur-md">
              <Swords className="size-3.5 text-amber-300 animate-pulse" />
              <span>
                {invite.rematchOf
                  ? vi
                    ? "TÁI ĐẤU 1 VS 1"
                    : "1V1 REMATCH"
                  : vi
                    ? "THÁCH ĐẤU 1 VS 1"
                    : "1V1 CHALLENGE"}
              </span>
            </div>

            {/* Circular / Pill Countdown */}
            <div
              className={cn(
                "flex min-w-16 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black tabular-nums transition-colors",
                remainingSeconds <= 3
                  ? "bg-rose-500 text-white"
                  : "bg-white/20 text-white",
              )}
            >
              <Clock className="size-3.5" />
              <span>{remainingSeconds}s</span>
            </div>
          </div>

          {/* Inviter Info Header */}
          <div className="relative z-10 mt-5 flex items-center gap-4">
            {/* Avatar Frame with Glowing Ring */}
            <div className="relative size-16 shrink-0 rounded-2xl bg-white/20 p-0.5 shadow-lg shadow-black/10 ring-2 ring-white/40">
              <div className="size-full overflow-hidden rounded-[14px] bg-slate-100 flex items-center justify-center">
                {invite.avatarUrl ? (
                  <Image
                    src={invite.avatarUrl}
                    alt={invite.username}
                    width={64}
                    height={64}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound className="size-8 text-blue-600" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white bg-emerald-500 ring-2 ring-emerald-400/50" />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                id="friendly-invite-title"
                className="truncate text-lg font-black text-white"
              >
                {invite.username}
              </h2>
              <p className="mt-0.5 text-xs text-blue-100/90 flex items-center gap-1">
                <Sparkles className="size-3.5 text-amber-300" />
                {vi
                  ? "gửi lời mời khiêu chiến đến bạn"
                  : "challenged you to a battle"}
              </p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* Match Mode Highlight Card */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                  isClassic
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                    : "bg-gradient-to-br from-violet-500 to-fuchsia-600",
                )}
              >
                {isClassic ? (
                  <Layers className="size-5" />
                ) : (
                  <Link2 className="size-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800">
                    {invite.mode === "WORD_GUESS"
                      ? vi
                        ? "Đoán từ (5 ký tự)"
                        : "Word guess (5 letters)"
                      : isClassic
                        ? vi
                          ? "Từ vựng Cổ điển (Classic)"
                          : "Classic Vocabulary"
                        : vi
                          ? "Nối từ nhanh (Word Chain)"
                          : "Word Chain Duel"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      isClassic
                        ? "bg-blue-100 text-blue-700"
                        : "bg-violet-100 text-violet-700",
                    )}
                  >
                    1 vs 1
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                  {invite.mode === "WORD_GUESS"
                    ? vi
                      ? "Tìm từ bí mật trong tối đa 5 lượt đoán"
                      : "Find the secret word in up to 5 guesses"
                    : isClassic
                      ? vi
                        ? "Đọc nghĩa tiếng Việt và nhập từ tiếng Anh"
                        : "Read the meaning and type the English word"
                      : vi
                        ? "Nối từ tiếp sức không ngừng theo chữ cái cuối"
                        : "Rapid word chaining with consecutive letters"}
                </p>
              </div>
            </div>
          </div>

          {/* Time Expiring Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-medium text-slate-400">
              <span>{vi ? "Thời gian phản hồi" : "Response time"}</span>
              <span
                className={cn(
                  "min-w-8 text-right font-bold tabular-nums",
                  remainingSeconds <= 3 ? "text-rose-500" : "text-blue-600",
                )}
              >
                {remainingSeconds}s
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={vi ? "Thời gian phản hồi" : "Response time"}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={Math.min(10, remainingMilliseconds / 1000)}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                key={invite.inviteId}
                className={cn(
                  "h-full w-full origin-left rounded-full transition-transform duration-100 ease-linear motion-reduce:transition-none",
                  remainingSeconds <= 3
                    ? "bg-rose-500"
                    : remainingSeconds <= 6
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600",
                )}
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          </div>

          <p
            className={cn(
              "mt-2 min-h-4 text-center text-xs text-slate-400",
              remainingSeconds > 0 && "invisible",
            )}
          >
            {vi ? "Lời mời sắp hết hạn..." : "Invitation is expiring..."}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-center text-xs font-semibold text-rose-600"
            >
              {error}
            </div>
          )}

          {/* Multi-invites Queue Indicator */}
          {invites.length > 1 && (
            <p className="mt-2 text-center text-[11px] font-semibold text-indigo-600">
              {vi
                ? `+${invites.length - 1} lời mời thách đấu khác đang chờ`
                : `+${invites.length - 1} more challenge invites queued`}
            </p>
          )}

          {/* Action Buttons */}
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond(false)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50",
                "text-xs font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <X className="size-4" />
              <span>{vi ? "Từ chối" : "Decline"}</span>
            </button>

            <button
              type="button"
              disabled={busy || remainingSeconds === 0}
              onClick={() => void respond(true)}
              className={cn(
                "flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl text-xs font-bold text-white transition",
                "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-500/25",
                "hover:brightness-110 active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{vi ? "Đang tham gia..." : "Joining..."}</span>
                </>
              ) : (
                <>
                  <Swords className="size-4" />
                  <span>{vi ? "Chấp nhận thách đấu" : "Accept Challenge"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
