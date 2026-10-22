"use client";

import Link from "next/link";
import type { TFunction } from "i18next";
import type { RecentActivity } from "@/services/learning-activity.service";
import { Panel } from "@/components/ui/page";
import { PanelSkeleton } from "./dashboard-feedback";
import { MODULE_META, formatStudyTime } from "./module-meta";

function timeAgo(date: string, locale: string) {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit);
  return format.format(0, "minute");
}

function summary(t: TFunction, item: RecentActivity) {
  const parts: string[] = [];
  if (item.module === "TOEIC" && item.score != null)
    parts.push(t("recent.score", { score: item.score }));
  if (item.module === "ARENA" && item.metadata)
    parts.push(
      t(
        item.metadata.isDraw
          ? "recent.draw"
          : item.metadata.won
            ? "recent.win"
            : "recent.loss",
      ),
    );
  if (item.module === "MINIGAME" && item.score != null)
    parts.push(t("recent.points", { score: item.score }));
  if (item.correct != null && item.total)
    parts.push(
      t("recent.correct", { correct: item.correct, total: item.total }),
    );
  if (item.durationSec) parts.push(formatStudyTime(t, item.durationSec));
  return parts.join(" · ");
}

export function RecentActivityList({
  t,
  locale,
  items,
  isLoading,
}: {
  t: TFunction;
  locale: string;
  items?: RecentActivity[];
  isLoading: boolean;
}) {
  if (isLoading) return <PanelSkeleton rows={4} />;
  return (
    <Panel title={t("recent.title")}>
      {!items?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("recent.empty")}
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100">
          {items.map((item) => {
            const meta = MODULE_META[item.module];
            const Icon = meta.icon;
            const body = (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {item.title ||
                      t(`recent.types.${item.type}`, {
                        defaultValue: t(
                          `modules.${item.module.toLowerCase()}.name`,
                        ),
                      })}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {summary(t, item)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-amber-600">
                    +{item.xp} XP
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {timeAgo(item.occurredAt, locale)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {item.link ? (
                  <Link
                    href={`/${locale}${item.link}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
