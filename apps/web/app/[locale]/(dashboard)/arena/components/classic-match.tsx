"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock3,
  Flag,
  Flame,
  Languages,
  Loader2,
  Send,
  Shield,
  Swords,
  Tag,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import type { useRankedMatch } from "../hooks/use-ranked-match";
import { friendlyRequest } from "@/lib/friendly-arena";
import { MatchExitDialog } from "./match-exit-dialog";
import { MatchResultView } from "./match-result-view";

export function ClassicMatch({
  game,
  friendly,
}: {
  game: ReturnType<typeof useRankedMatch>;
  friendly?: {
    opponent?: { username: string; avatarUrl?: string };
    leave: () => Promise<void>;
    backToRoom: () => void;
    busy: boolean;
    notice: string;
  };
}) {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params.locale === "string" ? params.locale : "vi";
  const matchId = typeof params.matchId === "string" ? params.matchId : "";
  const text = (vi: string, en: string) => (locale === "en" ? en : vi);
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?._id ? String(user._id) : "";
  const {
    matchStatus,
    currentQuestion,
    answer,
    setAnswer,
    timeLeft,
    result,
    history,
    score,
    opponentScore,
    streak,
    finished,
    finalResult,
    inputRef,
    connected,
    submitting,
    error,
    retryReady,
    retryAnswer,
    submitAnswer,
    opponent,
    myRating,
  } = game;
  const [leaving, setLeaving] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitError, setExitError] = useState("");

  const handleLeaveClick = () => {
    if (matchStatus === "PLAYING" && !finished) {
      setExitDialogOpen(true);
      return;
    }
    void executeLeave();
  };

  const executeLeave = async () => {
    if (friendly) return friendly.leave();
    setLeaving(true);
    setExitError("");
    try {
      await friendlyRequest("match:leave", { matchId });
      router.push(`/${locale}/arena`);
    } catch (e) {
      setExitError(e instanceof Error ? e.message : "Unable to leave match");
    } finally {
      setLeaving(false);
      setExitDialogOpen(false);
    }
  };

  const questionIndex = currentQuestion?.questionIndex ?? 0;

  const totalQuestions = currentQuestion?.totalQuestions ?? 10;

  const answerLength = currentQuestion?.answerLength ?? 0;

  const questionTime = currentQuestion?.timeLimit ?? 15;
  const roundEnded = !!result?.resolved;
  const shownLetters =
    roundEnded && result?.correctAnswer
      ? Array.from(result.correctAnswer)
      : (currentQuestion?.letters ?? []);

  const progress =
    questionTime > 0 ? Math.min(100, (timeLeft / questionTime) * 100) : 0;

  /* ======================================================
     WAITING PAGE
     ====================================================== */

  if (!finished && !currentQuestion) {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Swords className="size-8 animate-pulse" />
          </span>

          <h1 className="mt-5 text-xl font-extrabold text-slate-900">
            {error
              ? text("Chưa thể vào trận đấu", "Unable to join match")
              : !connected
                ? text("Đang kết nối tới trận đấu", "Connecting to match")
                : matchStatus === "PLAYING"
                  ? text("Đang nhận câu hỏi", "Loading question")
                  : text("Đang chờ đối thủ sẵn sàng", "Waiting for opponent")}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {text(
              "Trận đấu sẽ bắt đầu khi cả hai người chơi đã vào màn hình thi đấu.",
              "The match will start when both players are ready.",
            )}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {error && (
              <button
                type="button"
                onClick={retryReady}
                className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {text("Thử lại", "Retry")}
              </button>
            )}
            <Link
              href={`/${locale}/arena`}
              onClick={(event) => {
                if (matchStatus === "PLAYING") {
                  event.preventDefault();
                  void handleLeaveClick();
                }
              }}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
            >
              {text("Về đấu trường", "Back to Arena")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ======================================================
     FINISHED PAGE
     ====================================================== */

  if (finished && finalResult) {
    const me = finalResult.players.find(
      (player) => player.userId === currentUserId,
    );

    const opponentPlayer = finalResult.players.find(
      (player) => player.userId !== currentUserId,
    );

    const won = !finalResult.isDraw && finalResult.winnerId === currentUserId;

    return (
      <MatchResultView
        won={won}
        isDraw={finalResult.isDraw}
        finishReason={finalResult.finishReason}
        requiredLetter={finalResult.requiredLetter}
        myScore={me?.score ?? score}
        opponentScore={opponentPlayer?.score ?? opponentScore}
        myName={user?.username || text("Bạn", "You")}
        opponentName={
          friendly?.opponent?.username ||
          opponent?.username ||
          text("Đối thủ", "Opponent")
        }
        myAvatar={user?.avatarUrl}
        opponentAvatar={friendly?.opponent?.avatarUrl || opponent?.avatar}
        myRating={myRating}
        ratingChange={me?.ratingChange}
        ratingAfter={me?.ratingAfter}
        history={history}
        streak={streak}
        turnCount={totalQuestions}
        isFriendly={!!friendly}
        isWordChain={false}
        onBackToRoom={friendly?.backToRoom}
        resultNotice={friendly?.notice}
        onBackToArena={() => router.push(`/${locale}/arena`)}
        onFindNextMatch={
          !friendly
            ? () => router.push(`/${locale}/arena?autoRank=1`)
            : undefined
        }
        locale={locale}
      />
    );
  }

  /* ======================================================
     PLAYING PAGE
     ====================================================== */

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[900px] flex-col px-3 py-3 sm:px-5">
      {/* HEADER */}

      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={leaving || friendly?.busy}
          onClick={handleLeaveClick}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft className="size-4" />

          {text("Đấu trường", "Arena")}
        </button>

        <span className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">
          <Swords className="size-3" />

          {friendly
            ? text("Đấu bạn bè · Cổ điển", "Friendly · Classic")
            : text("Đấu xếp hạng", "Ranked")}
        </span>
      </div>
      {(exitError || friendly?.notice) && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {exitError || friendly?.notice}
        </p>
      )}

      {/* SCOREBOARD */}

      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white px-3 py-2.5 shadow-sm sm:px-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-100 to-violet-500" />

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
          <Player
            name={user?.username || text("Bạn", "You")}
            avatar={user?.avatarUrl}
            rating={friendly ? undefined : myRating}
            friendly={!!friendly}
            me
            text={text}
          />

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-xl font-extrabold tabular-nums sm:gap-3 sm:text-2xl">
              <span className="text-blue-600">{score.toLocaleString()}</span>

              <span className="text-sm font-medium text-slate-300">:</span>

              <span className="text-violet-600">
                {opponentScore.toLocaleString()}
              </span>
            </div>

            <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              {text("Điểm", "Score")}
            </p>
          </div>

          <Player
            name={
              friendly?.opponent?.username ||
              opponent?.username ||
              text("Đối thủ", "Opponent")
            }
            avatar={friendly?.opponent?.avatarUrl || opponent?.avatar}
            rating={friendly ? undefined : opponent?.rating}
            friendly={!!friendly}
            right
            text={text}
          />
        </div>
      </section>

      {/* ROUND INFO */}

      <div className="my-2 flex items-center justify-between gap-3">
        <span className="rounded-lg bg-blue-100/60 px-3 py-1.5 text-xs font-bold text-blue-700">
          {text("Vòng", "Round")} {questionIndex}/{totalQuestions}
        </span>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-xs font-semibold text-orange-500 sm:flex">
            <Flame className="size-3.5" />x{streak}
          </span>

          <span
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums",

              timeLeft <= 5
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600",
            )}
          >
            <Clock3 className="size-3.5" />
            {timeLeft}s
          </span>

          <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <Languages className="size-3.5 text-blue-500" />

            {text("Tiếng Việt", "Vietnamese")}
          </span>
        </div>
      </div>

      {/* GAME AREA */}

      <div className="grid flex-1 content-start grid-cols-[36px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-3">
        {/* PROGRESS */}

        <aside className="flex min-h-[300px] flex-col items-center rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50 to-white px-1 py-3">
          <Trophy className="size-4 text-amber-500" />

          <span className="mt-1 text-[9px] font-bold text-slate-500">
            {totalQuestions}
          </span>

          <div className="relative my-3 flex flex-1 flex-col-reverse items-center justify-between gap-5">
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-100" />

            {Array.from({
              length: totalQuestions,
            }).map((_, round) => {
              const answerResult = history[round];

              const active = round === questionIndex - 1;

              return (
                <span
                  key={round}
                  className={cn(
                    "relative z-10 flex size-4 items-center justify-center rounded-full border-2 text-[8px] font-bold",

                    answerResult === true
                      ? "border-emerald-400 bg-emerald-400 text-white"
                      : answerResult === false
                        ? "border-rose-300 bg-rose-300 text-white"
                        : active
                          ? "border-blue-500 bg-white text-blue-600 ring-4 ring-blue-100"
                          : "border-white bg-blue-200 text-white",
                  )}
                >
                  {answerResult === true ? (
                    <Check className="size-2.5" />
                  ) : answerResult === false ? (
                    <X className="size-2.5" />
                  ) : (
                    ""
                  )}
                </span>
              );
            })}
          </div>

          <Flag className="size-4 text-blue-500" />

          <span className="mt-1 text-[7px] font-bold uppercase text-blue-500">
            {text("Bắt đầu", "Start")}
          </span>
        </aside>

        {/* QUESTION CARD */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TIMER BAR */}

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={questionTime}
            aria-valuenow={timeLeft}
            className="h-1.5 bg-slate-100"
          >
            <div
              className={cn(
                "h-full transition-[width] duration-1000 ease-linear",

                timeLeft <= 5 ? "bg-rose-500" : "bg-amber-400",
              )}
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="p-3 sm:p-4">
            {/* VISUAL */}

            <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-blue-50 bg-gradient-to-br from-blue-50 via-slate-50 to-violet-50 sm:h-28">
              <span className="absolute left-3 top-3 rounded-md bg-white/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-400">
                {text("Nghĩa → Từ", "Meaning → Word")}
              </span>

              {currentQuestion?.image ? (
                <div className="relative h-full w-full">
                  <Image
                    src={currentQuestion.image}
                    alt={currentQuestion.meaning}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <span
                  role="img"
                  aria-label={currentQuestion?.meaning}
                  className="text-5xl drop-shadow-sm sm:text-6xl"
                >
                  {currentQuestion?.emoji ?? "🧠"}
                </span>
              )}
            </div>

            {/* LETTERS */}

            <div className="my-3 flex flex-wrap justify-center gap-1.5">
              {Array.from({
                length: answerLength,
              }).map((_, letter) => (
                <span
                  key={letter}
                  className={cn(
                    "flex h-8 w-6 items-center justify-center rounded-lg border text-sm font-bold uppercase sm:w-8",

                    roundEnded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : shownLetters[letter]
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : answer.trim()[letter]
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-blue-100 bg-blue-50/50 text-blue-300",
                  )}
                >
                  {shownLetters[letter] ??
                    Array.from(answer.trim())[letter] ??
                    ""}
                </span>
              ))}
            </div>

            {!roundEnded &&
              currentQuestion?.letters?.some((letter) => letter !== null) && (
                <p className="mb-2 text-center text-xs text-amber-600">
                  {text(
                    "Gợi ý tối đa 30% ký tự: đầu → cuối → giữa",
                    "Hints reveal up to 30%: first → last → middle",
                  )}
                </p>
              )}

            {/* MEANING */}

            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
              <Languages className="size-4 shrink-0 text-blue-500" />

              <span className="text-xs font-medium text-blue-600">
                {text("Bản dịch:", "Meaning:")}
              </span>

              <h1 className="text-sm font-bold text-blue-900 sm:text-base">
                {currentQuestion?.meaning}
              </h1>
            </div>

            {/* Server masks the answer in clues until the question is resolved. */}
            <div className="mt-2.5 space-y-2">
              <Hint
                icon={BookOpen}
                label={text("Giải thích", "Explanation")}
                color="text-amber-500"
              >
                {currentQuestion?.explanation ||
                  text("Chưa có giải thích", "No explanation available")}
              </Hint>
              <Hint
                icon={Languages}
                label={text("Ví dụ", "Example")}
                color="text-emerald-500"
              >
                <span className="font-medium italic text-slate-700">
                  {currentQuestion?.example
                    ? `“${currentQuestion.example}”`
                    : text("Chưa có ví dụ", "No example available")}
                </span>

                {currentQuestion?.translation && (
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {currentQuestion.translation}
                  </span>
                )}
              </Hint>
              <Hint
                icon={Tag}
                label={text("Loại từ", "Part of speech")}
                color="text-violet-500"
              >
                {currentQuestion?.type ||
                  text("Chưa có loại từ", "Part of speech unavailable")}
              </Hint>
            </div>

            {/* RESULT */}

            {result && (
              <div
                role="status"
                className={cn(
                  "mt-3 rounded-xl border px-3 py-2",

                  result.correct
                    ? "border-emerald-100 bg-emerald-50"
                    : "border-rose-100 bg-rose-50",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",

                    result.correct ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {result.correct
                    ? text(
                        `Chính xác! +${result.points} điểm`,
                        `Correct! +${result.points} points`,
                      )
                    : result.resolved && result.winnerId
                      ? text(
                          `Đối thủ đã đoán đúng! Đáp án: ${result.correctAnswer}`,
                          `Your opponent guessed correctly! Answer: ${result.correctAnswer}`,
                        )
                      : text(
                          `${result.timedOut ? "Hết giờ, chưa ai đoán đúng" : "Chưa chính xác, hãy thử lại"}${
                            result.correctAnswer
                              ? `. Đáp án: ${result.correctAnswer}`
                              : ""
                          }`,
                          `${result.timedOut ? "Time is up" : "Incorrect"}${
                            result.correctAnswer
                              ? `. Answer: ${result.correctAnswer}`
                              : ""
                          }`,
                        )}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600"
        >
          <span>{error}</span>
          {!connected && (
            <button
              type="button"
              onClick={retryReady}
              className="font-bold underline"
            >
              {text("Kết nối lại", "Reconnect")}
            </button>
          )}
          {connected && !submitting && !roundEnded && (
            <button
              type="button"
              onClick={retryAnswer}
              className="font-bold underline"
            >
              {text("Thử gửi lại", "Retry answer")}
            </button>
          )}
        </div>
      )}
      {roundEnded && (
        <p role="status" className="mt-2 text-center text-xs text-slate-400">
          {text(
            "Đang chờ câu tiếp theo từ máy chủ...",
            "Waiting for the next question...",
          )}
        </p>
      )}
      {/* ANSWER */}

      {!finished && (
        <footer className="sticky bottom-0 z-10 mt-3 border-t border-slate-200 bg-slate-50/95 py-2 backdrop-blur">
          <form
            onSubmit={(event) => {
              event.preventDefault();

              submitAnswer();
            }}
            className="flex gap-2 sm:gap-3"
          >
            <label htmlFor="ranked-answer" className="sr-only">
              {text("Nhập từ tiếng Anh", "Enter the English word")}
            </label>

            <input
              ref={inputRef}
              id="ranked-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={
                roundEnded ||
                submitting ||
                !connected ||
                timeLeft === 0 ||
                matchStatus !== "PLAYING"
              }
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              placeholder={text(
                "Nhập từ tiếng Anh...",
                "Enter the English word...",
              )}
              className="h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
            />

            <button
              type="submit"
              disabled={
                roundEnded ||
                submitting ||
                !connected ||
                !answer.trim() ||
                timeLeft === 0 ||
                matchStatus !== "PLAYING"
              }
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label={text("Gửi đáp án", "Submit answer")}
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
            </button>
          </form>

          <p className="mt-2 text-center text-[10px] text-slate-400">
            {text(
              "Nhập đáp án và nhấn Enter để gửi",
              "Type your answer and press Enter to submit",
            )}
          </p>
        </footer>
      )}

      <MatchExitDialog
        open={exitDialogOpen}
        onOpenChange={setExitDialogOpen}
        onConfirm={executeLeave}
        isLeaving={leaving || friendly?.busy}
        isRanked={!friendly}
        opponentName={friendly?.opponent?.username || opponent?.username}
        locale={locale}
      />
    </main>
  );
}

/* ======================================================
   PLAYER
   ====================================================== */

function Player({
  name,
  avatar,
  rating,
  friendly,
  me,
  right,
  text,
}: {
  name: string;
  avatar?: string;
  rating?: number;
  friendly?: boolean;
  me?: boolean;
  right?: boolean;
  text: (vi: string, en: string) => string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 sm:gap-3",
        right && "flex-row-reverse text-right",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 sm:size-11",

          right
            ? "bg-violet-50 text-violet-500 ring-violet-100"
            : "bg-blue-50 text-blue-500 ring-blue-100",
        )}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={44}
            height={44}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <UserRound className="size-5" />
        )}
      </span>

      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-800 sm:text-sm">
          {name}
        </p>

        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px] font-semibold sm:text-xs",

            right ? "justify-end text-violet-500" : "text-blue-500",
          )}
        >
          {friendly ? (
            text("Cổ điển · 1v1", "Classic · 1v1")
          ) : (
            <>
              <Shield className="size-3 shrink-0" />
              {rating === undefined ? "—" : rating.toLocaleString()}
              <span className="hidden sm:inline">Elo</span>
            </>
          )}

          {me && (
            <span className="ml-1 rounded bg-blue-50 px-1 text-[8px]">
              {text("BẠN", "YOU")}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ======================================================
   HINT
   ====================================================== */

function Hint({
  icon: Icon,
  label,
  color,
  children,
}: {
  icon: typeof BookOpen;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", color)} />

      <div className="text-xs leading-4 text-slate-500">
        <span className="mr-1 font-bold text-slate-700">{label}:</span>

        {children}
      </div>
    </div>
  );
}
