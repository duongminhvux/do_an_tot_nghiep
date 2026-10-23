"use client";

import { useTranslation } from "react-i18next";
import { ErrorState, surface } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const StatCardSkeleton = () => (
  <div className={cn(surface, "flex items-center gap-4 p-5")}>
    <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
    <div className="min-w-0 flex-1 space-y-2.5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  </div>
);

export const PanelSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className={cn(surface, "p-5 sm:p-6")}>
    <div className="mb-5 flex items-center justify-between">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
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
    <ErrorState
      message={message || t("errors.generic")}
      onRetry={onRetry}
      retryLabel={t("errors.retry")}
    />
  );
}
