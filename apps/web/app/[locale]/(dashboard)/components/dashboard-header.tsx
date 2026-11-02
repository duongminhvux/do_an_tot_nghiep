"use client";

import { PageHeader } from "@/components/ui/page";
import type { HomeData } from "../hooks/use-home-data";

type Props = Pick<HomeData, "t" | "formattedToday" | "userName">;

export function DashboardHeader({ t, formattedToday, userName }: Props) {
  return (
    <PageHeader
      eyebrow={
        <span className="inline-block text-sm font-medium normal-case tracking-normal text-slate-500 first-letter:uppercase">
          {formattedToday}
        </span>
      }
      title={t("greeting.hello", { name: userName })}
      description={t("greeting.subtitle")}
    />
  );
}
