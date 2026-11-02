"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorState, surface } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { toeicCommunityService } from "@/services/toeic-community.service";

export function ExamLeaderboard({
  examId,
  viewerId,
}: {
  examId: string;
  viewerId?: string;
}) {
  const { t, i18n } = useTranslation("toeic");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["toeic-leaderboard", examId, viewerId, page],
    queryFn: () => toeicCommunityService.leaderboard(examId, page),
    enabled: !!examId && !!viewerId,
    staleTime: 15000,
  });
  const data = query.data;
  return (
    <section className={cn(surface, "overflow-hidden")}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          {t("community.rankingTitle")}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {t("community.rankingRule")}
        </p>
      </div>
      {!viewerId ? (
        <p className="p-5 text-sm text-slate-500">{t("community.login")}</p>
      ) : query.isPending ? (
        <div
          role="status"
          aria-label={t("community.loading")}
          className="m-5 h-40 animate-pulse rounded-lg bg-slate-100"
        />
      ) : query.isError ? (
        <div className="p-5">
          <ErrorState
            message={t("community.loadError")}
            onRetry={() => void query.refetch()}
            retryLabel={t("community.retry")}
          />
        </div>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-sm">
              <span className="text-slate-500">
                {t("community.participants", { count: data.total })}
              </span>
              <span className="font-medium text-blue-700">
                {data.mine
                  ? t("community.myRank", {
                      rank: data.mine.rank,
                      correct: data.mine.correct,
                      total: data.mine.total,
                    })
                  : t("community.unranked")}
              </span>
            </div>
            {!data.items.length ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                {t("community.rankingEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      {[
                        "rank",
                        "learner",
                        "result",
                        "score",
                        "duration",
                        "completed",
                      ].map((key) => (
                        <th
                          key={key}
                          scope="col"
                          className={cn(
                            "whitespace-nowrap px-4 py-2.5 font-medium first:pl-5 last:pr-5",
                            ["result", "score", "duration"].includes(key) &&
                              "text-right",
                          )}
                        >
                          {t(`community.columns.${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((row) => (
                      <tr
                        key={row.userId}
                        className={cn(
                          "transition-colors hover:bg-slate-50",
                          row.isMe && "bg-blue-50/70 hover:bg-blue-50",
                        )}
                      >
                        <td className="py-2.5 pl-5 pr-4">
                          <span
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                              row.rank === 1
                                ? "bg-amber-100 text-amber-700"
                                : row.rank === 2
                                  ? "bg-slate-200 text-slate-700"
                                  : row.rank === 3
                                    ? "bg-orange-100 text-orange-700"
                                    : "text-slate-500",
                            )}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="max-w-[14rem] px-4 py-2.5">
                          <span className="block truncate font-medium text-slate-800">
                            {row.username ?? t("community.learner")}
                            {row.isMe && (
                              <span className="ml-1.5 text-xs font-medium text-blue-700">
                                ({t("community.you")})
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                          {row.correct}/{row.total}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
                          {row.estimatedScore ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-500 tabular-nums">
                          {Math.floor(row.durationSpent / 60)}:
                          {String(row.durationSpent % 60).padStart(2, "0")}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pl-4 pr-5 text-slate-500">
                          {new Date(row.completedAt).toLocaleDateString(
                            i18n.language === "en" ? "en-GB" : "vi-VN",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("community.previous")}
              </Button>
              <span className="text-sm text-slate-500 tabular-nums">
                {page}/{Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("community.next")}
              </Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
