"use client";

import Link from "next/link";
import { Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { PanelSkeleton } from "./dashboard-feedback";
import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<
  DashboardData,
  | "locale"
  | "t"
  | "isActivityLoading"
  | "hoveredCell"
  | "setHoveredCell"
  | "formatCellFullDate"
  | "heatmapWeeks"
>;

export function ActivityHeatmap({
  locale,
  t,
  isActivityLoading,
  hoveredCell,
  setHoveredCell,
  formatCellFullDate,
  heatmapWeeks,
}: Props) {
  return (
    <>
      {isActivityLoading ? (
        <PanelSkeleton rows={6} />
      ) : (
        <div className="rounded border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t("heatmap.title")}
              </h2>
              <Link
                href={`/${locale}/vocabulary`}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group"
              >
                <span>{t("progress.view_detail")}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Matrix Heatmap Table matching screenshot */}
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-center border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="w-16"></th>
                    {(
                      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
                    ).map((day) => (
                      <th
                        key={day}
                        className="text-[11px] font-semibold text-slate-400 pb-1"
                      >
                        {t(`heatmap.days.${day}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapWeeks.map((week, wIdx) => (
                    <tr key={`week-${wIdx}`}>
                      <td className="text-[11px] font-medium text-slate-400 text-left pr-2 whitespace-nowrap">
                        {t("heatmap.week", { count: wIdx + 1 })}
                      </td>
                      {week.map((cell, cIdx) => {
                        let cellBg = "bg-slate-100 text-slate-400";
                        if (cell.level === "active") {
                          cellBg = "bg-blue-600 text-white font-bold shadow-xs";
                        } else if (cell.level === "light") {
                          cellBg = "bg-blue-300 text-blue-950 font-semibold";
                        } else if (cell.isFuture) {
                          cellBg = "bg-slate-50 text-slate-300";
                        }

                        const isCurrentHovered =
                          hoveredCell?.dateStr === cell.dateStr;

                        const tooltipTitle = cell.isFuture
                          ? t("heatmap.tooltip_not_yet", { date: cell.dateStr })
                          : cell.activity &&
                              (cell.activity.wordsLearned > 0 ||
                                cell.activity.studyMinutes > 0 ||
                                cell.activity.sessionCount > 0)
                            ? `${t("heatmap.tooltip_learned", {
                                date: cell.dateStr,
                                words: cell.activity.wordsLearned || 0,
                                minutes: cell.activity.studyMinutes || 1,
                              })}${
                                cell.activity.lessons?.length
                                  ? " • " +
                                    cell.activity.lessons
                                      .map((l: any) =>
                                        t("heatmap.lesson_item", {
                                          title: l.lessonTitle,
                                          collection: l.collectionName
                                            ? ` (${l.collectionName})`
                                            : "",
                                          count: l.wordsCount,
                                        }),
                                      )
                                      .join(", ")
                                  : ""
                              }`
                            : t("heatmap.tooltip_none", { date: cell.dateStr });

                        return (
                          <td key={cell.dateStr || cIdx} className="p-0.5">
                            <button
                              type="button"
                              title={tooltipTitle}
                              onMouseEnter={() => setHoveredCell(cell)}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => setHoveredCell(cell)}
                              className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-md transition-all duration-150 flex items-center justify-center text-[10px] sm:text-[11px] cursor-pointer ${
                                cell.isToday
                                  ? "ring-2 ring-blue-600 ring-offset-1"
                                  : ""
                              } ${
                                isCurrentHovered
                                  ? "scale-110 ring-2 ring-amber-400 z-10"
                                  : "hover:scale-105"
                              } ${cellBg}`}
                            >
                              <span>{cell.dayNumber}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interactive Real-time Selected / Hovered Day Details Box */}
            <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50/80 transition-all">
              {hoveredCell ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                      {formatCellFullDate(hoveredCell.dateStr)}
                      {hoveredCell.isToday && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          {t("heatmap.today")}
                        </span>
                      )}
                    </span>
                    {hoveredCell.activity &&
                      (hoveredCell.activity.wordsLearned > 0 ||
                        hoveredCell.activity.studyMinutes > 0) && (
                        <span className="text-[11px] font-bold text-blue-600">
                          ⏱️{" "}
                          {t("heatmap.minutes_studied", {
                            count: hoveredCell.activity.studyMinutes || 1,
                          })}
                        </span>
                      )}
                  </div>

                  {hoveredCell.isFuture ? (
                    <p className="text-slate-400 italic">
                      {t("heatmap.not_yet")}
                    </p>
                  ) : hoveredCell.activity &&
                    (hoveredCell.activity.wordsLearned > 0 ||
                      hoveredCell.activity.studyMinutes > 0 ||
                      hoveredCell.activity.sessionCount > 0) ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-slate-600 font-medium">
                        <span>
                          📖{" "}
                          <strong>
                            {hoveredCell.activity.wordsLearned || 0}
                          </strong>{" "}
                          {t("heatmap.words_learned")}
                        </span>
                        <span>
                          🔄{" "}
                          <strong>
                            {hoveredCell.activity.wordsReviewed || 0}
                          </strong>{" "}
                          {t("heatmap.words_reviewed")}
                        </span>
                        <span>
                          🎯{" "}
                          <strong>
                            {hoveredCell.activity.sessionCount || 1}
                          </strong>{" "}
                          {t("heatmap.sessions")}
                        </span>
                      </div>
                      {hoveredCell.activity.lessons &&
                        hoveredCell.activity.lessons.length > 0 && (
                          <div className="pt-1 text-[11px] text-slate-600">
                            <span className="text-slate-400 font-medium">
                              {t("heatmap.lessons_joined")}{" "}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {hoveredCell.activity.lessons
                                .map((l) =>
                                  t("heatmap.lesson_item", {
                                    title: l.lessonTitle,
                                    collection: l.collectionName
                                      ? ` (${l.collectionName})`
                                      : "",
                                    count: l.wordsCount,
                                  }),
                                )
                                .join("; ")}
                            </span>
                          </div>
                        )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">
                      {t("heatmap.no_activity_day")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t("heatmap.hint")}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {t("heatmap.real_data")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100 justify-start">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>{t("heatmap.legend_active")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-300"></span>
              <span>{t("heatmap.legend_light")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
              <span>{t("heatmap.legend_none")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
