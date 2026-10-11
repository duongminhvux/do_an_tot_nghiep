"use client";

import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle } from "lucide-react";

export const StatCardSkeleton = () => (
  <div className="rounded border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse shrink-0" />
    <div className="flex-1 min-w-0 space-y-2.5">
      <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse" />
      <div className="h-6 w-16 bg-slate-100 rounded-md animate-pulse" />
      <div className="h-2.5 w-28 bg-slate-100 rounded-md animate-pulse" />
    </div>
  </div>
);

export const PanelSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="rounded border border-slate-200/80 bg-white p-6 shadow-xs">
    <div className="flex items-center justify-between mb-5">
      <div className="h-5 w-40 bg-slate-100 rounded-md animate-pulse" />
      <div className="h-4 w-24 bg-slate-100 rounded-md animate-pulse" />
    </div>
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 p-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 bg-slate-100 rounded-md animate-pulse" />
            <div className="h-2.5 w-1/3 bg-slate-100 rounded-md animate-pulse" />
            <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export function ErrorBanner({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("home");
  return (
    <div className="rounded border border-red-200 bg-red-50/60 p-4 flex flex-wrap items-center gap-3 text-sm text-red-700">
      <AlertCircle className="w-5 h-5 shrink-0" />
      <span className="flex-1 min-w-0">{message || t("errors.generic")}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Loader2 className="w-3.5 h-3.5" />
          <span>{t("errors.retry")}</span>
        </button>
      )}
    </div>
  );
}
