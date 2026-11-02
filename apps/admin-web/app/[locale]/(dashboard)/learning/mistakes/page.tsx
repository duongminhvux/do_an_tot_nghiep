"use client";
import { useState } from "react";
import { useListPagination } from '@/hooks/use-list-pagination';
import { ListPagination } from '@/components/ui/list-pagination';
import { LoadError } from "@/components/ui/load-error";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BarChart3, BookOpen, FileCheck2, Headphones, Info, type LucideIcon } from "lucide-react";
import type { MistakeSource } from "@repo/shared-types/mistakes";
import { getMistakeStatistics } from "@/services/mistakes.service";
import { cn } from "@/lib/utils";

const SOURCES: Record<MistakeSource, { icon: LucideIcon; badge: string }> = {
  TOEIC: { icon: FileCheck2, badge: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  DICTATION: { icon: Headphones, badge: "bg-violet-50 text-violet-700 ring-violet-100" },
  VOCABULARY: { icon: BookOpen, badge: "bg-blue-50 text-blue-700 ring-blue-100" },
};

/** Red from 50%, amber from 30%: these are the items most worth reviewing. */
function rateTone(rate: number) {
  return rate >= 50 ? "bg-red-500" : rate >= 30 ? "bg-amber-500" : "bg-slate-400";
}

export default function MistakeStatisticsPage() {
  const { t, i18n } = useTranslation("common");
  const [source, setSource] = useState<MistakeSource | "">("");
  const query = useQuery({
    queryKey: ["mistake-statistics"],
    queryFn: getMistakeStatistics,
  });
  const all = query.data?.items ?? [];
  const items = source ? all.filter((item) => item.sourceType === source) : all;
  const mistakePage = useListPagination(items, source);
  const number = new Intl.NumberFormat(i18n.language === "en" ? "en-US" : "vi-VN");
  const samples = items.reduce((sum, item) => sum + item.samples, 0);
  const wrong = items.reduce((sum, item) => sum + item.wrongCount, 0);
  const summary = [
    { label: t("mistakes.content"), value: number.format(items.length) },
    { label: t("mistakes.samples"), value: number.format(samples) },
    { label: t("mistakes.rate"), value: samples ? `${Math.round((wrong / samples) * 1000) / 10}%` : "—" },
  ];

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <BarChart3 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("mistakes.adminTitle")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{t("mistakes.adminDescription")}</p>
        </div>
      </header>

      {query.isPending && (
        <div role="status" aria-label={t("mistakes.loading")} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}

      {query.data && (
        <>
          <p className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-sm text-blue-900">
            <Info className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
            {t("mistakes.threshold", { count: query.data.minimumLearners })}
          </p>

          <dl className="grid grid-cols-1 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {summary.map((stat) => (
              <div key={stat.label} className="px-5 py-4">
                <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2" role="group" aria-label={t("mistakes.filterSource")}>
              {(["", "TOEIC", "DICTATION", "VOCABULARY"] as const).map((value) => {
                const count = value ? all.filter((item) => item.sourceType === value).length : all.length;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={source === value}
                    onClick={() => setSource(value)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
                      source === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {t(`mistakes.${value || "all"}`)}
                    <span className={cn("rounded px-1.5 text-xs tabular-nums", source === value ? "bg-white/20" : "bg-slate-100 text-slate-500")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {!items.length ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <BarChart3 className="size-6" aria-hidden />
                </span>
                <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">{t("mistakes.adminEmpty")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th scope="col" className="w-12 px-4 py-2.5 font-medium">#</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">{t("mistakes.content")}</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("mistakes.learners")}</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("mistakes.samples")}</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("mistakes.errors")}</th>
                        <th scope="col" className="w-48 px-4 py-2.5 font-medium">{t("mistakes.rate")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mistakePage.items.map((item, index) => {
                        const meta = SOURCES[item.sourceType];
                        const Icon = meta.icon;
                        return (
                          <tr key={`${item.sourceType}:${item.sourceItemId}`} className="align-top transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-400 tabular-nums">
                              {(mistakePage.page - 1) * mistakePage.pageSize + index + 1}
                            </td>
                            <td className="max-w-md px-4 py-3">
                              <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", meta.badge)}>
                                <Icon className="size-3" aria-hidden />
                                {t(`mistakes.${item.sourceType}`)}
                              </span>
                              <p className="mt-1.5 line-clamp-2 break-words font-medium text-slate-900" title={item.title}>
                                {item.title}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{item.sourceItemId}</p>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{number.format(item.learners)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{number.format(item.samples)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{number.format(item.wrongCount)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  role="meter"
                                  aria-label={t("mistakes.rate")}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={item.errorRate}
                                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                                >
                                  <div className={cn("h-full rounded-full", rateTone(item.errorRate))} style={{ width: `${Math.min(100, item.errorRate)}%` }} />
                                </div>
                                <span className="w-14 text-right font-semibold text-slate-900 tabular-nums">{item.errorRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ListPagination pagination={mistakePage} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
