"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { arenaSocket } from "@/lib/arena-socket";
import {
  friendlyRequest,
  type FriendSnapshot,
  type FriendMode,
} from "@/lib/friendly-arena";
import { useRankedMatch } from "../../hooks/use-ranked-match";
import { useMatchExit } from "../../hooks/use-match-exit";
import { FriendlyAvatar } from "../page";

type Turn = {
  matchId: string;
  currentTurnUserId: string;
  previousWord: string;
  requiredLetter: string;
  turnDeadline: string;
  turnCount: number;
  usedWords: string[];
  serverNow: string;
};

export default function FriendlyMatchPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const matchId = String(params.matchId);
  const vi = locale === "vi";
  const user = useAppSelector((state) => state.auth.user);
  const userId = user?._id || "";
  const game = useRankedMatch(matchId, userId, true);
  const [room, setRoom] = useState<FriendSnapshot | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [word, setWord] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useMatchExit(matchId, room?.status === "PLAYING" && !game.finished);
  useEffect(() => {
    setRoom(null);
    setTurn(null);
    setNotice("");
    const snapshot = (data: FriendSnapshot) => {
      if (data.matchId === matchId) {
        setRoom(data);
        setOffset(Date.parse(data.serverNow) - Date.now());
      }
    };
    const started = (data: { matchId: string }) => {
      if (data.matchId === matchId)
        setRoom((r) => (r ? { ...r, status: "PLAYING" } : r));
    };
    const ready = (data: {
      matchId: string;
      userId: string;
      isReady: boolean;
    }) => {
      if (data.matchId === matchId)
        setRoom((r) =>
          r
            ? {
                ...r,
                players: r.players.map((p) =>
                  p.userId === data.userId
                    ? { ...p, isReady: data.isReady }
                    : p,
                ),
              }
            : r,
        );
    };
    const connection = (data: {
      matchId: string;
      userId: string;
      disconnectedAt: string | null;
    }) => {
      if (data.matchId === matchId)
        setRoom((r) =>
          r
            ? {
                ...r,
                players: r.players.map((p) =>
                  p.userId === data.userId
                    ? { ...p, disconnectedAt: data.disconnectedAt }
                    : p,
                ),
              }
            : r,
        );
    };
    const nextTurn = (data: Turn) => {
      if (data.matchId === matchId) {
        setTurn(data);
        setOffset(Date.parse(data.serverNow) - Date.now());
        setWord("");
        setNotice("");
        setBusy(false);
        started(data);
      }
    };
    const invalid = (data: { matchId: string; reason: string }) => {
      if (data.matchId !== matchId) return;
      const reasons: Record<string, string> = {
        INVALID_START_LETTER: vi
          ? "Từ phải bắt đầu bằng chữ được yêu cầu."
          : "Start with the required letter.",
        WORD_ALREADY_USED: vi
          ? "Từ này đã được sử dụng."
          : "This word has already been used.",
        WORD_NOT_FOUND: vi
          ? "Không tìm thấy từ này trong kho từ vựng."
          : "Word not found in the vocabulary.",
        NOT_YOUR_TURN: vi ? "Chưa đến lượt bạn." : "It is not your turn.",
        TURN_EXPIRED: vi ? "Lượt này đã hết hạn." : "This turn has expired.",
      };
      setNotice(reasons[data.reason] || data.reason);
      setBusy(false);
    };
    const cancelled = (data: { matchId: string }) => {
      if (data.matchId === matchId) {
        setRoom((r) => (r ? { ...r, status: "CANCELLED" } : r));
        setNotice(
          vi ? "Người chơi đã rời phòng." : "The other player left the room.",
        );
      }
    };
    const scores = (data: {
      matchId: string;
      players: { userId: string; score: number }[];
    }) => {
      if (data.matchId === matchId)
        setRoom((r) =>
          r
            ? {
                ...r,
                players: r.players.map((p) => ({
                  ...p,
                  score:
                    data.players.find((s) => s.userId === p.userId)?.score ??
                    p.score,
                })),
              }
            : r,
        );
    };
    arenaSocket.on("friend:snapshot", snapshot);
    arenaSocket.on("friend:match-start", started);
    arenaSocket.on("friend:ready-update", ready);
    arenaSocket.on("friend:connection", connection);
    arenaSocket.on("word-chain:turn", nextTurn);
    arenaSocket.on("word-chain:invalid", invalid);
    arenaSocket.on("friend:cancelled", cancelled);
    arenaSocket.on("match:score-update", scores);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(timer);
      arenaSocket.off("friend:snapshot", snapshot);
      arenaSocket.off("friend:match-start", started);
      arenaSocket.off("friend:ready-update", ready);
      arenaSocket.off("friend:connection", connection);
      arenaSocket.off("word-chain:turn", nextTurn);
      arenaSocket.off("word-chain:invalid", invalid);
      arenaSocket.off("friend:cancelled", cancelled);
      arenaSocket.off("match:score-update", scores);
    };
  }, [matchId, userId, vi]);
  const action = async (event: string, extra: object = {}) => {
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
    if (
      room?.status === "PLAYING" &&
      !game.finished &&
      !window.confirm(
        vi
          ? "Bạn có muốn thoát trận? Thoát sẽ bị tính thua."
          : "Leave this match? Leaving counts as a loss.",
      )
    )
      return;
    if (
      !room ||
      game.finished ||
      room.status === "CANCELLED" ||
      (await action("friend:leave"))
    )
      router.push(`/${locale}/arena`);
  };
  const host = room?.hostId === userId;
  const me = room?.players.find((p) => p.userId === userId);
  const opponent = room?.players.find((p) => p.userId !== userId);
  const chain = room?.mode === "WORD_CHAIN";
  const myTurn = turn?.currentTurnUserId === userId;
  const disconnected = opponent?.disconnectedAt;
  const displayTime = disconnected ? Date.parse(disconnected) : now + offset;
  const seconds = turn
    ? Math.max(
        0,
        Math.ceil((Date.parse(turn.turnDeadline) - displayTime) / 1000),
      )
    : 20;
  const grace = disconnected
    ? Math.max(
        0,
        20 - Math.floor((now + offset - Date.parse(disconnected)) / 1000),
      )
    : 0;
  const final = game.finalResult;
  const duration =
    final?.startedAt && final.finishedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.parse(final.finishedAt) - Date.parse(final.startedAt)) / 1000,
          ),
        )
      : 0;
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f6f9ff] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {chain ? "Word Chain" : "Classic"} · 1v1
          </h1>
          <button
            disabled={busy}
            onClick={() => void leave()}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
          >
            {vi ? "Rời phòng" : "Leave"}
          </button>
        </div>
        <section className="mt-6 grid grid-cols-[1fr_70px_1fr] items-center rounded-3xl bg-white p-6 shadow-sm">
          {[me, opponent].map((p, i) => (
            <div
              key={i}
              className={
                i === 1
                  ? "col-start-3 row-start-1 flex flex-col items-center gap-3"
                  : "flex flex-col items-center gap-3"
              }
            >
              <FriendlyAvatar
                avatar={p?.avatarUrl}
                name={p?.username || "Player"}
              />
              <strong>{p?.username || "…"}</strong>
              <span className="text-sm text-blue-600">
                {room?.status === "WAITING"
                  ? p?.userId === room.hostId
                    ? "HOST"
                    : p?.isReady
                      ? vi
                        ? "Sẵn sàng"
                        : "Ready"
                      : vi
                        ? "Chưa sẵn sàng"
                        : "Not ready"
                  : chain
                    ? ""
                    : (p?.score ?? 0)}
              </span>
            </div>
          ))}
          <span className="col-start-2 row-start-1 text-center text-3xl font-black italic text-violet-500">
            VS
          </span>
        </section>
        {(!game.connected || disconnected) && !game.finished && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {!game.connected
              ? vi
                ? "Mất kết nối. Đang kết nối lại…"
                : "Reconnecting…"
              : `${opponent?.username}: ${vi ? "mất kết nối, chờ kết nối lại" : "waiting for reconnection"} · ${grace}s`}
          </p>
        )}
        {notice && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
          >
            {notice}
          </p>
        )}
        {game.error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {game.error}
          </p>
        )}
        {!room && (
          <div className="mt-6 rounded-3xl bg-white p-8 text-center">
            <p>{vi ? "Đang tải phòng…" : "Loading lobby…"}</p>
            <button onClick={game.retryReady} className="mt-4 text-blue-600">
              {vi ? "Thử lại" : "Retry"}
            </button>
          </div>
        )}
        {room?.status === "WAITING" && !game.finished && (
          <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">
              {vi ? "Phòng chờ giao hữu" : "Friendly lobby"}
            </h2>
            {host && (
              <div className="mt-5 flex justify-center gap-3">
                {(["CLASSIC", "WORD_CHAIN"] as FriendMode[]).map((mode) => (
                  <button
                    disabled={busy}
                    key={mode}
                    onClick={() => void action("friend:mode", { mode })}
                    className={`rounded-xl border px-5 py-3 ${room.mode === mode ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200"}`}
                  >
                    {mode === "CLASSIC" ? "Classic" : "Word Chain"}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm text-slate-500">
              {vi
                ? "Người được mời bấm Sẵn sàng, sau đó chủ phòng bắt đầu."
                : "The invited player readies, then the host starts."}
            </p>
            <button
              disabled={
                busy ||
                !game.connected ||
                (host ? !opponent?.isReady || !!disconnected : !!me?.isReady)
              }
              onClick={() =>
                void action(host ? "friend:start" : "friend:ready")
              }
              className="mt-6 rounded-xl bg-blue-600 px-8 py-3 font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {host
                ? vi
                  ? "Bắt đầu trận"
                  : "Start match"
                : me?.isReady
                  ? vi
                    ? "Đã sẵn sàng"
                    : "Ready"
                  : vi
                    ? "Sẵn sàng"
                    : "Ready"}
            </button>
          </section>
        )}
        {room?.status === "PLAYING" &&
          !game.finished &&
          (chain ? (
            <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-400">
                {vi ? "Chuỗi hiện tại" : "Current chain"}:{" "}
                {turn?.turnCount ?? 0} {vi ? "từ" : "words"}
              </p>
              <h2 className="mt-5 break-all text-4xl font-extrabold text-slate-900">
                {turn?.previousWord.toUpperCase() ||
                  (vi ? "Chủ phòng bắt đầu" : "Host starts")}
              </h2>
              <p className="mt-4 text-slate-400">↓</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                {vi ? "Chữ tiếp theo" : "Next letter"}
              </p>
              <p className="mt-2 text-7xl font-black text-violet-600">
                {turn?.requiredLetter.toUpperCase() || "?"}
              </p>
              <p className="mt-5 text-slate-600">
                {myTurn
                  ? vi
                    ? "Đến lượt bạn"
                    : "Your turn"
                  : `${vi ? "Chờ" : "Waiting for"} ${opponent?.username || "…"}`}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("word-chain:submit", { word });
                }}
                className="mx-auto mt-5 flex max-w-md gap-2"
              >
                <input
                  aria-label={vi ? "Nhập từ tiếng Anh" : "English word"}
                  autoComplete="off"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  disabled={
                    !myTurn ||
                    busy ||
                    !game.connected ||
                    seconds <= 0 ||
                    !!disconnected
                  }
                  placeholder={
                    vi ? "Nhập từ tiếng Anh…" : "Enter an English word…"
                  }
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
                <button
                  disabled={
                    !myTurn ||
                    busy ||
                    !word.trim() ||
                    !game.connected ||
                    seconds <= 0 ||
                    !!disconnected
                  }
                  className="rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-40"
                >
                  {vi ? "Gửi" : "Send"}
                </button>
              </form>
              <p
                className={`mt-5 text-3xl font-black ${seconds <= 5 ? "text-red-500" : "text-blue-600"}`}
              >
                {seconds}s
              </p>
              <p className="mt-5 break-words text-sm text-slate-400">
                {turn?.usedWords.join(" → ")}
              </p>
            </section>
          ) : (
            <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-400">
                {vi ? "Câu" : "Question"}{" "}
                {game.currentQuestion?.questionIndex ?? 1} / 10 ·{" "}
                {game.timeLeft}s
              </p>
              <h2 className="mt-6 text-3xl font-bold text-slate-900">
                {game.currentQuestion?.meaning || "…"}
              </h2>
              <p className="mt-5 tracking-[0.4em] text-blue-600">
                {game.currentQuestion?.letters
                  ?.map((letter) => letter || "_")
                  .join(" ")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  game.submitAnswer();
                }}
                className="mx-auto mt-6 flex max-w-lg gap-2"
              >
                <input
                  ref={game.inputRef}
                  aria-label={vi ? "Đáp án tiếng Anh" : "English answer"}
                  value={game.answer}
                  onChange={(e) => game.setAnswer(e.target.value)}
                  disabled={
                    game.submitting ||
                    !game.connected ||
                    !!game.result?.resolved ||
                    game.timeLeft <= 0
                  }
                  autoComplete="off"
                  maxLength={200}
                  className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
                  placeholder={
                    vi ? "Nhập từ tiếng Anh…" : "Enter the English word…"
                  }
                />
                <button
                  disabled={
                    game.submitting ||
                    !game.connected ||
                    !!game.result?.resolved ||
                    !game.answer.trim() ||
                    game.timeLeft <= 0
                  }
                  className="rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-40"
                >
                  {vi ? "Trả lời" : "Answer"}
                </button>
              </form>
              {game.result && (
                <div className="mt-5 rounded-xl bg-blue-50 p-4">
                  <strong>
                    {game.result.resolved
                      ? game.result.correctAnswer
                      : vi
                        ? "Chưa đúng, hãy thử lại!"
                        : "Incorrect, try again!"}
                  </strong>
                  {game.result.resolved && (
                    <>
                      <p className="mt-2 text-sm text-slate-600">
                        {game.result.explanation}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {game.result.example}
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>
          ))}
        {game.finished && (
          <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-3xl font-extrabold text-blue-600">
              {final?.isDraw
                ? vi
                  ? "Hòa!"
                  : "Draw!"
                : final?.winnerId === userId
                  ? vi
                    ? "Chiến thắng!"
                    : "Victory!"
                  : vi
                    ? "Thất bại"
                    : "Defeat"}
            </h2>
            <p className="mt-4 text-slate-500">
              {final?.finishReason === "TURN_TIMEOUT"
                ? vi
                  ? `Hết thời gian tìm từ${final.requiredLetter ? ` bắt đầu bằng ${final.requiredLetter.toUpperCase()}` : ""}.`
                  : `Time ran out${final.requiredLetter ? ` for a word beginning with ${final.requiredLetter.toUpperCase()}` : ""}.`
                : final?.finishReason === "PLAYER_LEFT"
                  ? vi
                    ? "Người chơi đã rời trận."
                    : "A player left the match."
                  : final?.finishReason === "DISCONNECT_TIMEOUT"
                    ? vi
                      ? "Quá thời gian chờ kết nối lại."
                      : "Reconnect grace period expired."
                    : ""}
            </p>
            {chain ? (
              <p className="mt-4 text-xl font-bold">
                {final?.turnCount ?? 0} {vi ? "từ đã nối" : "words connected"} ·{" "}
                {Math.floor(duration / 60)}m {duration % 60}s
              </p>
            ) : (
              <div className="mt-5 flex justify-center gap-8">
                {final?.players.map((p) => (
                  <p key={p.userId}>
                    <strong>
                      {
                        room?.players.find((u) => u.userId === p.userId)
                          ?.username
                      }
                    </strong>
                    <span className="mt-2 block text-3xl font-black">
                      {p.score}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <button
                disabled={busy || !game.connected}
                onClick={() =>
                  void action("friend:rematch-request").then((ok) => {
                    if (ok)
                      setNotice(
                        vi ? "Đã gửi lời mời tái đấu." : "Rematch requested.",
                      );
                  })
                }
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-40"
              >
                {vi ? "Tái đấu" : "Rematch"}
              </button>
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="rounded-xl border px-6 py-3 font-semibold"
              >
                Arena
              </button>
            </div>
          </section>
        )}
        {room?.status === "CANCELLED" && (
          <button
            onClick={() => router.push(`/${locale}/arena/friend`)}
            className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-white"
          >
            {vi ? "Mời người chơi khác" : "Invite another player"}
          </button>
        )}
      </div>
    </main>
  );
}
