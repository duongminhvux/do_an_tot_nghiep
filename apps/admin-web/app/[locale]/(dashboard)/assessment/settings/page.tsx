"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Settings } from "lucide-react";
import { examService } from "@/services/assessment.service";

export default function ExamSettingsIndexPage() {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation("assessment");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-exams", "settings", search, page],
    queryFn: () =>
      examService.getAll({ q: search.trim(), type: "TOEIC", page, limit: 10 }),
  });
  const exams = query.data?.data?.data ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((query.data?.data?.total ?? 0) / 10),
  );

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("timing.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t("timing.selectExam")}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
        <input
          type="search"
          aria-label={t("timing.searchExam")}
          placeholder={t("timing.searchExam")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {query.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Loader2 className="size-4 animate-spin" />
          {t("timing.loading")}
        </p>
      ) : query.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{t("timing.loadError")}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 font-semibold underline"
          >
            {t("timing.retry")}
          </button>
        </div>
      ) : exams.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t("timing.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <div
              key={exam._id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold text-slate-900">
                  {exam.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("timing.subtitle")}
                </p>
              </div>
              <Link
                href={`/${locale}/assessment/${exam._id}/settings`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Settings className="size-4" />
                {t("timing.configure")}
              </Link>
            </div>
          ))}
        </div>
      )}
      {!query.isPending && !query.isError && totalPages > 1 && (
        <nav
          aria-label={t("timing.selectExam")}
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50"
          >
            {t("timing.previous")}
          </button>
          <span className="text-slate-500">
            {t("timing.page", { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50"
          >
            {t("timing.next")}
          </button>
        </nav>
      )}
    </div>
  );
}
