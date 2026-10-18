"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  Clock3,
  Info,
  LogOut,
  Send,
  Volume2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { arenaSocket } from "@/lib/arena-socket";
import {
  friendlyRequest,
  type FriendSnapshot,
  type FriendMode,
  type FriendRoomSnapshot,
} from "@/lib/friendly-arena";
import { useRankedMatch } from "../../hooks/use-ranked-match";
import { useMatchExit } from "../../hooks/use-match-exit";
import { FriendlyAvatar } from "../../components/friendly-avatar";
import { RoomStandings } from "../../components/room-standings";
import { WordGuessMatch } from "../../components/word-guess-match";
import { ClassicMatch } from "../../components/classic-match";
import { MatchExitDialog } from "../../components/match-exit-dialog";
import { MatchResultView } from "../../components/match-result-view";

type Turn = {
  matchId: string;
  currentTurnUserId: string;
  previousWord: string;
  requiredLetter: string;
  turnDeadline: string;
  turnCount: number;
  usedWords: string[];
  serverNow: string;
  seconds: number;
  eliminatedUserIds?: string[];
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
  const historyEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    historyEnd.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [turn?.turnCount]);
  useMatchExit(
    matchId,
    room?.status === "PLAYING" || game.finished,
    [
      `/${locale}/arena/friend/room/${room?.code || ""}`,
      `/${locale}/arena/group/room/${room?.code || ""}`,
    ],
    true,
  );
  useEffect(() => {
    if (room?.status === "WAITING") {
      router.replace(
        `/${locale}/arena/${room.type === "ROOM" ? "group" : "friend"}/room/${room.code || ""}`,
      );
    }
  }, [room?.status, matchId, locale, router]);
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
          ? "Từ phải bắt đầu bằng chữ cái được yêu cầu."
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
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const handleLeaveClick = () => {
    if (room?.status === "PLAYING" && !game.finished) {
      setExitDialogOpen(true);
      return;
    }
    void executeLeave();
  };

  const executeLeave = async () => {
    setExitDialogOpen(false);
    if (!room || room.status === "CANCELLED" || (await action("friend:leave")))
      router.push(`/${locale}/arena`);
  };
  const backToRoom = async () => {
    setBusy(true);
    try {
      const latest = await friendlyRequest<FriendRoomSnapshot>(
        "friend-room:join",
        { roomId: room?.roomId },
      );
      router.push(
        `/${locale}/arena/${latest.maxPlayers > 2 ? "group" : "friend"}/room/${latest.code}`,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        /ROOM_NOT_FOUND|ROOM_CLOSED|NOT_ROOM_GUEST/.test(error.message)
      )
        router.replace(
          `/${locale}/arena?roomType=${room?.type === "ROOM" ? "ROOM" : "FRIEND"}&roomError=ROOM_NOT_FOUND`,
        );
      else setNotice(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const multiplayer = room?.type === "ROOM";
  const standings =
    room?.players.map((p) => ({
      ...p,
      eliminated: p.eliminated || turn?.eliminatedUserIds?.includes(p.userId),
      score:
        game.finalResult?.players.find((f) => f.userId === p.userId)?.score ??
        p.score,
    })) ?? [];
  const currentPlayer = room?.players.find(
    (p) => p.userId === turn?.currentTurnUserId,
  );
  const host = room?.hostId === userId;
  const me = room?.players.find((p) => p.userId === userId);
  const opponent = room?.players.find((p) => p.userId !== userId);
  const chain = room?.mode === "WORD_CHAIN";
  const myTurn = turn?.currentTurnUserId === userId;
  const disconnected = multiplayer
    ? currentPlayer?.disconnectedAt
    : opponent?.disconnectedAt;
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
  const usedWords = game.finalResult?.usedWords ?? turn?.usedWords ?? [];
  const requiredPrefix = turn?.previousWord.slice(-1).toUpperCase() || "";
  const inputDisabled =
    !myTurn ||
    busy ||
    !game.connected ||
    seconds <= 0 ||
    !!disconnected ||
    !turn;
  const submitWord = () => {
    if (inputDisabled || !word.trim()) return;
    const normalized = word.trim().toLowerCase();
    if (!/^[a-z]{2,80}$/.test(normalized)) {
      setNotice(
        vi
          ? "Nhập một từ tiếng Anh có ít nhất hai chữ cái."
          : "Enter an English word with at least two letters.",
      );
      return;
    }
    if (
      requiredPrefix &&
      !normalized.startsWith(requiredPrefix.toLowerCase())
    ) {
      setNotice(
        vi
          ? `Từ phải bắt đầu bằng chữ cái ${requiredPrefix}.`
          : `Start with the letter ${requiredPrefix}.`,
      );
      return;
    }
    void action("word-chain:submit", { word: normalized });
  };
  const speakWord = () => {
    if (!turn?.previousWord || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(turn.previousWord);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };
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
  if (room?.mode === "WORD_GUESS")
    return (
      <WordGuessMatch
        matchId={matchId}
        userId={userId}
        room={room}
        vi={vi}
        leave={executeLeave}
        backToRoom={backToRoom}
      />
    );
  if (
    room?.mode === "CLASSIC" &&
    (room.status === "PLAYING" || game.finished)
  ) {
    return (
      <ClassicMatch
        game={game}
        friendly={{
          opponent,
          players: multiplayer ? standings : undefined,
          leave: executeLeave,
          busy,
          notice:
            disconnected && !game.finished
              ? `${opponent?.username}: ${vi ? "Mất kết nối, chờ kết nối lại" : "Waiting for reconnection"} · ${grace}s`
              : notice,
          backToRoom: () => void backToRoom(),
        }}
      />
    );
  }

  if (game.finished && final) {
    return (
      <MatchResultView
        standings={multiplayer ? standings : undefined}
        winnerId={final.winnerId}
        currentUserId={userId}
        won={!final.isDraw && final.winnerId === userId}
        isDraw={final.isDraw}
        finishReason={final.finishReason}
        requiredLetter={final.requiredLetter}
        myScore={me?.score ?? (chain ? (final.turnCount ?? 0) : 0)}
        opponentScore={opponent?.score ?? 0}
        myName={user?.username || (vi ? "Bạn" : "You")}
        opponentName={opponent?.username || (vi ? "Đối thủ" : "Opponent")}
        myAvatar={user?.avatarUrl}
        opponentAvatar={opponent?.avatarUrl}
        turnCount={final.turnCount}
        durationSeconds={duration}
        isFriendly={true}
        isWordChain={chain}
        onBackToRoom={() => void backToRoom()}
        resultNotice={notice}
        onBackToArena={() => void executeLeave()}
        locale={locale}
      />
    );
  }
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[radial-gradient(ellipse_at_top,#e6efff_0%,#f5f8ff_70%)] px-3 py-4 text-[#11163f] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeaveClick}
              disabled={busy}
              aria-label={vi ? "Quay lại" : "Go back"}
              className="rounded-xl bg-white p-2.5 text-slate-500 shadow-sm disabled:opacity-40"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold">
                {vi ? "Đấu với bạn bè" : "Friendly duel"}
              </h1>
              <p className="text-sm text-slate-500">
                {chain
                  ? vi
                    ? "Nối từ · chữ cái cuối"
                    : "Word chain · last letter"
                  : vi
                    ? "Cổ điển · 1v1"
                    : "Classic · 1v1"}
              </p>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={handleLeaveClick}
            className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-40"
          >
            <LogOut className="size-4" />
            {vi ? "Rời trận" : "Leave match"}
          </button>
        </header>
        {multiplayer &&
          turn?.eliminatedUserIds?.includes(userId) &&
          !game.finished && (
            <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4">
              {vi
                ? "Bạn đã bị loại. Bạn có thể theo dõi đến hết trận hoặc rời phòng."
                : "You have been eliminated. You can watch the rest of the match or leave."}
            </p>
          )}
        <div
          className={`grid gap-4 ${chain ? "lg:grid-cols-[minmax(0,2.2fr)_minmax(280px,1fr)]" : ""}`}
        >
          <div className="min-w-0">
            {multiplayer ? (
              <RoomStandings
                players={standings}
                currentUserId={userId}
                currentTurnUserId={turn?.currentTurnUserId}
                vi={vi}
              />
            ) : (
              <section className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] sm:gap-4">
                {[me, opponent].map((p, i) => (
                  <div
                    key={i}
                    className={`${i === 1 ? "col-start-3 row-start-1" : ""} flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-white bg-white/70 p-3 shadow-[0_8px_30px_#c4d8ff20] sm:flex-row sm:p-4`}
                  >
                    <div
                      className={`relative shrink-0 rounded-full p-1 ${i === 0 ? "ring-2 ring-blue-500" : "ring-2 ring-white"}`}
                    >
                      <div className="size-14 overflow-hidden rounded-full sm:size-18">
                        <FriendlyAvatar
                          avatar={p?.avatarUrl}
                          name={p?.username || (vi ? "Người chơi" : "Player")}
                        />
                      </div>
                      <span
                        aria-label={
                          p?.disconnectedAt || !p
                            ? vi
                              ? "Ngoại tuyến"
                              : "Offline"
                            : vi
                              ? "Trực tuyến"
                              : "Online"
                        }
                        className={`absolute bottom-0 right-0 size-4 rounded-full border-2 border-white ${p?.disconnectedAt || !p ? "bg-slate-300" : "bg-emerald-400"}`}
                      />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <strong className="block truncate text-sm sm:text-base">
                        {p?.username || "…"}
                      </strong>
                      <span
                        className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${i === 0 ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-500"}`}
                      >
                        {i === 0
                          ? vi
                            ? "Bạn"
                            : "You"
                          : vi
                            ? "Đối thủ"
                            : "Opponent"}
                      </span>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {room?.status === "WAITING"
                          ? p?.userId === room.hostId
                            ? vi
                              ? "Chủ phòng"
                              : "Host"
                            : p?.isReady
                              ? vi
                                ? "Sẵn sàng"
                                : "Ready"
                              : vi
                                ? "Chưa sẵn sàng"
                                : "Not ready"
                          : chain
                            ? `${usedWords.filter((_, index) => (index % 2 === 0 ? room?.hostId : room?.players.find((player) => player.userId !== room.hostId)?.userId) === p?.userId).length} ${vi ? "từ đã nối" : "words played"}`
                            : `${p?.score ?? 0} ${vi ? "điểm" : "points"}`}
                      </p>
                    </div>
                  </div>
                ))}
                <span className="col-start-2 row-start-1 bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 bg-clip-text text-center text-3xl font-black italic text-transparent drop-shadow-sm sm:text-6xl">
                  VS
                </span>
              </section>
            )}
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
                <button
                  onClick={game.retryReady}
                  className="mt-4 text-blue-600"
                >
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
                        {mode === "CLASSIC"
                          ? vi
                            ? "Cổ điển"
                            : "Classic"
                          : vi
                            ? "Nối từ"
                            : "Word Chain"}
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
                    (host
                      ? !opponent?.isReady || !!disconnected
                      : !!me?.isReady)
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
                <section className="relative mt-4 overflow-hidden rounded-2xl border border-white bg-gradient-to-b from-blue-100/70 via-white/80 to-white/95 px-4 py-6 shadow-[0_8px_30px_#c4d8ff20] sm:px-8">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 800 360"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-x-0 top-8 h-72 w-full text-blue-200/40"
                  >
                    <path
                      fill="currentColor"
                      opacity=".6"
                      d="M0 170 80 30 120 20 220 175 300 130 400 220 580 100 670 20 710 35 800 150V360H0Z"
                    />
                    <path
                      fill="currentColor"
                      d="M0 270 80 230 200 285 380 235 500 285 690 210 800 250V360H0Z"
                    />
                    {[20, 55, 100, 650, 700, 745, 780].map((x, i) => (
                      <path
                        key={x}
                        fill="currentColor"
                        d={`M${x} ${170 + (i % 3) * 18}l-18 60h10l-17 35h19v20h12v-20h19l-17-35h10Z`}
                      />
                    ))}
                  </svg>
                  <div className="relative text-center">
                    <span className="rounded-lg bg-blue-100/80 px-3 py-1 text-xs text-slate-500">
                      {vi ? "Từ vừa rồi" : "Previous word"}
                    </span>
                    <div className="relative mx-auto mt-2 flex min-h-16 max-w-sm items-center justify-center rounded-xl bg-white/85 px-12 py-3">
                      <h2 className="break-all text-3xl font-black">
                        {turn?.previousWord.toUpperCase() ||
                          (vi ? "Bạn bắt đầu!" : "First word!")}
                      </h2>
                      <button
                        type="button"
                        onClick={speakWord}
                        disabled={!turn?.previousWord}
                        aria-label={vi ? "Nghe phát âm" : "Hear pronunciation"}
                        className="absolute right-4 rounded-lg p-2 text-slate-500 hover:bg-blue-50 disabled:opacity-30"
                      >
                        <Volume2 className="size-4" />
                      </button>
                    </div>
                    <ArrowDown className="mx-auto my-3 size-7 text-blue-600" />
                    <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {vi ? "Chữ cái tiếp theo" : "Next letter"}
                    </span>
                    <div className="mx-auto mt-2 flex size-24 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50/90 text-4xl font-black text-emerald-600">
                      {requiredPrefix || "?"}
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {requiredPrefix ? (
                        <>
                          {vi
                            ? "Từ tiếp theo phải bắt đầu bằng"
                            : "The next word must start with"}{" "}
                          <strong className="text-emerald-600">
                            {requiredPrefix}
                          </strong>
                        </>
                      ) : vi ? (
                        "Chủ phòng nhập từ đầu tiên có ít nhất 2 chữ cái"
                      ) : (
                        "The host enters the first word with at least 2 letters"
                      )}
                    </p>
                    <div className="mx-auto mt-6 flex max-w-xl flex-col-reverse items-center gap-5 sm:flex-row">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitWord();
                        }}
                        className="w-full min-w-0 flex-1"
                      >
                        <input
                          aria-label={vi ? "Nhập từ tiếng Anh" : "English word"}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={word}
                          onChange={(e) => setWord(e.target.value)}
                          disabled={inputDisabled}
                          placeholder={
                            vi ? "Nhập từ tiếng Anh…" : "Enter an English word…"
                          }
                          maxLength={80}
                          className="h-14 w-full rounded-xl border-2 border-blue-500 bg-white/90 px-4 text-base outline-none focus:ring-4 focus:ring-blue-100 disabled:border-blue-200 disabled:bg-white/60"
                        />
                        <button
                          disabled={inputDisabled || !word.trim()}
                          className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40"
                        >
                          <Send className="size-5" />
                          {busy
                            ? vi
                              ? "Đang gửi…"
                              : "Sending…"
                            : vi
                              ? "Gửi từ"
                              : "Send word"}
                        </button>
                      </form>
                      <div
                        role="timer"
                        aria-label={
                          vi
                            ? `${seconds} giây còn lại`
                            : `${seconds} seconds remaining`
                        }
                        className="relative size-28 shrink-0"
                      >
                        <svg
                          viewBox="0 0 100 100"
                          className={`size-full -rotate-90 ${seconds <= 5 ? "text-rose-500" : "text-emerald-500"}`}
                          aria-hidden="true"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="43"
                            fill="white"
                            stroke="#d1fae5"
                            strokeWidth="7"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="43"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="7"
                            strokeDasharray="270.18"
                            strokeDashoffset={
                              270.18 *
                              (1 - Math.min(seconds / (turn?.seconds ?? 20), 1))
                            }
                            className="transition-all duration-300"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <strong className="text-3xl font-black tabular-nums">
                            {seconds}
                          </strong>
                          <span className="text-xs text-slate-500">
                            {vi ? "giây" : "seconds"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mx-auto mt-4 flex max-w-xl items-center gap-4 rounded-xl bg-blue-50/90 px-4 py-3 text-left text-xs leading-5 text-slate-500">
                      <Info className="size-5 shrink-0 text-blue-600" />
                      <ul className="list-disc pl-4">
                        <li>
                          {vi
                            ? "Bắt đầu bằng đúng chữ cái cuối của từ trước"
                            : "Start with the last letter of the previous word"}
                        </li>
                        <li>
                          {vi
                            ? "Từ phải có trong từ điển và có ít nhất 2 chữ cái"
                            : "Use a dictionary word of at least 2 letters"}
                        </li>
                        <li>
                          {vi
                            ? "Không được trùng từ đã dùng"
                            : "Do not repeat a word"}
                        </li>
                        <li>
                          {vi
                            ? "Nhập sai vẫn được thử lại nếu còn thời gian"
                            : "Retry incorrect words while time remains"}
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>
              ) : null)}
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
                    {final?.turnCount ?? 0}{" "}
                    {vi ? "từ đã nối" : "words connected"} ·{" "}
                    {Math.floor(duration / 60)}
                    {vi ? " phút " : "m "}
                    {duration % 60}
                    {vi ? " giây" : "s"}
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
                    onClick={() =>
                      router.push(
                        `/${locale}/arena/friend/room/${room?.code || ""}`,
                      )
                    }
                    className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-40"
                  >
                    {vi ? "Trở về phòng" : "Back to room"}
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/arena`)}
                    className="rounded-xl border px-6 py-3 font-semibold"
                  >
                    {vi ? "Đấu trường" : "Arena"}
                  </button>
                </div>
              </section>
            )}
            {room?.status === "CANCELLED" && (
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-white"
              >
                {vi ? "Mời người chơi khác" : "Invite another player"}
              </button>
            )}
          </div>
          {chain && (
            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-2xl border border-white bg-white/80 p-4 shadow-[0_8px_30px_#c4d8ff20]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <ChartNoAxesColumnIncreasing className="size-5 text-blue-600" />
                    {vi ? "Lịch sử nối từ" : "Word history"}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {usedWords.length} {vi ? "từ" : "words"}
                  </span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {usedWords.length === 0 && (
                    <p className="py-10 text-center text-sm text-slate-400">
                      {vi ? "Chưa có từ nào được nối" : "No words played yet"}
                    </p>
                  )}
                  <ol className="space-y-1">
                    {usedWords.map((entry, index) => {
                      const playerId =
                        index % 2 === 0
                          ? room?.hostId
                          : room?.players.find((p) => p.userId !== room.hostId)
                              ?.userId;
                      const player = room?.players.find(
                        (p) => p.userId === playerId,
                      );
                      const mine = playerId === userId;
                      return (
                        <li
                          key={`${index}-${entry}`}
                          className={`flex items-center gap-2 rounded-xl px-2 py-2.5 ${index === usedWords.length - 1 ? "bg-blue-50" : "border-b border-slate-100"}`}
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${mine ? "bg-blue-50 text-blue-500" : "bg-rose-50 text-rose-500"}`}
                          >
                            {index + 1}
                          </span>
                          <ArrowRight
                            className={`size-3 shrink-0 ${mine ? "text-blue-400" : "text-rose-300"}`}
                          />
                          <div
                            title={player?.username}
                            className="size-7 shrink-0 overflow-hidden rounded-full"
                          >
                            <FriendlyAvatar
                              avatar={player?.avatarUrl}
                              name={
                                player?.username ||
                                (vi ? "Người chơi" : "Player")
                              }
                            />
                          </div>
                          <ArrowRight
                            className={`size-3 shrink-0 ${mine ? "text-blue-400" : "text-rose-300"}`}
                          />
                          <span className="min-w-0 break-all text-xs font-bold uppercase">
                            {entry}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div ref={historyEnd} />
                </div>
              </section>
              <section
                aria-live="polite"
                className="rounded-2xl border border-white bg-white/80 p-5"
              >
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Clock3 className="size-5 text-slate-500" />
                  {game.finished
                    ? vi
                      ? "Trận đấu đã kết thúc"
                      : "Match finished"
                    : room?.status === "WAITING"
                      ? vi
                        ? "Đang chờ bắt đầu…"
                        : "Waiting to start…"
                      : myTurn
                        ? vi
                          ? "Đến lượt bạn!"
                          : "Your turn!"
                        : vi
                          ? "Đang chờ đối thủ…"
                          : "Waiting for opponent…"}
                </h2>
                <div className="mt-5 flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-full">
                    <FriendlyAvatar
                      avatar={
                        (multiplayer ? currentPlayer : myTurn ? me : opponent)
                          ?.avatarUrl
                      }
                      name={
                        (multiplayer ? currentPlayer : myTurn ? me : opponent)
                          ?.username || (vi ? "Người chơi" : "Player")
                      }
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {(multiplayer ? currentPlayer : myTurn ? me : opponent)
                        ?.username || "…"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {game.finished
                        ? vi
                          ? "Xem kết quả hoặc trở về phòng."
                          : "View results or return to the room."
                        : myTurn
                          ? vi
                            ? `Bạn có ${turn?.seconds ?? 20} giây để tìm từ hợp lệ.`
                            : `You have ${turn?.seconds ?? 20} seconds to find a valid word.`
                          : vi
                            ? "Vui lòng đợi đối thủ hoàn thành lượt."
                            : "Please wait for your opponent to finish their turn."}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          )}
        </div>
      </div>
      <MatchExitDialog
        open={exitDialogOpen}
        onOpenChange={setExitDialogOpen}
        onConfirm={executeLeave}
        isLeaving={busy}
        isRanked={false}
        opponentName={opponent?.username}
        locale={locale}
      />
    </main>
  );
}
