"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
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
import type { UserWordReviewItem } from "@/types/learning";

type ViewMode = "cards" | "table";
type Status = "ALL" | "DUE" | "LEARNING" | "MASTERED";
const VIEW_KEY = "vocabulary-learned-view";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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

/** "hôm qua", "sau 2 ngày", "3 giờ trước"… relative to now. */
function relativeTime(iso: string, locale: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "vi", {
    numeric: "auto",
  });
  const abs = Math.abs(diff);
  const text =
    abs < HOUR
      ? rtf.format(Math.round(diff / MINUTE), "minute")
      : abs < DAY
        ? rtf.format(Math.round(diff / HOUR), "hour")
        : rtf.format(Math.round(diff / DAY), "day");
  // Always used mid-sentence ("Đến hạn hôm qua"), so never capitalised.
  return text.toLocaleLowerCase(locale === "en" ? "en" : "vi");
}

function absoluteTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isDue(review: UserWordReviewItem) {
  return (
    !!review.nextReviewAt &&
    new Date(review.nextReviewAt).getTime() <= Date.now()
  );
}

export default function LearnedWordsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { t } = useTranslation("vocabulary");
  const viewerId = useAppSelector((state) => state.auth.user?._id);
  const [status, setStatus] = useState<Status>("ALL"),
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
  const choose = (value: Status) => {
    setStatus(value);
    setPage(1);
  };
  const practiceHref = `/${locale}/vocabulary/review?scope=${status}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`;
  const wordHref = (id: string) =>
    `/${locale}/vocabulary/review?wordId=${encodeURIComponent(id)}`;
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
  const hasWords = !!stats?.total;
  const practiceDisabled = !data?.total || query.isFetching;

  /** One line that tells the learner when this word comes back. */
  const schedule = (review: UserWordReviewItem) => {
    if (!review.nextReviewAt) return t("library.notScheduled");
    const time = relativeTime(review.nextReviewAt, locale);
    return isDue(review)
      ? t("library.dueAt", { time })
      : t("library.nextAt", { time });
  };

  const statusBadges = (review: UserWordReviewItem, compact = false) => {
    const pad = compact ? "px-2 py-0.5" : "px-2 py-1";
    return (
      <>
        <span
          className={`rounded-md ${pad} text-xs font-semibold ${review.status === "MASTERED" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-700"}`}
        >
          {t(
            review.status === "MASTERED"
              ? "library.mastered"
              : "library.learning",
          )}
        </span>
        {isDue(review) && (
          <span
            className={`rounded-md bg-amber-50 ${pad} text-xs font-semibold text-amber-800`}
          >
            {t("library.due")}
          </span>
        )}
      </>
    );
  };

  const filters: { key: Status; count?: number }[] = [
    { key: "ALL", count: stats?.total },
    { key: "DUE", count: stats?.due },
    { key: "LEARNING", count: stats?.learning },
    { key: "MASTERED", count: stats?.mastered },
  ];
  const filterLabel: Record<Status, string> = {
    ALL: "library.all",
    DUE: "library.due",
    LEARNING: "library.learning",
    MASTERED: "library.mastered",
  };

  const masteredPct = stats?.total
    ? Math.round((stats.mastered / stats.total) * 100)
    : 0;

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

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : (
        hasWords &&
        stats && (
          <section
            aria-label={t("library.overview")}
            className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
          >
            {/* What to do now: review the words that are due. */}
            {stats.due > 0 ? (
              <div className="flex flex-col justify-between gap-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:flex-row sm:items-end sm:p-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    <Clock aria-hidden="true" className="size-4" />
                    {t("library.todayEyebrow")}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900">
                    {t("library.dueTitle", { count: stats.due })}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                    {t(
                      stats.due > 50
                        ? "library.dueHelpBatch"
                        : "library.dueHelp",
                    )}
                  </p>
                </div>
                <Button asChild size="lg" className="min-h-11 shrink-0">
                  <Link href={`/${locale}/vocabulary/review`}>
                    <RotateCcw aria-hidden="true" className="size-4" />
                    {t("library.dueCta", { count: Math.min(stats.due, 50) })}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-end sm:p-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    <CalendarCheck aria-hidden="true" className="size-4" />
                    {t("library.todayEyebrow")}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900">
                    {t("library.doneTitle")}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                    {stats.nextDueAt ? (
                      <span title={absoluteTime(stats.nextDueAt, locale)}>
                        {t("library.doneNext", {
                          time: relativeTime(stats.nextDueAt, locale),
                        })}
                      </span>
                    ) : (
                      t("library.doneNone")
                    )}
                  </p>
                </div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-11 shrink-0 bg-white"
                >
                  <Link href={`/${locale}/vocabulary`}>
                    {t("library.learnMore")}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Long-term progress: how many learned words are already mastered. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("library.progressTitle")}
              </p>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {t("library.progressTotal", { count: stats.total })}
              </p>
              <div
                role="img"
                aria-label={t("library.progressAria", {
                  mastered: stats.mastered,
                  total: stats.total,
                })}
                className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-blue-100"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none"
                  style={{ width: `${masteredPct}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="flex items-center gap-2 text-slate-500">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full bg-blue-300"
                    />
                    {t("library.learning")}
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                    {stats.learning}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-slate-500">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full bg-emerald-500"
                    />
                    {t("library.mastered")}
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                    {stats.mastered}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        )
      )}

      {(query.isLoading || hasWords) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="group"
            aria-label={t("library.filterLabel")}
            className="flex flex-wrap gap-2"
          >
            {filters.map((item) => {
              const active = status === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => choose(item.key)}
                  aria-pressed={active}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                >
                  {t(filterLabel[item.key])}
                  <span
                    className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20 text-white" : item.key === "DUE" && item.count ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {item.count ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
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
            <div className="flex items-center gap-2">
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
                    <span className="sr-only">{t(`library.view.${mode}`)}</span>
                  </button>
                ))}
              </div>
              <Button
                asChild
                variant="outline"
                disabled={practiceDisabled}
                className={`min-h-11 flex-1 bg-white sm:flex-none ${practiceDisabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <Link
                  href={practiceHref}
                  title={t("library.batchHelp")}
                  aria-disabled={practiceDisabled}
                  tabIndex={practiceDisabled ? -1 : undefined}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  {t("library.relearn")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

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
              <Skeleton key={i} className="h-52 rounded-xl" />
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
          icon={status === "DUE" && hasWords && !debounced ? CheckCircle2 : BookOpen}
          title={t(
            !hasWords
              ? "library.emptyTitle"
              : status === "DUE" && !debounced
                ? "library.emptyDue"
                : "library.emptyFilter",
          )}
          description={hasWords ? undefined : t("library.emptyDescription")}
          action={
            hasWords ? (
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
                      <th scope="col" className="w-[22%] px-4 py-3">
                        {t("library.table.word")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("library.table.meaning")}
                      </th>
                      <th scope="col" className="w-44 px-4 py-3">
                        {t("library.table.status")}
                      </th>
                      <th scope="col" className="w-24 px-4 py-3 text-right">
                        {t("library.table.reviews")}
                      </th>
                      <th scope="col" className="w-40 px-4 py-3">
                        {t("library.nextReview")}
                      </th>
                      <th scope="col" className="w-32 px-4 py-3 text-right">
                        <span className="sr-only">
                          {t("library.table.actions")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((review) => {
                      const word = review.wordId as WordDetail;
                      const due = isDue(review);
                      return (
                        <tr
                          key={review._id}
                          className="align-middle transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={t("library.pronounce", {
                                  word: word.word,
                                })}
                                onClick={() => play(word)}
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-blue-600 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                <Volume2 aria-hidden="true" className="size-4" />
                              </button>
                              <div className="min-w-0">
                                <p className="break-words font-semibold text-slate-900">
                                  {word.word}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {word.ipa?.us || word.phonetic || word.level || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <p className="line-clamp-2 leading-6 [overflow-wrap:anywhere]">
                              {meanings(word)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {statusBadges(review, true)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {review.reviewCount ?? 0}
                          </td>
                          <td
                            className={`px-4 py-3 text-xs ${due ? "font-medium text-amber-800" : "text-slate-600"}`}
                            title={
                              review.nextReviewAt
                                ? absoluteTime(review.nextReviewAt, locale)
                                : undefined
                            }
                          >
                            {schedule(review)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              asChild
                              variant={due ? "default" : "outline"}
                              size="sm"
                              className="min-h-9"
                            >
                              <Link
                                href={wordHref(word._id)}
                                aria-label={t("library.relearnLabel", {
                                  word: word.word,
                                })}
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
                const due = isDue(review);
                return (
                  <article
                    key={review._id}
                    className={`flex min-w-0 flex-col rounded-xl border bg-white p-5 shadow-xs ${due ? "border-amber-200" : "border-slate-200"}`}
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadges(review)}
                    </div>
                    <p className="my-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                      {meanings(word)}
                    </p>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs leading-5">
                      <p
                        className={`flex min-w-0 items-center gap-1.5 ${due ? "font-medium text-amber-800" : "text-slate-600"}`}
                        title={
                          review.nextReviewAt
                            ? absoluteTime(review.nextReviewAt, locale)
                            : undefined
                        }
                      >
                        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="truncate">{schedule(review)}</span>
                      </p>
                      <p className="shrink-0 text-slate-500">
                        {t("library.reviewed", { count: review.reviewCount ?? 0 })}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant={due ? "default" : "outline"}
                      className="mt-4 min-h-11"
                    >
                      <Link
                        href={wordHref(word._id)}
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
