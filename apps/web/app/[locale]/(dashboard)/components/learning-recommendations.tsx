"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Headphones, Languages } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { getRecommendations } from "@/services/recommendations.service";

const filters = ["all", "listening", "reading", "vocabulary"] as const;
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
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <h2
        id="recommendations-title"
        className="text-lg font-bold text-slate-900"
      >
        {t("recommendations.title")}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {t("recommendations.subtitle")}
      </p>
      <div
        className="my-4 flex gap-2 overflow-x-auto"
        aria-label={t("recommendations.filters")}
      >
        {filters.map((value) => (
          <Button
            key={value}
            variant={filter === value ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(`recommendations.${value}`)}
          </Button>
        ))}
      </div>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("recommendations.loading")}
          className="grid gap-4 md:grid-cols-3"
        >
          {[1, 2, 3].map((key) => (
            <div
              key={key}
              className="h-44 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      )}
      {query.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p>{t("recommendations.error")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("recommendations.retry")}
          </Button>
        </div>
      )}
      {query.isSuccess && (
        <>
          {!!query.data.unavailableSources?.length && (
            <p role="status" className="mb-3 text-sm text-amber-700">
              {t("recommendations.partial")}
            </p>
          )}
          {query.data.state === "disabled" ? (
            <p className="text-sm text-slate-500">
              {t("recommendations.disabled")}
            </p>
          ) : items.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {items.map((item) => {
                const Icon =
                  item.type === "listening"
                    ? Headphones
                    : item.type === "reading"
                      ? BookOpen
                      : Languages;
                return (
                  <article
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <Icon className="size-4" aria-hidden />
                      {t(`recommendations.${item.type}`)}
                      <span className="ml-auto text-slate-500">
                        {t("recommendations.minutes", {
                          count: item.estimatedMinutes,
                        })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="flex-1 text-sm text-slate-600">
                      {item.reason}
                    </p>
                    <Button asChild>
                      <Link href={`/${locale}${item.actionUrl}`}>
                        {t("recommendations.start")}
                      </Link>
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {t("recommendations.emptyFilter")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
