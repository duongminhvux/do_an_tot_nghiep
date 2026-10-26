"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MistakeItem, MistakeSource } from "@repo/shared-types/mistakes";
import { mistakesService } from "@/services/mistakes.service";
import { useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";

export default function MistakesPage() {
  const { t } = useTranslation("common");
  const { locale = "vi" } = useParams<{ locale: string }>();
  const { user } = useAppSelector((state) => state.auth);
  const [source, setSource] = useState<MistakeSource | "">("");
  const [status, setStatus] = useState<"" | "PENDING" | "REVIEWED">("");
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
        limit: 20,
      }),
    enabled: !!user,
    staleTime: 0,
  });
  return (
    <PageShell>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("mistakes.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("mistakes.description")}
        </p>
        <p className="mt-3 font-semibold text-blue-700">
          {t("mistakes.pendingCount", { count: query.data?.pending ?? 0 })}
        </p>
      </div>
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div
          className="flex gap-2 overflow-x-auto"
          aria-label={t("mistakes.filterSource")}
        >
          {(["", "TOEIC", "DICTATION", "VOCABULARY"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={source === value ? "secondary" : "ghost"}
              aria-pressed={source === value}
              onClick={() => {
                setSource(value);
                setPage(1);
              }}
            >
              {t(`mistakes.${value || "all"}`)}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <input
            aria-label={t("mistakes.search")}
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("mistakes.search")}
            className="min-w-0 flex-1 rounded-lg border p-2"
          />
          <select
            aria-label={t("mistakes.filterStatus")}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border p-2"
          >
            {["", "PENDING", "REVIEWED"].map((value) => (
              <option key={value} value={value}>
                {t(`mistakes.${value || "allStatuses"}`)}
              </option>
            ))}
          </select>
          <Button type="submit">{t("mistakes.search")}</Button>
        </form>
      </div>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("mistakes.loading")}
          className="h-60 animate-pulse rounded-xl bg-slate-100"
        />
      )}
      {query.isError && (
        <div role="alert">
          <p>{t("mistakes.error")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("mistakes.retry")}
          </Button>
        </div>
      )}
      {query.isSuccess && (
        <>
          {!query.data.items.length ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p>{t("mistakes.empty")}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/${locale}`}>{t("mistakes.goLearn")}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {query.data.items.map((item) => (
                <MistakeCard
                  key={`${user?._id}:${item.id}`}
                  item={item}
                  locale={locale}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              {t("mistakes.total", { count: query.data.total })} ·{" "}
              {t("mistakes.page", { page })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                {t("mistakes.previous")}
              </Button>
              <Button
                variant="outline"
                disabled={page * 20 >= query.data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("mistakes.next")}
              </Button>
            </div>
          </div>
        </>
      )}
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
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-blue-700">
          {t(`mistakes.${item.sourceType}`)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
          {t(`mistakes.${item.status}`)}
        </span>
      </div>
      <h2 className="break-words font-semibold text-slate-900">{item.title}</h2>
      <p className="text-sm text-slate-500">
        {t("mistakes.wrongCount", { count: item.wrongCount })} ·{" "}
        {new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(item.lastWrongAt))}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {t("mistakes.explain")}
        </Button>
        <Button
          disabled={detail.isFetching || Boolean(detail.data && !detail.data.actionUrl)}
          onClick={() => {
            setExpanded(true);
            void detail.refetch().then((result) => {
              if (result.data?.available && result.data.actionUrl)
                router.push(`/${locale}${result.data.actionUrl}`);
            });
          }}
        >
          {t("mistakes.practice")}
        </Button>
        <Button
          variant="secondary"
          disabled={item.status === "REVIEWED" || review.isPending}
          onClick={() => review.mutate()}
        >
          {t(review.isPending ? "mistakes.saving" : "mistakes.markReviewed")}
        </Button>
      </div>
      {review.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t("mistakes.saveError")}
        </p>
      )}
      {review.isSuccess && (
        <p role="status" className="text-sm text-green-700">
          {t("mistakes.saved")}
        </p>
      )}
      {expanded && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-4">
          {detail.isPending && <p role="status">{t("mistakes.loading")}</p>}
          {detail.isError && (
            <div role="alert">
              <p>{t("mistakes.error")}</p>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                {t("mistakes.retry")}
              </Button>
            </div>
          )}
          {detail.data &&
            (!detail.data.available ? (
              <p>{t("mistakes.unavailable")}</p>
            ) : (
              <>
                {detail.data.correctAnswer && (
                  <p className="text-sm">
                    <strong>{t("mistakes.correctAnswer")}: </strong>
                    {detail.data.correctAnswer}
                    {detail.data.selectedAnswer && (
                      <>
                        {" "}
                        · {t("mistakes.yourAnswer")}:{" "}
                        {detail.data.selectedAnswer}
                      </>
                    )}
                  </p>
                )}
                <p className="whitespace-pre-line break-words text-sm text-slate-700">
                  {detail.data.explanation || t("mistakes.noExplanation")}
                </p>
                {!detail.data.actionUrl && <p className="text-sm text-slate-500">{t('mistakes.practiceUnavailable')}</p>}
                <div className="flex flex-wrap gap-2">
                  {detail.data.actionUrl && (
                    <Button asChild>
                      <Link href={`/${locale}${detail.data.actionUrl}`}>
                        {t("mistakes.practice")}
                      </Link>
                    </Button>
                  )}
                  {detail.data.reviewUrl && (
                    <Button asChild variant="outline">
                      <Link href={`/${locale}${detail.data.reviewUrl}`}>
                        {t("mistakes.viewSource")}
                      </Link>
                    </Button>
                  )}
                </div>
              </>
            ))}
        </div>
      )}
    </article>
  );
}
