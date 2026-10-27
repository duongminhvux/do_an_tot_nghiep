"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  arenaAdminService as api,
  type ArenaParams,
} from "@/services/arena.service";
import {
  ArenaShell,
  Badge,
  DataTable,
  Filters,
  MatchesTable,
  Pager,
  Panel,
  QueryNotice,
  UserLink,
  matchFilters,
  useArenaUI,
} from "./common";
export function ArenaDashboardPage() {
  const { t, label } = useArenaUI();
  const [days, setDays] = useState(7);
  const query = useQuery({
    queryKey: ["admin-arena", "dashboard", days],
    queryFn: () => api.dashboard(days),
    refetchInterval: 30000,
  });
  return (
    <ArenaShell title="dashboard" refresh={() => void query.refetch()}>
      {!query.data ? (
        <QueryNotice query={query} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {(
              [
                "matchesToday",
                "rankedToday",
                "friendlyToday",
                "groupToday",
                "activeMatches",
                "onlineArenaUsers",
                "waitingRooms",
                "cancelledToday",
              ] as const
            ).map((key) => (
              <section
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-xs font-medium text-slate-500">{t(key)}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {query.data[key] ?? "—"}
                </p>
              </section>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {t("timeZone")} {t("realtime")}
            </p>
            <div className="flex gap-1">
              {[7, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setDays(n)}
                  aria-pressed={days === n}
                  className={
                    "rounded-lg px-3 py-2 text-sm " +
                    (days === n
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-500")
                  }
                >
                  {t("days", { count: n })}
                </button>
              ))}
            </div>
          </div>
          <Panel title={t("daily")}>
            <div className="min-w-0 max-w-full overflow-x-auto">
              <div
                className="flex h-48 min-w-full items-end gap-2"
                style={{ minWidth: days * 26 }}
              >
                {Array.from({ length: days }, (_, index) => {
                  const today = new Date(Date.now() + 7 * 3600000);
                  const day = new Date(
                    Date.UTC(
                      today.getUTCFullYear(),
                      today.getUTCMonth(),
                      today.getUTCDate(),
                    ) -
                      (days - 1 - index) * 86400000,
                  )
                    .toISOString()
                    .slice(0, 10);
                  const count =
                    query.data.daily.find((row) => row._id === day)?.count ?? 0;
                  const maximum = Math.max(
                    1,
                    ...query.data.daily.map((row) => row.count),
                  );
                  return (
                    <div
                      key={day}
                      className="flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1"
                      title={day + ": " + count}
                    >
                      <span className="text-[10px] text-slate-500">
                        {count}
                      </span>
                      <div
                        className="w-full max-w-10 rounded-t bg-blue-400"
                        style={{ height: Math.max(2, (count / maximum) * 130) }}
                      />
                      <span className="text-[9px] text-slate-400">
                        {day.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["distribution", "reasons"] as const).map((key) => (
              <Panel key={key} title={t(key)}>
                {query.data[key].length ? (
                  <div className="space-y-3">
                    {query.data[key].map((row) => {
                      const total = query.data[key].reduce(
                        (sum, item) => sum + item.count,
                        0,
                      );
                      return (
                        <div key={row._id}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span>{label(row._id)}</span>
                            <span>
                              {row.count} ·{" "}
                              {Math.round(
                                (row.count / Math.max(1, total)) * 100,
                              )}
                              %
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{
                                width:
                                  (row.count / Math.max(1, total)) * 100 + "%",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t("empty")}</p>
                )}
              </Panel>
            ))}
          </div>
          <Panel title={t("recent")}>
            <MatchesTable rows={query.data.recent} />
          </Panel>
        </>
      )}
    </ArenaShell>
  );
}
export function ArenaMatchesPage() {
  const [params, setParams] = useState<ArenaParams>({});
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-arena", "matches", params, page],
    queryFn: () => api.matches({ ...params, page }),
  });
  return (
    <ArenaShell title="matches" refresh={() => void query.refetch()}>
      <Filters
        fields={matchFilters}
        onApply={(values) => {
          setParams(values);
          setPage(1);
        }}
      />
      {!query.data ? (
        <QueryNotice query={query} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <MatchesTable rows={query.data.items} />
          <Pager page={page} total={query.data.total} onChange={setPage} />
        </section>
      )}
    </ArenaShell>
  );
}
export function ArenaPlayersPage() {
  const { t, date } = useArenaUI();
  const [params, setParams] = useState<ArenaParams>({});
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-arena", "players", params, page],
    queryFn: () => api.players({ ...params, page }),
  });
  return (
    <ArenaShell title="players" refresh={() => void query.refetch()}>
      <Filters
        fields={[
          { key: "search", label: "search", placeholder: "playerSearch" },
          { key: "minRating", label: "minRating", type: "number" },
          { key: "maxRating", label: "maxRating", type: "number" },
          { key: "minMatches", label: "minMatches", type: "number" },
          { key: "activeSince", label: "activeSince", type: "date" },
          {
            key: "sort",
            label: "sort",
            options: ["rating", "rankedMatches", "winRate", "lastActivity"],
          },
        ]}
        onApply={(values) => {
          setParams(values);
          setPage(1);
        }}
      />
      {!query.data ? (
        <QueryNotice query={query} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <DataTable
            rows={query.data.items}
            rowKey={(row) => row.userId}
            columns={[
              {
                key: "user",
                title: t("user"),
                render: (p) => (
                  <div>
                    <UserLink id={p.userId} user={p.user} />
                    <p className="text-xs text-slate-400">{p.user?.email}</p>
                  </div>
                ),
              },
              ...(
                [
                  "rating",
                  "rankedMatches",
                  "rankedWins",
                  "rankedLosses",
                  "rankedDraws",
                  "currentWinStreak",
                  "bestWinStreak",
                ] as const
              ).map((key) => ({
                key,
                title: t(key),
                render: (p: NonNullable<typeof query.data>["items"][number]) =>
                  p[key],
              })),
              {
                key: "winRate",
                title: t("winRate"),
                render: (p) => p.winRate.toFixed(1) + "%",
              },
              {
                key: "lastActivity",
                title: t("lastActivity"),
                render: (p) => (
                  <span className="whitespace-nowrap text-xs">
                    {date(p.lastActivity)}
                  </span>
                ),
              },
            ]}
          />
          <Pager page={page} total={query.data.total} onChange={setPage} />
        </section>
      )}
    </ArenaShell>
  );
}
export function ArenaRoomsPage() {
  const { t, date, locale } = useArenaUI();
  const [params, setParams] = useState<ArenaParams>({});
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-arena", "rooms", params, page],
    queryFn: () => api.rooms({ ...params, page }),
    refetchInterval: 30000,
  });
  return (
    <ArenaShell title="rooms" refresh={() => void query.refetch()}>
      <Filters
        fields={[
          { key: "search", label: "roomCode", placeholder: "roomSearch" },
          { key: "type", label: "type", options: ["FRIEND", "ROOM"] },
          {
            key: "status",
            label: "status",
            options: ["WAITING", "IN_MATCH", "CLOSED"],
          },
          {
            key: "mode",
            label: "mode",
            options: ["CLASSIC", "WORD_CHAIN", "WORD_GUESS"],
          },
          { key: "hostId", label: "hostId" },
          { key: "from", label: "from", type: "date" },
          { key: "to", label: "to", type: "date" },
        ]}
        onApply={(values) => {
          setParams({ ...values, stale: params.stale });
          setPage(1);
        }}
      />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={params.stale === "true"}
          onChange={(e) => {
            setParams({
              ...params,
              stale: e.target.checked ? "true" : undefined,
            });
            setPage(1);
          }}
        />
        {t("staleOnly")}
      </label>
      {!query.data ? (
        <QueryNotice query={query} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <DataTable
            rows={query.data.items}
            rowKey={(r) => r._id}
            columns={[
              {
                key: "code",
                title: t("roomCode"),
                render: (r) => (
                  <div>
                    <Link
                      className="font-mono font-semibold text-blue-600 hover:underline"
                      href={"/" + locale + "/arena/rooms/" + r._id}
                    >
                      {r.code}
                    </Link>
                    {r.stale && (
                      <p className="mt-1 text-xs text-amber-600">
                        {t("stale")}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: "type",
                title: t("type"),
                render: (r) => <Badge value={r.type} />,
              },
              {
                key: "host",
                title: t("host"),
                render: (r) => <UserLink user={r.host} id={r.hostId} />,
              },
              {
                key: "count",
                title: t("capacity"),
                render: (r) => r.players.length + " / " + r.maxPlayers,
              },
              {
                key: "mode",
                title: t("mode"),
                render: (r) => <Badge value={r.mode} />,
              },
              {
                key: "status",
                title: t("status"),
                render: (r) => <Badge value={r.status} />,
              },
              {
                key: "match",
                title: t("currentMatch"),
                render: (r) =>
                  r.currentMatchId ? (
                    <Link
                      className="text-blue-600 hover:underline"
                      href={"/" + locale + "/arena/matches/" + r.currentMatchId}
                    >
                      {r.currentMatchId}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "created",
                title: t("createdAt"),
                render: (r) => (
                  <span className="whitespace-nowrap text-xs">
                    {date(r.createdAt)}
                  </span>
                ),
              },
              {
                key: "activity",
                title: t("lastUpdated"),
                render: (r) => (
                  <span className="whitespace-nowrap text-xs">
                    {date(r.updatedAt)}
                  </span>
                ),
              },
            ]}
          />
          <Pager page={page} total={query.data.total} onChange={setPage} />
        </section>
      )}
      <p className="text-xs text-slate-500">
        {t("realtime")} {t("closeWaitingOnly")}
      </p>
    </ArenaShell>
  );
}
