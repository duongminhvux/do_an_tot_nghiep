"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { arenaAdminService as api } from "@/services/arena.service";
import {
  ArenaShell,
  Badge,
  DataTable,
  MatchesTable,
  Pager,
  Panel,
  QueryNotice,
  UserLink,
  button,
  control,
  primary,
  useArenaUI,
} from "./common";
export function ArenaMatchDetailPage() {
  const params = useParams();
  const id = String(params.matchId);
  const { t, date, locale, label } = useArenaUI();
  const [copy, setCopy] = useState("");
  const query = useQuery({
    queryKey: ["admin-arena", "match", id],
    queryFn: () => api.match(id),
    refetchInterval: 30000,
  });
  const data = query.data;
  return (
    <ArenaShell title="matches" refresh={() => void query.refetch()}>
      {!data ? (
        <QueryNotice query={query} />
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="break-all font-mono text-lg font-semibold">
                {data._id}
              </h2>
              <button
                className={button}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data._id);
                    setCopy(t("copied"));
                  } catch {
                    setCopy(t("copyError"));
                  }
                }}
              >
                {copy || t("copy")}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge value={data.type} />
              <Badge value={data.friendMode || data.questionMode} />
              <Badge value={data.status} />
            </div>
            <p className="mt-3 text-sm text-slate-500">{t("readOnly")}</p>
          </Panel>
          <Panel title={t("players")}>
            <DataTable
              rows={data.players}
              rowKey={(p) => p.userId}
              columns={[
                {
                  key: "user",
                  title: t("user"),
                  render: (p) => (
                    <div>
                      <UserLink id={p.userId} user={p.user} />
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        {p.userId}
                      </p>
                    </div>
                  ),
                },
                { key: "score", title: t("score"), render: (p) => p.score },
                {
                  key: "status",
                  title: t("status"),
                  render: (p) => <Badge value={p.status} />,
                },
                ...(data.type === "RANK"
                  ? (
                      ["ratingBefore", "ratingAfter", "ratingChange"] as const
                    ).map((key) => ({
                      key,
                      title: t(key),
                      render: (p: (typeof data.players)[number]) =>
                        p[key] ?? "—",
                    }))
                  : []),
                {
                  key: "joined",
                  title: t("joinedAt"),
                  render: (p) => date(p.createdAt),
                },
                {
                  key: "finished",
                  title: t("finishedAt"),
                  render: (p) => date(p.finishedAt),
                },
              ]}
            />
          </Panel>
          <Panel title={t("view")}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "winner",
                  data.isDraw
                    ? t("draw")
                    : data.players.find((p) => p.userId === data.winnerId)?.user
                        ?.username ||
                      data.winnerId ||
                      "—",
                ],
                ["finishReason", data.cancelReason || label(data.finishReason)],
                ["createdAt", date(data.createdAt)],
                ["startedAt", date(data.startedAt)],
                ["finishedAt", date(data.finishedAt)],
                [
                  "duration",
                  data.duration === null
                    ? "—"
                    : t("seconds", { count: data.duration }),
                ],
                ["roomCode", data.roomCodeSnapshot || "—"],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500">{t(key!)}</dt>
                  <dd className="mt-1 break-all font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {data.roomId && (
              <Link
                className="mt-4 inline-block text-sm text-blue-600 hover:underline"
                href={"/" + locale + "/arena/rooms/" + data.roomId}
              >
                {t("rooms")}
              </Link>
            )}
          </Panel>
          {(data.settingsSnapshot || data.runtimePolicy) && (
            <Panel title={t("runtimePolicy")}>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                {Object.entries({
                  ...data.settingsSnapshot,
                  ...data.runtimePolicy,
                }).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-slate-500">
                      {t(key, { defaultValue: key })}
                    </dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
          <Panel title={t("questions")}>
            {data.questions.length ? (
              <div className="space-y-3">
                {data.questions.map((question) => (
                  <details
                    key={question._id}
                    className="rounded-lg border border-slate-200"
                  >
                    <summary className="cursor-pointer p-4 text-sm font-medium">
                      {question.order}. {question.question}{" "}
                      <span className="ml-2 text-xs text-slate-400">
                        {label(question.type)}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 p-4">
                      <p className="text-sm text-emerald-700">
                        {t("correctAnswer")}: {question.correctAnswer}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("startedAt")}: {date(question.startedAt)} ·{" "}
                        {t("finishedAt")}: {date(question.resolvedAt)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t("winner")}:{" "}
                        <UserLink
                          id={question.winnerId}
                          user={
                            data.players.find(
                              (p) => p.userId === question.winnerId,
                            )?.user
                          }
                        />
                      </p>
                      <DataTable
                        rows={data.answers.filter(
                          (a) => a.matchQuestionId === question._id,
                        )}
                        rowKey={(a) => a._id}
                        columns={[
                          {
                            key: "user",
                            title: t("user"),
                            render: (a) => (
                              <UserLink
                                id={a.userId}
                                user={
                                  data.players.find(
                                    (p) => p.userId === a.userId,
                                  )?.user
                                }
                              />
                            ),
                          },
                          {
                            key: "answer",
                            title: t("answer"),
                            render: (a) => a.selectedAnswer || "—",
                          },
                          {
                            key: "result",
                            title: t("status"),
                            render: (a) =>
                              t(
                                a.timedOut
                                  ? "timedOut"
                                  : a.isCorrect
                                    ? "correct"
                                    : "wrong",
                              ),
                          },
                          {
                            key: "attempts",
                            title: t("attempts"),
                            render: (a) => a.attempts,
                          },
                          {
                            key: "time",
                            title: t("responseTime"),
                            render: (a) => a.responseTimeMs,
                          },
                          {
                            key: "date",
                            title: t("finishedAt"),
                            render: (a) => date(a.answeredAt),
                          },
                        ]}
                      />
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("noQuestionHistory")}</p>
            )}
          </Panel>
          {data.friendMode === "WORD_CHAIN" && (
            <Panel title={t("wordHistory")}>
              <p className="mb-4 text-xs text-slate-500">
                {t("wordHistoryHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {data.usedWords.map((word, index) => (
                  <span
                    key={index}
                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                  >
                    {index + 1}. {word}
                  </span>
                ))}
                {!data.usedWords.length && (
                  <p className="text-sm text-slate-500">{t("empty")}</p>
                )}
              </div>
            </Panel>
          )}
          {data.friendMode === "WORD_GUESS" && (
            <Panel title={t("guessHistory")}>
              <DataTable
                rows={data.wordGuessAttempts ?? []}
                rowKey={(a) =>
                  (data.wordGuessAttempts ?? []).indexOf(a).toString()
                }
                columns={[
                  {
                    key: "user",
                    title: t("user"),
                    render: (a) => (
                      <UserLink
                        id={a.userId}
                        user={
                          data.players.find((p) => p.userId === a.userId)?.user
                        }
                      />
                    ),
                  },
                  {
                    key: "word",
                    title: t("answer"),
                    render: (a) => (
                      <span className="font-mono tracking-widest">
                        {a.word}
                      </span>
                    ),
                  },
                  {
                    key: "result",
                    title: t("status"),
                    render: (a) => (
                      <span className="flex gap-1">
                        {a.feedback.map((status, index) => (
                          <span
                            key={index}
                            title={t("feedback." + status)}
                            aria-label={t("feedback." + status)}
                            className={
                              "inline-block size-4 rounded " +
                              (status === "correct"
                                ? "bg-emerald-400"
                                : status === "present"
                                  ? "bg-amber-300"
                                  : "bg-slate-300")
                            }
                          />
                        ))}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </ArenaShell>
  );
}
export function ArenaPlayerDetailPage() {
  const params = useParams();
  const id = String(params.userId);
  const { t, date, locale } = useArenaUI();
  const [page, setPage] = useState(1);
  const [ratingPage, setRatingPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-arena", "player", id],
    queryFn: () => api.player(id),
  });
  const history = useQuery({
    queryKey: ["admin-arena", "player-matches", id, page],
    queryFn: () => api.history(id, { page }),
  });
  const ratings = useQuery({
    queryKey: ["admin-arena", "rating-history", id, ratingPage],
    queryFn: () => api.ratings(id, { page: ratingPage }),
  });
  const data = query.data;
  return (
    <ArenaShell
      title="players"
      refresh={() => {
        void query.refetch();
        void history.refetch();
        void ratings.refetch();
      }}
    >
      {!data ? (
        <QueryNotice query={query} />
      ) : (
        <>
          <Panel title={t("account")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {data.user.username || data.user.email}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{data.user.email}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-400">
                  {id}
                </p>
                <p className="mt-3 text-sm">
                  {t(
                    data.user.isDeleted
                      ? "accountDeleted"
                      : data.user.isBanned
                        ? "accountBanned"
                        : "accountActive",
                  )}
                </p>
              </div>
              <Link className={button} href={"/" + locale + "/users/" + id}>
                {t("account")}
              </Link>
            </div>
          </Panel>
          <Panel title={t("players")}>
            {data.profile ? (
              <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
                {(
                  [
                    "rating",
                    "position",
                    "rankedMatches",
                    "rankedWins",
                    "rankedLosses",
                    "rankedDraws",
                    "winRate",
                    "currentWinStreak",
                    "bestWinStreak",
                  ] as const
                ).map((key) => (
                  <div key={key}>
                    <dt className="text-xs text-slate-500">{t(key)}</dt>
                    <dd className="mt-2 text-xl font-semibold text-slate-900">
                      {key === "winRate"
                        ? data.profile!.winRate.toFixed(1) + "%"
                        : (data.profile![key] ?? "—")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">{t("noProfile")}</p>
            )}
          </Panel>
          <Panel title={t("history")}>
            {!history.data ? (
              <QueryNotice query={history} />
            ) : (
              <>
                <MatchesTable rows={history.data.items} viewerId={id} />
                <Pager
                  page={page}
                  total={history.data.total}
                  onChange={setPage}
                />
              </>
            )}
          </Panel>
          <Panel title={t("ratingHistory")}>
            {!ratings.data ? (
              <QueryNotice query={ratings} />
            ) : (
              <>
                <DataTable
                  rows={ratings.data.items}
                  rowKey={(r) => r._id}
                  columns={[
                    {
                      key: "match",
                      title: t("matchId"),
                      render: (r) => (
                        <Link
                          className="font-mono text-xs text-blue-600 hover:underline"
                          href={"/" + locale + "/arena/matches/" + r.matchId}
                        >
                          {r.matchId}
                        </Link>
                      ),
                    },
                    {
                      key: "before",
                      title: t("ratingBefore"),
                      render: (r) => r.before,
                    },
                    {
                      key: "after",
                      title: t("ratingAfter"),
                      render: (r) => r.after,
                    },
                    {
                      key: "change",
                      title: t("ratingChange"),
                      render: (r) => (
                        <span
                          className={
                            r.change >= 0 ? "text-emerald-600" : "text-red-500"
                          }
                        >
                          {r.change > 0 ? "+" : ""}
                          {r.change}
                        </span>
                      ),
                    },
                    {
                      key: "date",
                      title: t("finishedAt"),
                      render: (r) => date(r.createdAt),
                    },
                  ]}
                />
                <Pager
                  page={ratingPage}
                  total={ratings.data.total}
                  onChange={setRatingPage}
                />
              </>
            )}
          </Panel>
        </>
      )}
    </ArenaShell>
  );
}
export function ArenaRoomDetailPage() {
  const params = useParams();
  const id = String(params.roomId);
  const router = useRouter();
  const client = useQueryClient();
  const { t, date, locale } = useArenaUI();
  const query = useQuery({
    queryKey: ["admin-arena", "room", id],
    queryFn: () => api.room(id),
    refetchInterval: 30000,
  });
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const close = useMutation({
    mutationFn: () => api.close(id, reason),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-arena"] });
      router.replace("/" + locale + "/arena/rooms");
    },
  });
  const data = query.data;
  return (
    <ArenaShell title="rooms" refresh={() => void query.refetch()}>
      {!data ? (
        <QueryNotice query={query} />
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-mono text-2xl font-bold">{data.code}</h2>
                <div className="mt-3 flex gap-2">
                  <Badge value={data.type} />
                  <Badge value={data.mode} />
                  <Badge value={data.status} />
                </div>
                {data.stale && (
                  <p className="mt-3 text-sm text-amber-600">{t("stale")}</p>
                )}
              </div>
              <div className="space-y-2">
                <button
                  className={button + " border-red-200! text-red-600!"}
                  disabled={data.status !== "WAITING" || !!data.currentMatchId}
                  onClick={() => {
                    setConfirm(true);
                    close.reset();
                    setReason("");
                  }}
                >
                  {t("closeRoom")}
                </button>
                <p className="max-w-64 text-xs text-slate-500">
                  {t("closeWaitingOnly")}
                </p>
              </div>
            </div>
          </Panel>
          <Panel title={t("view")}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">{t("host")}</dt>
                <dd className="mt-1">
                  <UserLink id={data.hostId} user={data.host} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("capacity")}</dt>
                <dd className="mt-1">
                  {data.players.length} / {data.maxPlayers}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("currentMatch")}</dt>
                <dd className="mt-1">
                  {data.currentMatchId ? (
                    <Link
                      className="break-all text-blue-600 hover:underline"
                      href={
                        "/" + locale + "/arena/matches/" + data.currentMatchId
                      }
                    >
                      {data.currentMatchId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("createdAt")}</dt>
                <dd className="mt-1">{date(data.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("lastUpdated")}</dt>
                <dd className="mt-1">{date(data.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title={t("members")}>
            <DataTable
              rows={data.players}
              rowKey={(p) => p.userId}
              columns={[
                {
                  key: "user",
                  title: t("user"),
                  render: (p) => <UserLink id={p.userId} user={p.user} />,
                },
                {
                  key: "role",
                  title: t("host"),
                  render: (p) => (p.userId === data.hostId ? t("host") : "—"),
                },
                {
                  key: "ready",
                  title: t("status"),
                  render: (p) => (
                    <span
                      className={
                        p.isReady ? "text-emerald-600" : "text-slate-500"
                      }
                    >
                      {t(p.isReady ? "ready" : "notReady")}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
          <Panel title={t("roomSettings")}>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              {Object.entries({ ...data.settings, ...data.runtimePolicy }).map(
                ([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-slate-500">
                      {t(key, { defaultValue: key })}
                    </dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ),
              )}
            </dl>
          </Panel>
          <Dialog
            open={confirm}
            onOpenChange={(value) => {
              if (!close.isPending) setConfirm(value);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("closeTitle")}</DialogTitle>
                <DialogDescription>{t("closeDescription")}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  close.mutate();
                }}
              >
                <label className="block space-y-2 text-sm">
                  <span>{t("reason")}</span>
                  <textarea
                    required
                    maxLength={500}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={control}
                  />
                </label>
                {close.isError && (
                  <p role="alert" className="text-sm text-red-600">
                    {t("closeError")}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={close.isPending}
                    className={button}
                    onClick={() => setConfirm(false)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    disabled={close.isPending || !reason.trim()}
                    type="submit"
                    className={primary}
                  >
                    {t(close.isPending ? "loading" : "confirm")}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </ArenaShell>
  );
}
