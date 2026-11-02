"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Clock, Headphones, Languages, Lightbulb } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { ErrorState, Segmented, surface } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecommendations } from "@/services/recommendations.service";
import { cn } from "@/lib/utils";

const filters = ["all", "listening", "reading", "vocabulary"] as const;
const typeStyle = {
  listening: { icon: Headphones, tone: "bg-violet-50 text-violet-700" },
  reading: { icon: BookOpen, tone: "bg-emerald-50 text-emerald-700" },
  vocabulary: { icon: Languages, tone: "bg-blue-50 text-blue-700" },
} as const;

export function LearningRecommendations() {
  const { locale = "vi" } = useParams<{ locale: string }>();
  const { t } = useTranslation("home");
  const { user } = useAppSelector((state) => state.auth);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const query = useQuery({
    queryKey: ["learning-recommendations", user?._id, locale],
    queryFn: () => getRecommendations(locale),
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const items =
    query.data?.items.filter(
      (item) => filter === "all" || item.type === filter,
    ) ?? [];
  return (
    <section
      aria-labelledby="recommendations-title"
      className={cn(surface, "p-4 sm:p-6")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="recommendations-title"
            className="flex items-center gap-2 text-base font-semibold text-slate-900"
          >
            <Lightbulb className="h-4 w-4 text-blue-600" aria-hidden />
            {t("recommendations.title")}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {t("recommendations.subtitle")}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("recommendations.filters")}
          className="max-w-full overflow-x-auto scrollbar-none"
        >
          <Segmented
            items={filters.map((value) => ({
              value,
              label: t(`recommendations.${value}`),
            }))}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      <div className="mt-5">
        {query.isPending && (
          <div
            role="status"
            aria-label={t("recommendations.loading")}
            className="grid gap-3 md:grid-cols-3"
          >
            {[1, 2, 3].map((key) => (
              <div key={key} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        )}
        {query.isError && (
          <ErrorState
            message={t("recommendations.error")}
            onRetry={() => void query.refetch()}
            retryLabel={t("recommendations.retry")}
          />
        )}
        {query.isSuccess && (
          <>
            {!!query.data.unavailableSources?.length && (
              <p
                role="status"
                className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {t("recommendations.partial")}
              </p>
            )}
            {query.data.state === "disabled" ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                {t("recommendations.disabled")}
              </p>
            ) : items.length ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {items.map((item) => {
                  const style = typeStyle[item.type as keyof typeof typeStyle] ?? typeStyle.vocabulary;
                  const Icon = style.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/${locale}${item.actionUrl}`}
                        className="group flex h-full flex-col rounded-lg border border-slate-200 p-4 outline-none transition-[border-color,background-color] duration-200 hover:border-slate-300 hover:bg-slate-50/60 focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium",
                              style.tone,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {t(`recommendations.${item.type}`)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {t("recommendations.minutes", {
                              count: item.estimatedMinutes,
                            })}
                          </span>
                        </div>
                        <h3 className="mt-3 font-semibold leading-snug text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">
                          {item.reason}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                          {t("recommendations.start")}
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                {t("recommendations.emptyFilter")}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
