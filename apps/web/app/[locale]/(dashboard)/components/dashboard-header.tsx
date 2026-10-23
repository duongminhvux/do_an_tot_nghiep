"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import type { HomeData } from "../hooks/use-home-data";

type Props = Pick<HomeData, "t" | "formattedToday" | "userName">;

export function DashboardHeader({ t, formattedToday, userName }: Props) {
  return (
    <PageHeader
      title={
        <>
          {t("greeting.hello", { name: userName })}{" "}
          <span className="inline-block animate-wiggle">👋</span>
        </>
      }
      description={t("greeting.subtitle")}
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium capitalize text-slate-700 shadow-xs">
          <CalendarIcon className="h-4 w-4 text-blue-600" />
          {formattedToday}
        </span>
      }
    />
  );
}
