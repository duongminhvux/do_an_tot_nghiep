"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Loader2, Search, Trophy } from "lucide-react";
import type { GameStats, Sources, SourceType, WordSource } from "../types";
export function MeaningTypingSetup({
  sources,
  stats,
  selected,
  onSelect,
  onStart,
  busy,
}: {
  sources: Sources;
  stats?: GameStats;
  selected: string[];
  onSelect: (keys: string[]) => void;
  onStart: () => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation("minigames");
  const [tab, setTab] = useState<SourceType>("SYSTEM"),
    [search, setSearch] = useState("");
  const all = [...sources.systemCollections, ...sources.userCollections];
  const key = (source: WordSource) => source.type + ":" + source.id;
  const count = all
    .filter((source) => selected.includes(key(source)))
    .reduce((sum, source) => sum + source.wordCount, 0);
  const shown = (
    tab === "SYSTEM" ? sources.systemCollections : sources.userCollections
  ).filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">
          {t("choose_sources")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {t("sources_help")}
        </p>
        <div
          className="mt-5 flex gap-2"
          role="group"
          aria-label={t("source_category")}
        >
          <button
            aria-pressed={tab === "SYSTEM"}
            onClick={() => setTab("SYSTEM")}
            className={
              "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold " +
              (tab === "SYSTEM"
                ? "bg-indigo-50 text-indigo-700"
                : "bg-slate-50 text-slate-500")
            }
          >
            {t("system_sources")}
          </button>
          <button
            aria-pressed={tab === "USER"}
            onClick={() => setTab("USER")}
            className={
              "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold " +
              (tab === "USER"
                ? "bg-indigo-50 text-indigo-700"
                : "bg-slate-50 text-slate-500")
            }
          >
            {t("user_sources")}
          </button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 size-4 text-slate-400" />
          <input
            aria-label={t("search_sources")}
            placeholder={t("search_sources")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((source) => (
            <label
              key={key(source)}
              className={
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 " +
                (selected.includes(key(source))
                  ? "border-indigo-400 bg-indigo-50/60"
                  : "border-slate-200 hover:border-slate-300")
              }
            >
              <input
                type="checkbox"
                checked={selected.includes(key(source))}
                disabled={source.wordCount === 0}
                onChange={(e) =>
                  onSelect(
                    e.target.checked
                      ? [...selected, key(source)]
                      : selected.filter((id) => id !== key(source)),
                  )
                }
                className="size-4 shrink-0 accent-indigo-600"
              />
              <BookOpen className="size-5 shrink-0 text-indigo-400" />
              <span className="min-w-0">
                <strong
                  className="block truncate text-sm text-slate-800"
                  title={source.name}
                >
                  {source.name}
                </strong>
                <span className="text-xs text-slate-500">
                  {t("word_count", { count: source.wordCount })}
                </span>
              </span>
            </label>
          ))}
        </div>
        {!shown.length && (
          <p className="py-8 text-center text-sm text-slate-400">
            {search.trim()
              ? t("no_matches")
              : tab === "USER"
                ? t("no_user_sources")
                : t("no_system_sources")}
          </p>
        )}
        <p className="mt-4 text-sm font-semibold text-indigo-600">
          {t("selected_sources", { count: selected.length })}
        </p>
        <button
          onClick={onStart}
          disabled={
            busy ||
            !selected.length ||
            count < (sources.settings?.minWordCount ?? 10)
          }
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t("start")}
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          {t("minimum_words", { count: sources.settings?.minWordCount ?? 10 })}
        </p>
      </section>
      <aside className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-800">{t("session_rules")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {(
              [
                [
                  "rule_minimum",
                  t("rule_words", { count: sources.settings.minWordCount }),
                ],
                [
                  "rule_lives",
                  t("rule_life_count", { count: sources.settings.lives }),
                ],
                [
                  "rule_speed",
                  t("rule_speed_value", {
                    speed: sources.settings.initialFallSpeed,
                  }),
                ],
                [
                  "rule_spawn",
                  t("rule_spawn_value", {
                    seconds: (
                      sources.settings.spawnInterval / 1000
                    ).toLocaleString(i18n.language),
                  }),
                ],
                [
                  "rule_heart",
                  t("rule_heart_value", {
                    count: sources.settings.heartEveryWords,
                  }),
                ],
                [
                  "rule_hint_percent",
                  t("rule_hint_percent_value", {
                    count: sources.settings.hintPercent,
                  }),
                ],
                [
                  "rule_max_lives",
                  t("rule_life_count", {
                    count: sources.settings.maxLives ?? sources.settings.lives,
                  }),
                ],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">{t(key)}</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-pink-50 p-3 text-xs leading-5 text-pink-700">
            {t("heart_rule", { count: sources.settings.heartEveryWords })}
          </p>
        </section>
        <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <Trophy className="size-7 text-amber-500" />
          <h2 className="mt-3 text-sm font-semibold text-slate-700">
            {t("personal_best")}
          </h2>
          <p className="mt-1 text-3xl font-black text-indigo-700">
            {stats ? stats.bestScore.toLocaleString(i18n.language) : "—"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {t("total_plays", { count: stats?.totalPlays ?? 0 })}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-800">{t("recent_scores")}</h2>
          {stats?.recentScores.length ? (
            <ol className="mt-3 divide-y divide-slate-100">
              {stats.recentScores.map((score) => (
                <li
                  key={score.id}
                  className="flex justify-between gap-2 py-2 text-xs"
                >
                  <strong className="text-indigo-600">
                    {score.score.toLocaleString(i18n.language)}
                  </strong>
                  <time className="text-slate-400" dateTime={score.createdAt}>
                    {new Date(score.createdAt).toLocaleDateString(
                      i18n.language === "en" ? "en-US" : "vi-VN",
                    )}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{t("no_scores")}</p>
          )}
        </section>
        <p className="px-1 text-xs leading-6 text-slate-500">
          {t("how_to_play")}
        </p>
      </aside>
    </div>
  );
}
