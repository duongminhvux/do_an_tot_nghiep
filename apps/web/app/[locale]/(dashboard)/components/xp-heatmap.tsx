"use client";

import { useMemo, useState } from "react";
import type { TFunction } from "i18next";
import type {
  HomeDay,
  LearningHome,
} from "@/services/learning-activity.service";
import { Panel } from "@/components/ui/page";
import { PanelSkeleton } from "./dashboard-feedback";
import { MODULES, moduleName } from "./module-meta";

const WEEKS = 13;
// One sequential hue; intensity follows XP relative to the daily goal.
const LEVELS = [
  "bg-slate-100",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
];

function addDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function level(xp: number, goal: number) {
  if (xp <= 0) return 0;
  if (xp < goal / 2) return 1;
  if (xp < goal) return 2;
  return 3;
}

export function XpHeatmap({
  t,
  locale,
  home,
  isLoading,
}: {
  t: TFunction;
  locale: string;
  home?: LearningHome;
  isLoading: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const weeks = useMemo(() => {
    if (!home) return [];
    const byDate = new Map(home.heatmap.map((d) => [d.date, d]));
    const today = home.today.date;
    // Columns are Monday→Sunday weeks; the last column holds today.
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const start = addDays(today, -weekday - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, w * 7 + d);
        return { date, future: date > today, day: byDate.get(date) };
      }),
    );
  }, [home]);

  if (isLoading || !home) return <PanelSkeleton rows={3} />;

  const dateLabel = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(
      locale === "vi" ? "vi-VN" : "en-US",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
      },
    );
  const detail: HomeDay | undefined = hovered
    ? (home.heatmap.find((d) => d.date === hovered) ?? undefined)
    : undefined;
  const weekdayLabels = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  return (
    <Panel
      className="min-w-0"
      title={t("activity_map.title")}
      description={t("activity_map.active_days", {
        count: home.heatmap.length,
      })}
    >
      {/* One grid, filled column by column: the weekday labels form the first
          column, then one column per week, so rows always line up. */}
      <div className="min-w-0 max-w-[30rem]">
        <div className="grid grid-flow-col grid-cols-[auto_repeat(13,minmax(0,1fr))] grid-rows-7 gap-1 sm:gap-[5px]">
          {weekdayLabels.map((d, i) => (
            <span
              key={d}
              className={`flex items-center pr-1.5 text-[11px] leading-none text-slate-400 ${i % 2 ? "invisible sm:visible" : ""}`}
            >
              {t(`activity_map.days.${d}`)}
            </span>
          ))}
          {weeks.flat().map(({ date, future, day }) => (
            <button
              key={date}
              type="button"
              disabled={future}
              aria-label={`${dateLabel(date)}: ${day?.xp ?? 0} XP`}
              onMouseEnter={() => setHovered(date)}
              onFocus={() => setHovered(date)}
              onMouseLeave={() => setHovered(null)}
              className={`aspect-square w-full rounded-[4px] outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 ${
                future
                  ? "bg-transparent"
                  : `${LEVELS[level(day?.xp ?? 0, home.today.goalXp)]} cursor-pointer hover:ring-2 hover:ring-slate-300`
              } ${date === home.today.date ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          {t("activity_map.less")}
          {LEVELS.map((c) => (
            <span key={c} aria-hidden className={`h-3 w-3 rounded-[3px] ${c}`} />
          ))}
          {t("activity_map.more")}
        </span>
        <span>{t("activity_map.goal_hint", { goal: home.today.goalXp })}</span>
      </div>

      <div
        aria-live="polite"
        className="mt-3 min-h-[52px] rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      >
        {hovered ? (
          <>
            <p className="font-semibold text-slate-800">
              {dateLabel(hovered)} · {detail?.xp ?? 0} XP
            </p>
            <p className="mt-0.5">
              {detail
                ? MODULES.filter((m) => detail.byModule[m])
                    .map(
                      (m) =>
                        `${moduleName(t, m)}: ${detail.byModule[m]!.xp} XP`,
                    )
                    .join(" · ")
                : t("activity_map.none")}
            </p>
          </>
        ) : (
          <p className="text-slate-400">{t("activity_map.hover_hint")}</p>
        )}
      </div>
    </Panel>
  );
}
