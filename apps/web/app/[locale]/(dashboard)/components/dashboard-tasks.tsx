"use client";

import Link from "next/link";
import { BookOpen, RotateCcw, ArrowRight, Target } from "lucide-react";

import type { DashboardData } from "../hooks/use-dashboard-data";
import { DashboardQuote } from "./dashboard-quote";

type Props = Pick<
  DashboardData,
  | "locale"
  | "t"
  | "isTasksLoading"
  | "todayTasks"
  | "dailyGoal"
  | "todayLearnedCount"
  | "dailyGoalPct"
  | "handleStartReview"
  | "handleStartLesson"
>;

export function DashboardTasks({
  locale,
  t,
  isTasksLoading,
  todayTasks,
  dailyGoal,
  todayLearnedCount,
  dailyGoalPct,
  handleStartReview,
  handleStartLesson,
}: Props) {
  return (
    <>
      {isTasksLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="h-6 w-72 bg-slate-100 rounded-md animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="h-40 rounded border border-slate-100 bg-slate-50 animate-pulse" />
              <div className="h-40 rounded border border-slate-100 bg-slate-50 animate-pulse" />
            </div>
          </div>
          <div className="rounded border border-amber-200/60 bg-amber-50/30 p-6 shadow-xs animate-pulse">
            <div className="h-5 w-4/5 bg-amber-100 rounded-md" />
            <div className="h-4 w-3/5 bg-amber-100 rounded-md mt-3" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Khối Trái: Nhiệm vụ học tập hôm nay (chiếm 2 cột) */}
          <div className="lg:col-span-2 rounded border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t("tasks.title", { count: todayTasks?.tasksCount ?? 0 })}
              </h2>
            </div>

            {/* Daily goal progress (real data) */}
            {dailyGoal > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">
                    {t("tasks.goal_label")}
                  </span>
                  <span className="text-slate-700 font-semibold">
                    {t("tasks.goal_value", {
                      learned: todayLearnedCount.toLocaleString(),
                      goal: dailyGoal.toLocaleString(),
                    })}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dailyGoalPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Nhiệm vụ 1: Ôn tập từ vựng */}
              <div className="rounded border border-emerald-100 bg-emerald-50/40 p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {t("tasks.review_title")}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {t("tasks.review_desc", {
                        count: (
                          todayTasks?.wordsToReview ?? 0
                        ).toLocaleString(),
                      })}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartReview}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
                >
                  <span>{t("tasks.start_now")}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Nhiệm vụ 2: Học bài mới */}
              <div className="rounded border border-blue-100 bg-blue-50/40 p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">
                      {t("tasks.new_title")}
                    </h3>
                    {todayTasks?.currentLesson ? (
                      <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                        {todayTasks.currentLesson.title} -{" "}
                        {todayTasks.currentLesson.collectionName ||
                          t("tasks.course_fallback")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {t("tasks.new_empty")}
                      </p>
                    )}
                  </div>
                </div>

                {todayTasks?.currentLesson ? (
                  <button
                    type="button"
                    onClick={handleStartLesson}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
                  >
                    <span>{t("tasks.start_now")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={`/${locale}/vocabulary`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs sm:text-sm transition-colors"
                  >
                    <span>{t("tasks.go_to_vocab")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Khối Phải: Card Động Lực (Quote Card) */}
          <DashboardQuote t={t} />
        </div>
      )}
    </>
  );
}
