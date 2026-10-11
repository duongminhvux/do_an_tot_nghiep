"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { PanelSkeleton } from "./dashboard-feedback";
import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<
  DashboardData,
  | "locale"
  | "t"
  | "isVocabLoading"
  | "collectionColors"
  | "displayCollections"
  | "getProgressPercent"
>;

export function VocabularyProgress({
  locale,
  t,
  isVocabLoading,
  collectionColors,
  displayCollections,
  getProgressPercent,
}: Props) {
  return (
    <>
      {isVocabLoading ? (
        <PanelSkeleton rows={4} />
      ) : (
        <div className="rounded border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t("progress.title")}
              </h2>
              <Link
                href={`/${locale}/vocabulary`}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group"
              >
                <span>{t("progress.view_detail")}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* List Collection Progress (real data only) */}
            {displayCollections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Inbox className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {t("progress.empty_title")}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  {t("progress.empty_desc")}
                </p>
                <Link
                  href={`/${locale}/vocabulary`}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  <span>{t("progress.empty_cta")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {displayCollections.map((col, idx) => {
                  const color = collectionColors[idx % collectionColors.length];
                  const badgeLetter =
                    col.letter ||
                    (col.collectionName ? col.collectionName.charAt(0) : "A");
                  const pct = getProgressPercent(col);
                  return (
                    <Link
                      key={col.collectionId || idx}
                      href={
                        col.collectionSlug
                          ? `/${locale}/vocabulary/${col.collectionSlug}`
                          : `/${locale}/vocabulary`
                      }
                      className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      {/* Square Badge */}
                      <div
                        className={`w-10 h-10 rounded-xl ${color?.bg} ${color?.text} flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`}
                      >
                        {badgeLetter.toUpperCase()}
                      </div>

                      {/* Collection Info & Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {col.collectionName}
                          </h3>
                          <span className="text-xs font-bold text-slate-700 shrink-0">
                            {pct}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mb-1.5">
                          {t("progress.words_progress", {
                            learned: (col.learnedWords || 0).toLocaleString(),
                            total: (col.totalWords || 0).toLocaleString(),
                          })}
                        </p>
                        {/* Smooth Progress Bar matching screenshot */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(pct, 4))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
