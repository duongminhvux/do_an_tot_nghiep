"use client";

import { ErrorBanner } from "./dashboard-feedback";
import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<
  DashboardData,
  | "t"
  | "isOverviewError"
  | "overviewError"
  | "refetchOverview"
  | "isVocabError"
  | "vocabError"
  | "refetchVocab"
  | "isActivityError"
  | "activityError"
  | "refetchActivity"
  | "isTasksError"
  | "tasksError"
  | "refetchTasks"
>;

export function DashboardErrors({
  t,
  isOverviewError,
  overviewError,
  refetchOverview,
  isVocabError,
  vocabError,
  refetchVocab,
  isActivityError,
  activityError,
  refetchActivity,
  isTasksError,
  tasksError,
  refetchTasks,
}: Props) {
  return (
    <>
      {(isOverviewError || isVocabError || isActivityError || isTasksError) && (
        <div className="space-y-3">
          {isOverviewError && (
            <ErrorBanner
              message={
                (overviewError as any)?.response?.data?.message ||
                t("errors.overview")
              }
              onRetry={refetchOverview}
            />
          )}
          {isVocabError && (
            <ErrorBanner
              message={
                (vocabError as any)?.response?.data?.message ||
                t("errors.vocabulary")
              }
              onRetry={refetchVocab}
            />
          )}
          {isActivityError && (
            <ErrorBanner
              message={
                (activityError as any)?.response?.data?.message ||
                t("errors.activity")
              }
              onRetry={refetchActivity}
            />
          )}
          {isTasksError && (
            <ErrorBanner
              message={
                (tasksError as any)?.response?.data?.message ||
                t("errors.tasks")
              }
              onRetry={refetchTasks}
            />
          )}
        </div>
      )}
    </>
  );
}
