"use client";

import { Calendar as CalendarIcon } from "lucide-react";

import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<DashboardData, "t" | "formattedToday" | "userName">;

export function DashboardHeader({ t, formattedToday, userName }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span>{t("greeting.hello", { name: userName })}</span>
          <span className="inline-block animate-wiggle">👋</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          {t("greeting.subtitle")}
        </p>
      </div>

      {/* Date Pill Widget */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/80 shadow-xs text-xs sm:text-sm font-semibold text-slate-700 self-start sm:self-auto">
        <CalendarIcon className="w-4 h-4 text-blue-600" />
        <span>{formattedToday}</span>
      </div>
    </div>
  );
}
