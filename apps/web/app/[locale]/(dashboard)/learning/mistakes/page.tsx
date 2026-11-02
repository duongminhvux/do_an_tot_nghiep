"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileCheck2,
  Headphones,
  Loader2,
  NotebookPen,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { MistakeItem, MistakeSource } from "@repo/shared-types/mistakes";
import { mistakesService } from "@/services/mistakes.service";
import { useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Segmented,
  surface,
} from "@/components/ui/page";
import { cn } from "@/lib/utils";

const LIMIT = 20;
// Same icon and tint as the module cards on the home page.
const SOURCE_META: Record<MistakeSource, { icon: LucideIcon; tone: string }> = {
  TOEIC: { icon: FileCheck2, tone: "bg-emerald-50 text-emerald-600" },
  DICTATION: { icon: Headphones, tone: "bg-violet-50 text-violet-600" },
  VOCABULARY: { icon: BookOpen, tone: "bg-blue-50 text-blue-600" },
};
type StatusFilter = "" | "PENDING" | "REVIEWED";

export default function MistakesPage() {
  const { t } = useTranslation("common");
  const { locale = "vi" } = useParams<{ locale: string }>();
  const { user } = useAppSelector((state) => state.auth);
  const [source, setSource] = useState<MistakeSource | "">("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["mistakes", user?._id, source, status, search, page],
    queryFn: () =>
      mistakesService.list({
        source: source || undefined,
        status: status || undefined,
        q: search || undefined,
        page,
        limit: LIMIT,
      }),
    enabled: !!user,
    staleTime: 0,
  });
  const filtered = Boolean(source || status || search);
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / LIMIT));

  // Marking the last pending item of a page as reviewed empties that page
  // under the "pending" filter; step back instead of showing a false empty state.
  useEffect(() => {
    if (query.data && !query.data.items.length && page > 1) setPage(totalPages);
  }, [query.data, page, totalPages]);

  const clearFilters = () => {
    setSource("");
    setStatus("");
    setDraft("");
    setSearch("");
    setPage(1);
  };

  return (
    <PageShell>
      <PageHeader
        icon={NotebookPen}
        title={t("mistakes.title")}
        description={t("mistakes.description")}
        actions={
          query.data && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 tabular-nums">
              <span className="size-2 rounded-full bg-amber-500" aria-hidden />
              {t("mistakes.pendingCount", { count: query.data.pending })}
            </span>
          )
        }
      />

      <div className={cn(surface, "space-y-3 p-3 sm:p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label={t("mistakes.filterSource")}
            className="max-w-full overflow-x-auto scrollbar-none"
          >
            <Segmented
              items={(["", "TOEIC", "DICTATION", "VOCABULARY"] as const).map((value) => ({
                value,
                label: t(`mistakes.${value || "all"}`),
              }))}
              value={source}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
            />
          </div>
          <div role="group" aria-label={t("mistakes.filterStatus")}>
            <Segmented
              items={(["", "PENDING", "REVIEWED"] as const).map((value) => ({
                value,
                label: t(`mistakes.${value || "all"}`),
              }))}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("mistakes.search")}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={draft}
              maxLength={100}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("mistakes.searchPlaceholder")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <Button type="submit" variant="outline" className="h-10">
            {t("mistakes.search")}
          </Button>
        </form>
      </div>

      {query.isPending && (
        <div role="status" aria-label={t("mistakes.loading")} className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className={cn(surface, "flex gap-4 p-5")}>
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}
      {query.isError && (
        <ErrorState
          message={t("mistakes.error")}
          onRetry={() => void query.refetch()}
          retryLabel={t("mistakes.retry")}
        />
      )}
      {query.isSuccess &&
        (!query.data.items.length ? (
          filtered ? (
            <EmptyState
              icon={Search}
              title={t("mistakes.emptyFiltered")}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {t("mistakes.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={NotebookPen}
              title={t("mistakes.empty")}
              action={
                <Button asChild>
                  <Link href={`/${locale}`}>{t("mistakes.goLearn")}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="space-y-3">
              {query.data.items.map((item) => (
                <li key={`${user?._id}:${item.id}`}>
                  <MistakeCard item={item} locale={locale} />
                </li>
              ))}
            </ul>
            <nav
              aria-label={t("mistakes.page", { page })}
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <span className="text-slate-500 tabular-nums">
                {t("mistakes.total", { count: query.data.total })} ·{" "}
                {t("mistakes.page", { page })}/{totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("mistakes.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("mistakes.next")}
                </Button>
              </div>
            </nav>
          </>
        ))}
    </PageShell>
  );
}

function MistakeCard({ item, locale }: { item: MistakeItem; locale: string }) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAppSelector((state) => state.auth);
  const [expanded, setExpanded] = useState(false);
  const detail = useQuery({
    queryKey: ["mistake-detail", user?._id, item.id, item.wrongCount],
    queryFn: () => mistakesService.detail(item.id),
    enabled: expanded,
    staleTime: 0,
  });
  const review = useMutation({
    mutationFn: () => mistakesService.markReviewed(item.id, item.wrongCount),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["mistakes", user?._id] }),
  });
  const meta = SOURCE_META[item.sourceType];
  const Icon = meta.icon;
  const pending = item.status === "PENDING";
  const panelId = `mistake-detail-${item.id}`;

  return (
    <article className={cn(surface, "p-4 sm:p-5")}>
      <div className="flex gap-4">
        <span
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", meta.tone)}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-slate-600">{t(`mistakes.${item.sourceType}`)}</span>
            <Badge tone={pending ? "amber" : "emerald"}>
              {!pending && <Check className="size-3" aria-hidden />}
              {t(`mistakes.${item.status}`)}
            </Badge>
          </div>
          <h2 className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-[15px] font-semibold leading-snug text-slate-900">
            {item.title}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-medium text-red-600 tabular-nums">
              {t("mistakes.wrongCount", { count: item.wrongCount })}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={item.lastWrongAt}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(item.lastWrongAt))}
            </time>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={detail.isFetching || Boolean(detail.data && !detail.data.actionUrl)}
              onClick={() => {
                setExpanded(true);
                void detail.refetch().then((result) => {
                  if (result.data?.available && result.data.actionUrl)
                    router.push(`/${locale}${result.data.actionUrl}`);
                });
              }}
            >
              {detail.isFetching ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {t("mistakes.practice")}
            </Button>
            {pending && (
              <Button
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate()}
              >
                {review.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                {t(review.isPending ? "mistakes.saving" : "mistakes.markReviewed")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((value) => !value)}
              className="ml-auto"
            >
              {t(expanded ? "mistakes.hideExplain" : "mistakes.explain")}
              <ChevronDown
                className={cn("transition-transform duration-200", expanded && "rotate-180")}
                aria-hidden
              />
            </Button>
          </div>
          {review.isError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {t("mistakes.saveError")}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:ml-14"
        >
          {detail.isPending && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("mistakes.loading")}
            </p>
          )}
          {detail.isError && (
            <ErrorState
              message={t("mistakes.error")}
              onRetry={() => void detail.refetch()}
              retryLabel={t("mistakes.retry")}
            />
          )}
          {detail.data &&
            (!detail.data.available ? (
              <p className="text-sm text-slate-500">{t("mistakes.unavailable")}</p>
            ) : (
              <>
                {detail.data.correctAnswer && (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-100">
                      {t("mistakes.correctAnswer")}:
                      <strong>{detail.data.correctAnswer}</strong>
                    </span>
                    {detail.data.selectedAnswer && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-red-800 ring-1 ring-inset ring-red-100">
                        {t("mistakes.yourAnswer")}:
                        <strong>{detail.data.selectedAnswer}</strong>
                      </span>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
                  {detail.data.explanation || t("mistakes.noExplanation")}
                </p>
                {!detail.data.actionUrl && (
                  <p className="text-xs text-slate-500">{t("mistakes.practiceUnavailable")}</p>
                )}
                {detail.data.reviewUrl && (
                  <Link
                    href={`/${locale}${detail.data.reviewUrl}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {t("mistakes.viewSource")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </>
            ))}
        </div>
      )}
    </article>
  );
}
