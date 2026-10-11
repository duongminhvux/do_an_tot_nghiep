"use client";

import { Flame, BookOpen, RotateCcw, Clock } from "lucide-react";
import { StatCardSkeleton } from "./dashboard-feedback";
import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<
  DashboardData,
  "t" | "isOverviewLoading" | "overview" | "formatMinutes"
>;

export function DashboardStats({
  t,
  isOverviewLoading,
  overview,
  formatMinutes,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {isOverviewLoading ? (
        <>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </>
      ) : (
        <>
          {/* Card 1: Chuỗi học */}
          <div className="rounded border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-amber-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 fill-amber-400 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">
                {t("stats.streak")}
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {t("stats.streak_value", {
                  count: overview?.currentStreak ?? 0,
                })}
              </p>
              {typeof overview?.streakGrowth === "number" &&
                overview.streakGrowth > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑</span>
                    <span>
                      {t("stats.streak_growth", {
                        count: overview.streakGrowth,
                      })}
                    </span>
                  </p>
                )}
              {typeof overview?.longestStreak === "number" &&
                overview.longestStreak > 0 && (
                  <p className="text-[11px] font-medium text-slate-400 mt-1">
                    {t("stats.streak_record", {
                      count: overview.longestStreak,
                    })}
                  </p>
                )}
            </div>
          </div>

          {/* Card 2: Tổng từ đã học */}
          <div className="rounded border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">
                {t("stats.words_learned")}
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {t("stats.words_learned_value", {
                  count: (overview?.totalWordsLearned ?? 0).toLocaleString(),
                })}
              </p>
              {typeof overview?.wordsLearnedGrowth === "number" &&
                overview.wordsLearnedGrowth > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑</span>
                    <span>
                      {t("stats.words_learned_growth", {
                        count: overview.wordsLearnedGrowth,
                      })}
                    </span>
                  </p>
                )}
            </div>
          </div>

          {/* Card 3: Tổng từ đã ôn */}
          <div className="rounded border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-purple-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">
                {t("stats.words_reviewed")}
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {t("stats.words_reviewed_value", {
                  count: (overview?.totalWordsReviewed ?? 0).toLocaleString(),
                })}
              </p>
              {typeof overview?.wordsReviewedGrowth === "number" &&
                overview.wordsReviewedGrowth > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑</span>
                    <span>
                      {t("stats.words_reviewed_growth", {
                        count: overview.wordsReviewedGrowth,
                      })}
                    </span>
                  </p>
                )}
            </div>
          </div>

          {/* Card 4: Thời gian học */}
          <div className="rounded border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-sky-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">
                {t("stats.study_time")}
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {overview?.totalStudyMinutes
                  ? formatMinutes(overview.totalStudyMinutes)
                  : "0m"}
              </p>
              {typeof overview?.studyMinutesGrowth === "number" &&
                overview.studyMinutesGrowth > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
                    <span>↑</span>
                    <span>
                      {t("stats.study_time_growth", {
                        time: formatMinutes(overview.studyMinutesGrowth),
                      })}
                    </span>
                  </p>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
