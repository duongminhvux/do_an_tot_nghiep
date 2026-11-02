"use client";

import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Flame,
  ListChecks,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { LearningHome } from "@/services/learning-activity.service";
import { surface } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatStudyTime } from "./module-meta";

// One card split into four cells reads as a single summary rather than four
// competing tiles; colour is reserved for the icon and the trend.
const grid =
  "grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4";

function Kpi({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: ReactNode;
  value: ReactNode;
  hint: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 p-5", className)}>
      <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function Growth({ t, value }: { t: TFunction; value: number | null }) {
  if (value === null)
    return <span className="text-slate-400">{t("kpi.no_previous")}</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded px-1 py-px font-semibold tabular-nums",
          up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
        )}
      >
        {up ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        )}
        {Math.abs(value)}%
      </span>
      <span className="text-slate-400">{t("kpi.vs_last_week")}</span>
    </span>
  );
}

// Hairlines between cells for the 2×2 (sm) and 1×4 (xl) layouts.
const cellBorders = [
  "border-slate-100",
  "border-slate-100 sm:border-l",
  "border-slate-100 sm:border-t xl:border-l xl:border-t-0",
  "border-slate-100 sm:border-l sm:border-t xl:border-t-0",
];

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
      <div className={cn(surface, grid)} aria-busy="true">
        {cellBorders.map((border, i) => (
          <div key={i} className={cn("space-y-3 p-5", border)}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );

  const goalPct = Math.min(
    100,
    Math.round((home.today.xp / home.today.goalXp) * 100),
  );
  return (
    <div className={cn(surface, grid)}>
      <Kpi
        className={cellBorders[0]}
        icon={Flame}
        iconClass="text-orange-500"
        label={t("kpi.streak")}
        value={t("kpi.days", { count: home.streak.current })}
        hint={
          home.streak.current > 0 && !home.streak.activeToday ? (
            <span className="font-medium text-orange-600">
              {t("kpi.streak_keep")}
            </span>
          ) : (
            t("kpi.streak_record", { count: home.streak.longest })
          )
        }
      />

      <Kpi
        className={cellBorders[1]}
        icon={Zap}
        iconClass="text-amber-500"
        label={t("kpi.xp_today")}
        value={
          <>
            {home.today.xp}
            <span className="text-base font-medium text-slate-400">
              {" "}
              / {home.today.goalXp} XP
            </span>
          </>
        }
        hint={
          <>
            <div
              role="progressbar"
              aria-label={t("kpi.xp_today")}
              aria-valuemin={0}
              aria-valuemax={home.today.goalXp}
              aria-valuenow={home.today.xp}
              className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                  goalPct >= 100 ? "bg-emerald-500" : "bg-amber-400",
                )}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            {goalPct >= 100
              ? t("kpi.goal_done")
              : t("kpi.total_xp", { xp: home.totals.xp.toLocaleString() })}
          </>
        }
      />

      <Kpi
        className={cellBorders[2]}
        icon={Clock}
        iconClass="text-blue-500"
        label={t("kpi.study_time_week")}
        value={formatStudyTime(t, home.week.durationSec)}
        hint={<Growth t={t} value={home.growth.durationSec} />}
      />

      <Kpi
        className={cellBorders[3]}
        icon={ListChecks}
        iconClass="text-emerald-500"
        label={t("kpi.activities_week")}
        value={String(home.week.count)}
        hint={<Growth t={t} value={home.growth.count} />}
      />
    </div>
  );
}
