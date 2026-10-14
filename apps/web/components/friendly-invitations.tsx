"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { arenaSocket } from "@/lib/arena-socket";
import { friendlyRequest, type FriendInvite } from "@/lib/friendly-arena";

export function FriendlyInvitations() {
  const router = useRouter();
  const params = useParams();
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
    const created = (data: { matchId: string; inviteId: string }) => {
      closed(data);
      router.push(`/${locale}/arena/friend/${data.matchId}`);
    };
    arenaSocket.on("friend:invite-received", received);
    arenaSocket.on("friend:invite-expired", closed);
    arenaSocket.on("friend:invite-cancelled", closed);
    arenaSocket.on("friend:invite-declined", closed);
    arenaSocket.on("friend:match-created", created);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(timer);
      arenaSocket.off("friend:invite-received", received);
      arenaSocket.off("friend:invite-expired", closed);
      arenaSocket.off("friend:invite-cancelled", closed);
      arenaSocket.off("friend:invite-declined", closed);
      arenaSocket.off("friend:match-created", created);
    };
  }, [locale, router]);
  if (!invite) return null;
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(invite.expiresAt) - now) / 1000),
  );
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
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="friendly-invite-title"
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"
      >
        <h2
          id="friendly-invite-title"
          className="text-xl font-bold text-slate-900"
        >
          {invite.rematchOf
            ? vi
              ? "Lời mời tái đấu"
              : "Rematch request"
            : vi
              ? "Lời mời đấu giao hữu"
              : "Friendly invitation"}
        </h2>
        <p className="mt-4 text-slate-600">
          {invite.username} {vi ? "mời bạn đấu 1v1" : "invited you to play 1v1"}
        </p>
        <p className="mt-2 font-semibold text-blue-600">
          {invite.mode === "CLASSIC" ? "Classic" : "Word Chain"} · {seconds}s
        </p>
        {seconds === 0 && (
          <p className="mt-2 text-sm text-slate-500">
            {vi
              ? "Đang chờ máy chủ xác nhận hết hạn…"
              : "Waiting for server expiration…"}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => void respond(false)}
            className="flex-1 rounded-xl bg-slate-100 p-3 font-semibold disabled:opacity-50"
          >
            {vi ? "Từ chối" : "Decline"}
          </button>
          <button
            disabled={busy || seconds === 0}
            onClick={() => void respond(true)}
            className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
          >
            {vi ? "Chấp nhận" : "Accept"}
          </button>
        </div>
      </section>
    </div>
  );
}
