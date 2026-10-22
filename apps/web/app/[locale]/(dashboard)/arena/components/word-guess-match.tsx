"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Delete, Send, Sparkles, Trophy } from "lucide-react";
import { arenaSocket } from "@/lib/arena-socket";
import { friendlyRequest, type FriendSnapshot } from "@/lib/friendly-arena";
import { FriendlyAvatar } from "./friendly-avatar";
import { MatchExitDialog } from "./match-exit-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, surface } from "@/components/ui/page";

type Tile = "correct" | "present" | "absent";
type GuessState = {
  matchId: string;
  status: string;
  revision: number;
  maxAttempts: number;
  wordLength: number;
  attempts: { word: string; feedback: Tile[] }[];
  players: { userId: string; attempts: number; eliminated: boolean }[];
  answer?: string;
  winnerId: string | null;
  isDraw: boolean;
};
const tileStyle: Record<Tile, string> = {
  correct: "border-emerald-500 bg-emerald-500 text-white",
  present: "border-amber-400 bg-amber-400 text-slate-900",
  absent: "border-slate-500 bg-slate-500 text-white",
};

export function WordGuessMatch({
  matchId,
  userId,
  room,
  vi,
  leave,
  backToRoom,
}: {
  matchId: string;
  userId: string;
  room: FriendSnapshot;
  vi: boolean;
  leave: () => Promise<void>;
  backToRoom: () => Promise<void>;
}) {
  const text = (vn: string, en: string) => (vi ? vn : en);
  const [state, setState] = useState<GuessState | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(arenaSocket.connected);
  const [exitOpen, setExitOpen] = useState(false);
  const apply = useCallback((data: GuessState) => {
    setState((current) =>
      current &&
      (current.revision > data.revision ||
        (current.status === "FINISHED" && data.status !== "FINISHED"))
        ? current
        : data,
    );
  }, []);
  const load = useCallback(async () => {
    if (!arenaSocket.connected) return;
    try {
      apply(await friendlyRequest<GuessState>("word-guess:state", { matchId }));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Request failed");
    }
  }, [matchId, apply]);
  useEffect(() => {
    const update = (data: { matchId: string }) => {
      if (data.matchId === matchId) void load();
    };
    const reconnect = () => {
      setConnected(true);
      void load();
    };
    const disconnect = () => setConnected(false);
    arenaSocket.on("word-guess:update", update);
    arenaSocket.on("friend:match-finished", update);
    arenaSocket.on("arena:authenticated", reconnect);
    arenaSocket.on("disconnect", disconnect);
    void load();
    return () => {
      arenaSocket.off("word-guess:update", update);
      arenaSocket.off("friend:match-finished", update);
      arenaSocket.off("arena:authenticated", reconnect);
      arenaSocket.off("disconnect", disconnect);
    };
  }, [matchId, load]);
  const attempts = state?.attempts ?? [];
  const finished = state?.status === "FINISHED";
  const eliminated = state?.players.find(
    (p) => p.userId === userId,
  )?.eliminated;
  const locked =
    busy ||
    !connected ||
    !state ||
    state?.status !== "PLAYING" ||
    attempts.length >= 5 ||
    !!eliminated;
  const keyColors: Record<string, Tile> = {};
  const strength = { absent: 0, present: 1, correct: 2 };
  for (const attempt of attempts)
    for (let i = 0; i < 5; i++) {
      const letter = attempt.word[i]!.toUpperCase();
      const color = attempt.feedback[i]!;
      if (!keyColors[letter] || strength[color] > strength[keyColors[letter]!])
        keyColors[letter] = color;
    }
  const submit = async () => {
    if (locked || word.length !== 5) return;
    setBusy(true);
    setNotice("");
    try {
      apply(
        await friendlyRequest<GuessState>("word-guess:submit", {
          matchId,
          word,
        }),
      );
      setWord("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Request failed";
      const messages: Record<string, string> = {
        WORD_MUST_HAVE_FIVE_LETTERS: text(
          "Nhập đúng 5 chữ cái tiếng Anh.",
          "Enter exactly 5 English letters.",
        ),
        WORD_ALREADY_GUESSED: text(
          "Bạn đã đoán từ này. Hãy thử một từ khác.",
          "You already tried this word. Try another.",
        ),
        NO_GUESSES_LEFT: text(
          "Bạn đã dùng hết 5 lượt đoán.",
          "You have used all 5 guesses.",
        ),
        GAME_NOT_PLAYING: text(
          "Trận đấu đã kết thúc. Đang cập nhật kết quả…",
          "The match has ended. Updating results…",
        ),
        NOT_ACTIVE_PLAYER: text(
          "Bạn không còn tham gia lượt đoán trong trận này.",
          "You are no longer an active player.",
        ),
      };
      setNotice(messages[reason] ?? reason);
      void load();
    } finally {
      setBusy(false);
    }
  };
  const winner = room.players.find((p) => p.userId === state?.winnerId);
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-background px-3 py-6 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => (finished ? void leave() : setExitOpen(true))}
          >
            <ArrowLeft />
            {text("Đấu trường", "Arena")}
          </Button>
          <Badge tone="blue" className="px-3 py-1 text-sm">
            <Sparkles className="size-4" />
            {text("Đoán từ", "Word guess")}
          </Badge>
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className={cn(surface, "p-4 sm:p-6")}>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {text("5 chữ cái · 5 lượt đoán", "5 letters · 5 guesses")}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {text(
                  "Tìm từ tiếng Anh bí mật. Người đoán đúng trước chiến thắng!",
                  "Find the secret English word. First to solve wins!",
                )}
              </p>
            </div>
            {!connected && (
              <p
                role="status"
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              >
                {text("Đang kết nối lại…", "Reconnecting…")}
              </p>
            )}
            <div
              aria-label={text("Bảng đoán từ", "Word guessing board")}
              className="mx-auto grid w-full max-w-[340px] gap-2"
            >
              {Array.from({ length: 5 }, (_, row) => (
                <div key={row} className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }, (_, col) => {
                    const attempt = attempts[row];
                    const letter = (
                      attempt?.word[col] ??
                      (row === attempts.length && !finished ? word[col] : "") ??
                      ""
                    ).toUpperCase();
                    const color = attempt?.feedback[col];
                    const label = color
                      ? {
                          correct: text("đúng vị trí", "correct position"),
                          present: text("sai vị trí", "wrong position"),
                          absent: text("không có", "absent"),
                        }[color]
                      : text("chưa đoán", "not guessed");
                    return (
                      <div
                        key={col}
                        aria-label={`${text("Lượt", "Guess")} ${row + 1}, ${col + 1}: ${letter || "—"}, ${label}`}
                        className={`flex aspect-square items-center justify-center rounded-lg border-2 text-2xl font-bold uppercase transition-colors ${color ? tileStyle[color] : letter ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p
              aria-live="polite"
              className="my-4 text-center text-sm font-semibold text-slate-500"
            >
              {attempts.length}/5 {text("lượt đã dùng", "guesses used")}
            </p>
            <div className="mb-5 flex flex-wrap justify-center gap-3 text-xs text-slate-600">
              {(
                [
                  ["correct", text("Đúng vị trí", "Correct position")],
                  ["present", text("Sai vị trí", "Wrong position")],
                  ["absent", text("Không có", "Absent")],
                ] as const
              ).map(([color, label]) => (
                <span key={color} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded-sm ${tileStyle[color]}`} />
                  {label}
                </span>
              ))}
            </div>
            {notice && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              >
                {notice}
              </p>
            )}
            {finished ? (
              <div
                role="status"
                className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-center"
              >
                <Trophy className="mx-auto mb-2 size-8 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  {state.isDraw
                    ? text(
                        "Hòa! Chưa ai tìm ra từ bí mật.",
                        "Draw! Nobody found the secret word.",
                      )
                    : state.winnerId === userId
                      ? text("Bạn đã chiến thắng!", "You won!")
                      : `${winner?.username ?? text("Người chơi khác", "Another player")} ${text("đã chiến thắng!", "won!")}`}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {text("Đáp án", "Answer")}:{" "}
                  <strong className="text-xl uppercase tracking-[0.15em] text-blue-700">
                    {state.answer}
                  </strong>
                </p>
                <Button
                  size="lg"
                  className="mt-4"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await backToRoom();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {text("Trở về phòng", "Return to room")}
                </Button>
              </div>
            ) : (
              <>
                <form
                  className="mb-5 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <input
                    aria-label={text("Từ gồm 5 chữ cái", "Five-letter guess")}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={5}
                    value={word}
                    disabled={locked}
                    onChange={(event) =>
                      setWord(
                        event.target.value
                          .replace(/[^a-z]/gi, "")
                          .toUpperCase(),
                      )
                    }
                    placeholder={text("Nhập 5 chữ cái", "Enter 5 letters")}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 font-bold uppercase tracking-widest shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
                  />
                  <Button
                    size="icon"
                    aria-label={text("Gửi đáp án", "Submit guess")}
                    disabled={locked || word.length !== 5}
                    className="size-11"
                  >
                    <Send />
                  </Button>
                </form>
                {(attempts.length >= 5 || eliminated) && (
                  <p
                    role="status"
                    className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800"
                  >
                    {text(
                      "Bạn đã hết lượt. Chờ những người còn lại hoàn thành.",
                      "You have no guesses left. Waiting for the other players.",
                    )}
                  </p>
                )}
                <div
                  aria-label={text("Bàn phím", "Keyboard")}
                  className="space-y-1.5"
                >
                  {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row, i) => (
                    <div key={row} className="flex justify-center gap-1">
                      {i === 2 && (
                        <button
                          disabled={locked || word.length !== 5}
                          onClick={() => void submit()}
                          className="cursor-pointer rounded-lg bg-primary px-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ENTER
                        </button>
                      )}
                      {Array.from(row).map((letter) => (
                        <button
                          key={letter}
                          disabled={locked || word.length >= 5}
                          onClick={() => setWord((value) => value + letter)}
                          className={`h-11 min-w-0 flex-1 cursor-pointer rounded-lg text-xs font-bold transition-colors sm:text-sm ${keyColors[letter] ? tileStyle[keyColors[letter]!] : "bg-slate-100 text-slate-700 hover:bg-slate-200"} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {letter}
                        </button>
                      ))}
                      {i === 2 && (
                        <button
                          aria-label={text("Xóa chữ", "Delete letter")}
                          disabled={locked || !word}
                          onClick={() => setWord((value) => value.slice(0, -1))}
                          className="cursor-pointer rounded-lg bg-slate-200 px-2 text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Delete className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <aside className={cn(surface, "p-5")}>
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {text("Người chơi trong phòng", "Room players")}
            </h2>
            <div className="space-y-3">
              {room.players.map((player) => {
                const progress = state?.players.find(
                  (p) => p.userId === player.userId,
                );
                return (
                  <div
                    key={player.userId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded-full">
                      <FriendlyAvatar
                        avatar={player.avatarUrl}
                        name={player.username}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-semibold text-slate-900">
                        {player.username}
                        {player.userId === userId
                          ? text(" (Bạn)", " (You)")
                          : ""}
                      </strong>
                      <p className="text-xs text-slate-500">
                        {player.userId === state?.winnerId
                          ? text("Chiến thắng", "Winner")
                          : progress?.eliminated
                            ? text("Đã rời trận", "Left the match")
                            : `${progress?.attempts ?? 0}/5 ${text("lượt đoán", "guesses")}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              {text(
                "Mỗi người có 5 lượt riêng. Các lượt đoán của bạn được giữ riêng tư. Trò chơi không thay đổi Elo.",
                "Each player gets 5 guesses. Your guesses stay private. No Elo changes.",
              )}
            </p>
          </aside>
        </div>
      </div>
      <MatchExitDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={leave}
        locale={vi ? "vi" : "en"}
      />
    </main>
  );
}
