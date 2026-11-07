"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Volume2,
} from "lucide-react";
import { learningService } from "@/services/learning.service";
import {
  PageShell,
  PageHeader,
  EmptyState,
  ErrorState,
} from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSelector } from "@/redux/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import type { WordDetail } from "@/types/vocabulary";

type ViewMode = "cards" | "table";
const VIEW_KEY = "vocabulary-learned-view";

function meanings(word: WordDetail) {
  const list = (word.parts ?? [])
    .flatMap((part) => part.meanings ?? [])
    .flatMap((meaning) =>
      Array.isArray(meaning.translation)
        ? meaning.translation
        : meaning.translation
          ? [meaning.translation]
          : [],
    );
  return (
    [...new Set(list)].join("; ") ||
    word.meaning ||
    (word.parts ?? [])
      .flatMap((p) => p.meanings ?? [])
      .map((m) => m.definition)
      .filter(Boolean)
      .join("; ") ||
    "—"
  );
}
export default function LearnedWordsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation("vocabulary");
  const viewerId = useAppSelector((state) => state.auth.user?._id);
  const [status, setStatus] = useState("ALL"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [page, setPage] = useState(1);
  const [audioError, setAudioError] = useState(false);
  const [view, setView] = useState<ViewMode>("cards");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "cards" || saved === "table") setView(saved);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);
  const chooseView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(
    () => () => {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const query = useQuery({
    queryKey: ["word-library", viewerId, page, status, debounced],
    enabled: !!viewerId,
    queryFn: () =>
      learningService.getWordLibrary({
        page,
        limit: 18,
        status,
        search: debounced || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const data = query.data?.data;
  useEffect(() => {
    if (data && !query.isPlaceholderData && page > data.totalPages)
      setPage(data.totalPages);
  }, [data, page, query.isPlaceholderData]);
  const choose = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const reviewHref =
    status === "DUE" && !debounced
      ? `/${locale}/vocabulary/review`
      : `/${locale}/vocabulary/review?scope=${status}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`;
  const play = (word: WordDetail) => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setAudioError(false);
    const url = word.audio?.us || word.audio?.uk || word.audioUrl;
    if (url) {
      const player = new Audio(url);
      audio.current = player;
      player.play().catch(() => setAudioError(true));
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word.word);
      utterance.lang = "en-US";
      utterance.onerror = () => setAudioError(true);
      window.speechSynthesis.speak(utterance);
    } else setAudioError(true);
  };
  const stats = data?.stats;
  return (
    <PageShell className="mx-auto max-w-7xl">
      <PageHeader
        title={t("library.title")}
        description={t("library.description")}
        icon={BookOpen}
      />
      <nav
        aria-label={t("library.title")}
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-4"
      >
        {[
          ["explore", "vocabulary"],
          ["saved", "vocabulary/my-words"],
          ["learned", "vocabulary/learned"],
        ].map(([key, path]) => (
          <Link
            key={key}
            href={`/${locale}/${path}`}
            aria-current={key === "learned" ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${key === "learned" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-white"}`}
          >
            {t(`library.${key}`)}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { key: "ALL", label: "all", count: stats?.total, icon: BookOpen },
          { key: "DUE", label: "due", count: stats?.due, icon: Clock },
          {
            key: "LEARNING",
            label: "learning",
            count: stats?.learning,
            icon: RotateCcw,
          },
          {
            key: "MASTERED",
            label: "mastered",
            count: stats?.mastered,
            icon: CheckCircle2,
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => choose(item.key)}
            aria-pressed={status === item.key}
            className={`rounded-xl border bg-white p-4 text-left outline-none transition-colors hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 ${status === item.key ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200"}`}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <item.icon aria-hidden="true" className="size-4 shrink-0" />
              {t(`library.${item.label}`)}
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
              {item.count ?? "—"}
            </p>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-slate-400"
          />
          <Input
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("library.search")}
            aria-label={t("library.search")}
            className="h-11 bg-white pl-10"
          />
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
        <div
          role="group"
          aria-label={t("library.viewMode")}
          className="inline-flex h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white p-1"
        >
          {(
            [
              ["cards", LayoutGrid],
              ["table", List],
            ] as const
          ).map(([mode, Icon]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              title={t(`library.view.${mode}`)}
              onClick={() => chooseView(mode)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${view === mode ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className="sr-only md:not-sr-only">{t(`library.view.${mode}`)}</span>
            </button>
          ))}
        </div>
        <Button
          asChild
          disabled={!data?.total || query.isFetching}
          className={
            !data?.total || query.isFetching
              ? "pointer-events-none opacity-50"
              : ""
          }
        >
          <Link
            href={reviewHref}
            aria-disabled={!data?.total || query.isFetching}
            tabIndex={!data?.total || query.isFetching ? -1 : undefined}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {t(status === "DUE" ? "library.review" : "library.relearn")}
          </Link>
        </Button>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        {t("library.batchHelp")}
      </p>
      {audioError && (
        <p role="alert" className="text-sm text-red-700">
          {t("library.audioError")}
        </p>
      )}
      {query.isLoading ? (
        view === "table" ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-60 rounded-xl" />
            ))}
          </div>
        )
      ) : query.isError ? (
        <ErrorState
          message={t("library.error")}
          retryLabel={t("library.retry")}
          onRetry={() => void query.refetch()}
        />
      ) : !data?.items.length ? (
        <EmptyState
          icon={BookOpen}
          title={t(stats?.total ? "library.emptyFilter" : "library.emptyTitle")}
          description={stats?.total ? undefined : t("library.emptyDescription")}
          action={
            stats?.total ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  choose("ALL");
                }}
              >
                {t("library.clear")}
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/${locale}/vocabulary`}>
                  {t("library.explore")}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          {view === "table" ? (
            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <caption className="sr-only">{t("library.title")}</caption>
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <tr>
                      <th scope="col" className="w-[22%] px-4 py-3">{t("library.table.word")}</th>
                      <th scope="col" className="px-4 py-3">{t("library.table.meaning")}</th>
                      <th scope="col" className="w-40 px-4 py-3">{t("library.table.status")}</th>
                      <th scope="col" className="w-24 px-4 py-3 text-right">{t("library.table.reviews")}</th>
                      <th scope="col" className="w-40 px-4 py-3">{t("library.nextReview")}</th>
                      <th scope="col" className="w-32 px-4 py-3 text-right">
                        <span className="sr-only">{t("library.table.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((review) => {
                      const word = review.wordId as WordDetail;
                      const due =
                        !!review.nextReviewAt &&
                        new Date(review.nextReviewAt).getTime() <= Date.now();
                      return (
                        <tr key={review._id} className="align-middle transition-colors hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={t("library.pronounce", { word: word.word })}
                                onClick={() => play(word)}
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-blue-600 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                <Volume2 aria-hidden="true" className="size-4" />
                              </button>
                              <div className="min-w-0">
                                <p className="break-words font-semibold text-slate-900">{word.word}</p>
                                <p className="text-xs text-slate-500">
                                  {word.ipa?.us || word.phonetic || word.level || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <p className="line-clamp-2 leading-6 [overflow-wrap:anywhere]">{meanings(word)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${review.status === "MASTERED" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-700"}`}
                              >
                                {t(review.status === "MASTERED" ? "library.mastered" : "library.learning")}
                              </span>
                              {due && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                  {t("library.due")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {review.reviewCount ?? 0}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                            {review.nextReviewAt
                              ? new Date(review.nextReviewAt).toLocaleString(
                                  locale === "en" ? "en-US" : "vi-VN",
                                  { dateStyle: "short", timeStyle: "short" },
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button asChild variant="outline" size="sm" className="min-h-9">
                              <Link
                                href={`/${locale}/vocabulary/review?wordId=${encodeURIComponent(word._id)}`}
                                aria-label={t("library.relearnLabel", { word: word.word })}
                              >
                                {t("library.relearnWord")}
                                <ArrowRight aria-hidden="true" className="size-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((review) => {
              const word = review.wordId as WordDetail;
              const due =
                !!review.nextReviewAt &&
                new Date(review.nextReviewAt).getTime() <= Date.now();
              return (
                <article
                  key={review._id}
                  className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-bold text-slate-900">
                        {word.word}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {word.ipa?.us || word.phonetic || word.level || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t("library.pronounce", { word: word.word })}
                      onClick={() => play(word)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-blue-600 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Volume2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${review.status === "MASTERED" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-700"}`}
                    >
                      {t(
                        review.status === "MASTERED"
                          ? "library.mastered"
                          : "library.learning",
                      )}
                    </span>
                    {due && (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        {t("library.due")}
                      </span>
                    )}
                  </div>
                  <p className="my-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                    {meanings(word)}
                  </p>
                  <div className="space-y-1 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                    <p>
                      {t("library.reviewed", { count: review.reviewCount })}
                    </p>
                    <p>
                      {t("library.nextReview")}:{" "}
                      {review.nextReviewAt
                        ? new Date(review.nextReviewAt).toLocaleString(
                            locale === "en" ? "en-US" : "vi-VN",
                          )
                        : "—"}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="mt-4 min-h-11">
                    <Link
                      href={`/${locale}/vocabulary/review?wordId=${encodeURIComponent(word._id)}`}
                      aria-label={t("library.relearnLabel", {
                        word: word.word,
                      })}
                    >
                      {t("library.relearnWord")}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </Button>
                </article>
              );
            })}
          </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">
              {t("library.count", { count: data.total })}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage(page - 1)}
              >
                {t("library.previous")}
              </Button>
              <span className="text-xs tabular-nums text-slate-600">
                {t("library.page", { page, total: data.totalPages })}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.totalPages || query.isFetching}
                onClick={() => setPage(page + 1)}
              >
                {t("library.next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
