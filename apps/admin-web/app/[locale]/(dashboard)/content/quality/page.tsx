"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  contentQualityService,
  type QualityCategory,
} from "@/services/content-quality.service";

const categories: QualityCategory[] = [
  "DATA",
  "MEDIA",
  "DUPLICATE",
  "FEEDBACK",
];
export default function ContentQualityPage() {
  const { t, i18n } = useTranslation("common");
  const { locale } = useParams<{ locale: string }>();
  const lang = i18n.language.startsWith("en") ? "en" : "vi";
  const [category, setCategory] = useState<QualityCategory>();
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["content-quality", category, page, lang],
    queryFn: () => contentQualityService.list(category, page, lang),
    refetchInterval: (state) =>
      ["PENDING", "RUNNING"].includes(state.state.data?.job?.state ?? "")
        ? 3000
        : false,
  });
  const scan = useMutation({
    mutationFn: contentQualityService.scan,
    onSuccess: () => {
      setPage(1);
      void cache.invalidateQueries({ queryKey: ["content-quality"] });
    },
  });
  const data = query.data;
  const active =
    data?.job?.state === "PENDING" || data?.job?.state === "RUNNING";
  const date = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(lang === "en" ? "en-GB" : "vi-VN")
      : "—";
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("contentQuality.title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            {t("contentQuality.description")}
          </p>
        </div>
        <Button
          onClick={() => scan.mutate()}
          disabled={
            scan.isPending || active || query.isPending || query.isError
          }
        >
          {t(active ? "contentQuality.scanning" : "contentQuality.scan")}
        </Button>
      </div>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("contentQuality.loading")}
          className="h-72 animate-pulse rounded-xl bg-slate-100"
        />
      )}
      {query.isError && (
        <div role="alert" className="rounded-xl border p-5">
          <p>{t("contentQuality.loadError")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("contentQuality.retry")}
          </Button>
        </div>
      )}
      {scan.isError && (
        <p role="alert" className="text-red-700">
          {t("contentQuality.scanError")}
        </p>
      )}
      {scan.isSuccess && active && (
        <p role="status" className="text-sm text-emerald-700">
          {t("contentQuality.queued")}
        </p>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              ["needsReview", "missingAudio", "duplicates", "feedback"] as const
            ).map((key) => (
              <div key={key} className="rounded-xl border bg-white p-4">
                <p className="text-sm text-slate-500">
                  {t(`contentQuality.kpi.${key}`)}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {key === "feedback" && !data.feedbackAvailable
                    ? "—"
                    : data.stats[key]}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm" aria-live="polite">
            <p>
              {t("contentQuality.snapshot")}: {date(data.snapshotAt)}
            </p>
            {data.stale && (
              <p className="text-amber-700">{t("contentQuality.stale")}</p>
            )}
            {data.job && (
              <p>
                {t(`contentQuality.state.${data.job.state}`)} ·{" "}
                {t("contentQuality.processed", {
                  count: data.job.scanned_count,
                })}
              </p>
            )}
            {active && (
              <p>
                {t("contentQuality.phase")}:{" "}
                {data.job!.phase < 4
                  ? t(
                      `contentQuality.kind.${["words", "lessons", "dictation", "exams"][data.job!.phase]}`,
                    )
                  : t("contentQuality.tabs.MEDIA")}
              </p>
            )}
            {data.job?.state === "FAILED" && (
              <p role="alert" className="text-red-700">
                {t("contentQuality.workerError")}
              </p>
            )}
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-2"
            role="group"
            aria-label={t("contentQuality.filter")}
          >
            {[undefined, ...categories].map((tab) => (
              <Button
                key={tab ?? "all"}
                variant={category === tab ? "default" : "outline"}
                aria-pressed={category === tab}
                onClick={() => {
                  setCategory(tab);
                  setPage(1);
                }}
              >
                {t(tab ? `contentQuality.tabs.${tab}` : "contentQuality.all")}
              </Button>
            ))}
          </div>
          {category === "FEEDBACK" && !data.feedbackAvailable ? (
            <p className="rounded-xl border p-8">
              {t("contentQuality.noFeedback")}
            </p>
          ) : !data.snapshotAt ? (
            <p className="rounded-xl border p-8">
              {t("contentQuality.noScan")}
            </p>
          ) : !data.items.length ? (
            <p className="rounded-xl border p-8">{t("contentQuality.empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "type",
                      "name",
                      "issue",
                      "severity",
                      "updated",
                      "action",
                    ].map((key) => (
                      <th scope="col" key={key} className="p-3">
                        {t(`contentQuality.columns.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="whitespace-nowrap p-3">
                        {t(`contentQuality.kind.${item.kind}`)}
                      </td>
                      <td className="min-w-40 p-3 font-medium">{item.title}</td>
                      <td className="min-w-64 p-3">
                        <p>{item.message}</p>
                        {item.path && (
                          <p className="mt-1 break-all text-xs text-slate-500">
                            {item.path}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${item.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                        >
                          {t(`contentQuality.severity.${item.severity}`)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {date(item.updatedAt)}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        <Link
                          className="font-medium text-blue-700 underline"
                          href={`/${locale}${item.editPath}`}
                        >
                          {t("contentQuality.edit")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>{t("contentQuality.total", { count: data.total })}</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("contentQuality.previous")}
              </Button>
              <span>
                {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <Button
                variant="outline"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("contentQuality.next")}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {t("contentQuality.mediaScope")}
          </p>
        </>
      )}
    </div>
  );
}
