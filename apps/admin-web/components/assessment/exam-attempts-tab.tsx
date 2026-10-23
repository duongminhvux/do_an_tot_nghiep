"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { examService } from "@/services/assessment.service";

export function ExamAttemptsTab() {
  const { t } = useTranslation("assessment");
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-exam-attempts", id],
    queryFn: () => examService.getAttempts(id),
    enabled: Boolean(id),
    refetchInterval: 30000,
  });
  const result = data?.data;
  const rows = result?.data ?? [];
  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleString(locale === "en" ? "en-US" : "vi-VN")
      : "—";
  const duration = (seconds?: number) =>
    seconds === undefined
      ? "—"
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-bold text-slate-900">
        {t("detailPage.attemptsHistoryTitle", { count: result?.total ?? 0 })}
      </h3>
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          {t("detailPage.loadingAttempts")}
        </div>
      ) : isError ? (
        <div role="alert" className="py-12 text-center text-red-500 text-xs">
          {t("detailPage.attemptsError")}
        </div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                {[
                  "attemptLearner",
                  "attemptModeParts",
                  "attemptStatus",
                  "attemptResult",
                  "attemptSkills",
                  "attemptDuration",
                  "attemptDate",
                ].map((key) => (
                  <th key={key} className="px-3 py-3 font-semibold">
                    {t(`detailPage.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((attempt) => {
                const user =
                  typeof attempt.userId === "object" ? attempt.userId : null;
                const finished =
                  attempt.status === "FINISHED" ||
                  attempt.status === "COMPLETED";
                return (
                  <tr key={attempt._id} className="text-slate-700">
                    <td className="px-3 py-4">
                      <p className="font-semibold">
                        {user?.username ||
                          user?.email ||
                          (typeof attempt.userId === "string"
                            ? attempt.userId
                            : "—")}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p>{attempt.mode || "—"}</p>
                      <p className="mt-1 text-slate-400">
                        {attempt.selectedParts
                          ?.map((part) => `Part ${part}`)
                          .join(" + ") || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {t(`detailPage.attemptStatus_${attempt.status}`)}
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold">
                        {finished
                          ? `${attempt.correctAnswers ?? 0}/${attempt.totalQuestions}`
                          : `${attempt.answeredQuestions}/${attempt.totalQuestions}`}
                      </p>
                      {finished && (
                        <>
                          <p className="mt-1 text-slate-400">
                            {t("detailPage.attemptBreakdown", {
                              wrong: attempt.incorrectAnswers ?? 0,
                              blank: attempt.unansweredQuestions ?? 0,
                            })}
                          </p>
                          <p className="mt-1 text-slate-400">
                            {attempt.partResults
                              ?.map(
                                (part) =>
                                  `P${part.part}: ${part.correct}/${part.total}`,
                              )
                              .join(" · ")}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {finished
                        ? `${attempt.listeningResult?.correct ?? 0}/${attempt.listeningResult?.total ?? 0} · ${attempt.readingResult?.correct ?? 0}/${attempt.readingResult?.total ?? 0}`
                        : "—"}
                    </td>
                    <td className="px-3 py-4 tabular-nums">
                      {duration(attempt.durationSpent)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-slate-500">
                      {formatDate(attempt.submittedAt || attempt.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 text-xs">
          {t("detailPage.noAttemptsDesc")}
        </div>
      )}
    </div>
  );
}
