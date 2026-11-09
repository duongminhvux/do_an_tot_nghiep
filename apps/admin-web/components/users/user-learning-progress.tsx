"use client";
import {
  Activity,
  BookOpen,
  FileCheck2,
  Gamepad2,
  Headphones,
  Trophy,
  Clock,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UserItem, UserModuleProgress } from "@/types/user";
import { useListPagination } from "@/hooks/use-list-pagination";
import { ListPagination } from "@/components/ui/list-pagination";
const definitions = [
  { key: "VOCABULARY", icon: BookOpen, color: "bg-blue-50 text-blue-700" },
  { key: "TOEIC", icon: FileCheck2, color: "bg-indigo-50 text-indigo-700" },
  {
    key: "DICTATION",
    icon: Headphones,
    color: "bg-emerald-50 text-emerald-700",
  },
  { key: "ARENA", icon: Trophy, color: "bg-amber-50 text-amber-700" },
  { key: "MINIGAME", icon: Gamepad2, color: "bg-violet-50 text-violet-700" },
] as const;
export function UserLearningProgress({ user }: { user: UserItem }) {
  const { t, i18n } = useTranslation("users");
  const locale = i18n.language.startsWith("en") ? "en-US" : "vi-VN";
  const format = (value: number | null | undefined) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          value,
        );
  const summary = user.moduleProgress?.summary;
  const courses = useListPagination(user.courses || [], user.id);
  const date = (value?: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : null;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          {t("detail.modules.title")}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {t("detail.modules.description")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "totalXp", icon: Sparkles, value: summary?.totalXp },
          {
            key: "activityCount",
            icon: Activity,
            value: summary?.activityCount,
          },
          {
            key: "activeMinutes",
            icon: Clock,
            value: summary ? Math.round(summary.activeSeconds / 60) : null,
          },
        ].map(({ key, icon: Icon, value }) => (
          <div
            key={key}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon aria-hidden="true" className="size-4" />
              {t(`detail.modules.${key}`)}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {format(value)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        {t("detail.modules.summaryHelp")}
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {definitions.map(({ key, icon: Icon, color }) => {
          const progress: UserModuleProgress | undefined =
            user.moduleProgress?.modules.find((item) => item.key === key);
          const unavailable = !progress || progress.state === "unavailable";
          const last = date(progress?.lastActivityAt);
          return (
            <section
              key={key}
              aria-label={t(`detail.modules.names.${key}`)}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${color}`}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {t(`detail.modules.names.${key}`)}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(`detail.modules.descriptions.${key}`)}
                  </p>
                </div>
              </div>
              {unavailable ? (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {t("detail.modules.unavailable")}
                </p>
              ) : (
                <>
                  <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
                    {progress.metrics.map((metric) => (
                      <div key={metric.key} className="min-w-0">
                        <dt className="text-xs leading-5 text-slate-500">
                          {t(`detail.modules.metrics.${metric.key}`)}
                        </dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                          {format(metric.value)}
                          {metric.percent && metric.value != null ? "%" : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                    {last
                      ? t("detail.modules.lastActivity", { date: last })
                      : t("detail.modules.noActivity")}
                  </p>
                </>
              )}
            </section>
          );
        })}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-slate-900">
          {t("detail.modules.vocabCourses")}
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          {t("detail.modules.vocabCoursesHelp")}
        </p>
        {!courses.items.length ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            {t("detail.no_enrolled_courses")}
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {courses.items.map((course) => (
              <div key={course.id}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">
                    {course.title}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {t("detail.modules.courseRatio", {
                      completed: course.completedItems,
                      total: course.totalItems,
                    })}{" "}
                    · {course.percentage}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={course.title}
                  aria-valuenow={course.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.max(0, Math.min(100, course.percentage))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <ListPagination pagination={courses} />
          </div>
        )}
      </section>
    </div>
  );
}
