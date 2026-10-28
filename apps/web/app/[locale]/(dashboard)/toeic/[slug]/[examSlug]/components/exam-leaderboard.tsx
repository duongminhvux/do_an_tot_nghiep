"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { surface } from "@/components/ui/page";
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
        <h2 className="font-semibold text-slate-900">
          {t("community.rankingTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("community.rankingRule")}
        </p>
      </div>
      {!viewerId ? (
        <p className="p-5 text-sm">{t("community.login")}</p>
      ) : query.isPending ? (
        <div
          role="status"
          aria-label={t("community.loading")}
          className="m-5 h-40 animate-pulse rounded bg-slate-100"
        />
      ) : query.isError ? (
        <div role="alert" className="p-5">
          <p>{t("community.loadError")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("community.retry")}
          </Button>
        </div>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap justify-between gap-2 bg-blue-50 px-5 py-3 text-sm">
              <span>{t("community.participants", { count: data.total })}</span>
              <span>
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
              <p className="p-6 text-sm text-slate-500">
                {t("community.rankingEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
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
                          className="whitespace-nowrap p-3"
                        >
                          {t(`community.columns.${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr
                        key={row.userId}
                        className={cn(
                          "border-t border-slate-100",
                          row.isMe && "bg-blue-50",
                        )}
                      >
                        <td className="p-3 font-semibold">#{row.rank}</td>
                        <td className="p-3">
                          {row.username ?? t("community.learner")}
                          {row.isMe && (
                            <span className="ml-2 text-blue-700">
                              ({t("community.you")})
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {row.correct}/{row.total}
                        </td>
                        <td className="p-3">{row.estimatedScore ?? "—"}</td>
                        <td className="whitespace-nowrap p-3">
                          {Math.floor(row.durationSpent / 60)}:
                          {String(row.durationSpent % 60).padStart(2, "0")}
                        </td>
                        <td className="whitespace-nowrap p-3">
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
            <div className="flex items-center justify-end gap-3 border-t p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("community.previous")}
              </Button>
              <span className="text-sm">
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
