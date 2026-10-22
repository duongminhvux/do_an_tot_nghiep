"use client";

import {
  ArrowDown,
  ArrowUp,
  Clock,
  Flame,
  ListChecks,
  Zap,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { LearningHome } from "@/services/learning-activity.service";
import { StatCard } from "@/components/ui/page";
import { StatCardSkeleton } from "./dashboard-feedback";
import { formatStudyTime } from "./module-meta";

function Growth({ t, value }: { t: TFunction; value: number | null }) {
  if (value === null)
    return <span className="text-slate-400">{t("kpi.no_previous")}</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}
      >
        {up ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        {Math.abs(value)}%
      </span>
      <span className="text-slate-400">{t("kpi.vs_last_week")}</span>
    </span>
  );
}

export function HomeStats({
  t,
  home,
  isLoading,
}: {
  t: TFunction;
  home?: LearningHome;
  isLoading: boolean;
}) {
  if (isLoading || !home)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );

  const goalPct = Math.min(
    100,
    Math.round((home.today.xp / home.today.goalXp) * 100),
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Flame}
        tone="orange"
        label={t("kpi.streak")}
        value={t("kpi.days", { count: home.streak.current })}
        hint={
          <>
            {home.streak.current > 0 && !home.streak.activeToday
              ? t("kpi.streak_keep")
              : t("kpi.streak_record", { count: home.streak.longest })}
          </>
        }
      />

      <StatCard
        icon={Zap}
        tone="amber"
        label={t("kpi.xp_today")}
        value={`${home.today.xp} / ${home.today.goalXp} XP`}
        hint={
          <>
            <div
              role="progressbar"
              aria-label={t("kpi.xp_today")}
              aria-valuemin={0}
              aria-valuemax={home.today.goalXp}
              aria-valuenow={home.today.xp}
              className="mb-1 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            {goalPct >= 100
              ? t("kpi.goal_done")
              : t("kpi.total_xp", { xp: home.totals.xp.toLocaleString() })}
          </>
        }
      />

      <StatCard
        icon={Clock}
        tone="blue"
        label={t("kpi.study_time_week")}
        value={formatStudyTime(t, home.week.durationSec)}
        hint={
          <>
            <Growth t={t} value={home.growth.durationSec} />
          </>
        }
      />

      <StatCard
        icon={ListChecks}
        tone="emerald"
        label={t("kpi.activities_week")}
        value={String(home.week.count)}
        hint={
          <>
            <Growth t={t} value={home.growth.count} />
          </>
        }
      />
    </div>
  );
}
