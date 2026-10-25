"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Loader2, Search, Trophy } from "lucide-react";
import { Panel, StatCard, Tabs } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title={t("choose_sources")} description={t("sources_help")}>
        <Tabs<SourceType>
          aria-label={t("source_category")}
          value={tab}
          onChange={setTab}
          items={[
            { value: "SYSTEM", label: t("system_sources") },
            { value: "USER", label: t("user_sources") },
          ]}
        />
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label={t("search_sources")}
            placeholder={t("search_sources")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((source) => (
            <label
              key={key(source)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                selected.includes(key(source))
                  ? "border-blue-400 bg-blue-50/60"
                  : "border-slate-200 hover:border-blue-300",
              )}
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
                className="size-4 shrink-0 accent-blue-600"
              />
              <BookOpen className="size-5 shrink-0 text-blue-500" />
              <span className="min-w-0">
                <strong
                  className="block truncate text-sm font-semibold text-slate-800"
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
          <p className="py-8 text-center text-sm text-slate-500">
            {search.trim()
              ? t("no_matches")
              : tab === "USER"
                ? t("no_user_sources")
                : t("no_system_sources")}
          </p>
        )}
        <p className="mt-4 text-sm font-semibold text-blue-600">
          {t("selected_sources", { count: selected.length })}
        </p>
        <Button
          size="lg"
          onClick={onStart}
          disabled={
            busy ||
            !selected.length ||
            count < (sources.settings?.minWordCount ?? 10)
          }
          className="mt-6 w-full"
        >
          {busy && <Loader2 className="animate-spin" />}
          {t("start")}
        </Button>
        <p className="mt-2 text-center text-xs text-slate-500">
          {t("minimum_words", { count: sources.settings?.minWordCount ?? 10 })}
        </p>
      </Panel>
      <aside className="space-y-4">
        <StatCard
          icon={Trophy}
          tone="amber"
          label={t("personal_best")}
          value={stats ? stats.bestScore.toLocaleString(i18n.language) : "—"}
          hint={t("total_plays", { count: stats?.totalPlays ?? 0 })}
        />
        <Panel title={t("session_rules")}>
          <dl className="space-y-3 text-sm">
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
        </Panel>
        <Panel title={t("recent_scores")}>
          {stats?.recentScores.length ? (
            <ol className="-my-2 divide-y divide-slate-100">
              {stats.recentScores.map((score) => (
                <li
                  key={score.id}
                  className="flex justify-between gap-2 py-2 text-sm"
                >
                  <strong className="font-semibold text-blue-600">
                    {score.score.toLocaleString(i18n.language)}
                  </strong>
                  <time className="text-xs text-slate-500" dateTime={score.createdAt}>
                    {new Date(score.createdAt).toLocaleDateString(
                      i18n.language === "en" ? "en-US" : "vi-VN",
                    )}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">{t("no_scores")}</p>
          )}
        </Panel>
        <p className="px-1 text-xs leading-6 text-slate-500">
          {t("how_to_play")}
        </p>
      </aside>
    </div>
  );
}
