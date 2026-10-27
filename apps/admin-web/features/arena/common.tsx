"use client";
/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type {
  ArenaMatch,
  ArenaParams,
  ArenaUser,
} from "@/services/arena.service";
export const control =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
export const primary =
  button + " border-blue-600! bg-blue-600! text-white! hover:bg-blue-700!";
export function useArenaUI() {
  const { t } = useTranslation("arena");
  const { locale: lang } = useParams();
  const locale = lang === "en" ? "en" : "vi";
  return {
    t,
    locale,
    date: (value?: string | null) =>
      value
        ? new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB", {
            timeZone: "Asia/Ho_Chi_Minh",
          })
        : "—",
    label: (value?: string | null) =>
      value ? t("values." + value, { defaultValue: value }) : "—",
  };
}
export function ArenaShell({
  title,
  children,
  refresh,
}: {
  title: string;
  children: ReactNode;
  refresh?: () => void;
}) {
  const { t } = useArenaUI();
  return (
    <main className="w-full min-w-0 space-y-5 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t(title)}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        </div>
        {refresh && (
          <button onClick={refresh} className={button}>
            <RefreshCw className="size-4" />
            {t("refresh")}
          </button>
        )}
      </header>
      {children}
    </main>
  );
}
export function QueryNotice({
  query,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
}) {
  const { t } = useArenaUI();
  return (
    <div
      role={query.isError ? "alert" : "status"}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
    >
      <p>{t(query.isPending ? "loading" : "error")}</p>
      {query.isError && (
        <button onClick={() => void query.refetch()} className={button}>
          {t("retry")}
        </button>
      )}
    </div>
  );
}
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {title && (
        <h2 className="border-b border-slate-100 px-5 py-4 text-base font-semibold text-slate-800">
          {title}
        </h2>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
export function Badge({ value }: { value?: string | null }) {
  const { label } = useArenaUI();
  return (
    <span
      className={
        "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium " +
        (["PLAYING", "IN_MATCH", "COUNTDOWN"].includes(value ?? "")
          ? "bg-blue-50 text-blue-700"
          : value === "FINISHED"
            ? "bg-emerald-50 text-emerald-700"
            : value === "CANCELLED"
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-600")
      }
    >
      {label(value)}
    </span>
  );
}
export function UserLink({
  user,
  id,
}: {
  user?: ArenaUser | null;
  id?: string;
}) {
  const { locale } = useArenaUI();
  const userId = id ?? user?._id;
  return userId ? (
    <Link
      className="inline-flex items-center gap-2 break-all font-medium text-blue-600 hover:underline"
      href={"/" + locale + "/arena/players/" + userId}
    >
      {user?.avatarUrl && (
        <img
          src={user.avatarUrl}
          alt=""
          className="size-7 shrink-0 rounded-full object-cover"
        />
      )}
      <span>{user?.username || user?.email || userId}</span>
    </Link>
  ) : (
    <span>—</span>
  );
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: { key: string; title: string; render: (row: T) => ReactNode }[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const { t } = useArenaUI();
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-4 py-3 font-medium"
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 align-top">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={columns.length}
                className="p-10 text-center text-slate-500"
              >
                {t("empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (page: number) => void;
}) {
  const { t } = useArenaUI();
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        {t("pagination", { page, pages, total })}
      </p>
      <div className="flex gap-2">
        <button
          className={button}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {t("previous")}
        </button>
        <button
          className={button}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
export type FilterField = {
  key: string;
  label: string;
  type?: "date" | "number" | "text";
  placeholder?: string;
  options?: string[];
};
export function Filters({
  fields,
  onApply,
}: {
  fields: FilterField[];
  onApply: (values: ArenaParams) => void;
}) {
  const { t, label } = useArenaUI();
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const values: ArenaParams = { ...draft };
        for (const key of ["from", "activeSince"])
          if (draft[key]) values[key] = draft[key] + "T00:00:00+07:00";
        if (draft.to) values.to = draft.to + "T23:59:59.999+07:00";
        onApply(values);
      }}
    >
      {fields.map((field) => (
        <label
          key={field.key}
          className="min-w-0 space-y-1 text-xs font-medium text-slate-500"
        >
          <span>{t(field.label)}</span>
          {field.options ? (
            <select
              className={control}
              value={draft[field.key] ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, [field.key]: e.target.value })
              }
            >
              <option value="">{t("all")}</option>
              {field.options.map((value) => (
                <option key={value} value={value}>
                  {field.key === "sort" ? t(value) : label(value)}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={control}
              type={field.type ?? "text"}
              min={field.type === "number" ? 0 : undefined}
              maxLength={100}
              placeholder={field.placeholder ? t(field.placeholder) : undefined}
              value={draft[field.key] ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, [field.key]: e.target.value })
              }
            />
          )}
        </label>
      ))}
      <div className="flex items-end">
        <button type="submit" className={primary}>
          {t("apply")}
        </button>
      </div>
    </form>
  );
}
export function MatchesTable({
  rows,
  viewerId,
}: {
  rows: ArenaMatch[];
  viewerId?: string;
}) {
  const { t, date, locale } = useArenaUI();
  return (
    <DataTable
      rows={rows}
      rowKey={(m) => m._id}
      columns={[
        {
          key: "id",
          title: t("matchId"),
          render: (m) => (
            <Link
              title={m._id}
              href={"/" + locale + "/arena/matches/" + m._id}
              className="font-mono text-xs text-blue-600 hover:underline"
            >
              {m._id}
            </Link>
          ),
        },
        {
          key: "type",
          title: t("type"),
          render: (m) => <Badge value={m.type} />,
        },
        {
          key: "mode",
          title: t("mode"),
          render: (m) => <Badge value={m.friendMode || m.questionMode} />,
        },
        {
          key: "players",
          title: t("players"),
          render: (m) => (
            <div className="min-w-40 space-y-1">
              {m.players.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between gap-3"
                >
                  <UserLink id={p.userId} user={p.user} />
                  <span className="tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>
          ),
        },
        ...(viewerId
          ? [
              {
                key: "ratingChange",
                title: t("ratingChange"),
                render: (m: ArenaMatch) =>
                  m.type === "RANK"
                    ? (m.players.find((p) => p.userId === viewerId)
                        ?.ratingChange ?? "—")
                    : t("na"),
              },
            ]
          : []),
        {
          key: "winner",
          title: t("winner"),
          render: (m) =>
            m.isDraw ? (
              t("draw")
            ) : (
              <UserLink
                id={m.winnerId ?? undefined}
                user={m.players.find((p) => p.userId === m.winnerId)?.user}
              />
            ),
        },
        {
          key: "status",
          title: t("status"),
          render: (m) => <div className="space-y-1"><Badge value={m.status} />
            {Object.entries(m.rankedState?.members ?? {}).filter(([,p]) => p.disconnectedAt !== null).map(([userId,p]) => (
              <div key={userId} className="text-xs text-amber-700">
                <UserLink user={m.players.find(player => player.userId === userId)?.user} id={userId} />
                {p.deadlineAt && <span className="ml-1">{date(new Date(p.deadlineAt).toISOString())}</span>}
              </div>
            ))}
          </div>,
        },
        {
          key: "reason",
          title: t("finishReason"),
          render: (m) => m.cancelReason || <Badge value={m.finishReason} />,
        },
        {
          key: "date",
          title: t("createdAt"),
          render: (m) => (
            <span className="whitespace-nowrap text-xs text-slate-500">
              {date(m.createdAt)}
            </span>
          ),
        },
        {
          key: "finished",
          title: t("finishedAt"),
          render: (m) => (
            <span className="whitespace-nowrap text-xs text-slate-500">
              {date(m.finishedAt)}
            </span>
          ),
        },
      ]}
    />
  );
}
export const matchFilters: FilterField[] = [
  { key: "search", label: "matchId", placeholder: "matchSearch" },
  { key: "type", label: "type", options: ["RANK", "FRIEND", "ROOM"] },
  {
    key: "status",
    label: "status",
    options: [
      "WAITING",
      "COUNTDOWN",
      "PLAYING",
      "PAUSED",
      "RESUMING",
      "FINISHING",
      "FINISHED",
      "CANCELLED",
    ],
  },
  {
    key: "mode",
    label: "mode",
    options: [
      "CLASSIC",
      "WORD_CHAIN",
      "WORD_GUESS",
      "MEANING_TO_WORD",
      "WORD_TO_MEANING",
      "LISTENING",
      "CONTEXT",
      "MIXED",
    ],
  },
  { key: "userId", label: "userId" },
  { key: "winnerId", label: "winnerId" },
  {
    key: "finishReason",
    label: "finishReason",
    options: ["NORMAL", "PLAYER_LEFT", "DISCONNECT_TIMEOUT", "TURN_TIMEOUT"],
  },
  { key: "from", label: "from", type: "date" },
  { key: "to", label: "to", type: "date" },
];
