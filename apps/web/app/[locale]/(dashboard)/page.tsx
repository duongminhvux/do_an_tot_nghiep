"use client";

import { useHomeData } from "./hooks/use-home-data";
import { DashboardHeader } from "./components/dashboard-header";
import { ErrorBanner } from "./components/dashboard-feedback";
import { HomeStats } from "./components/home-stats";
import { ContinueLearning } from "./components/continue-learning";
import { XpHeatmap } from "./components/xp-heatmap";
import { RecentActivityList } from "./components/recent-activity";
import { PageShell } from "@/components/ui/page";

export default function StudentHomePage() {
  const data = useHomeData();
  const { t, locale, home, recent } = data;
  return (
    <PageShell>
      <DashboardHeader {...data} />
      {home.isError && (
        <ErrorBanner
          message={t("errors.activity")}
          onRetry={() => void home.refetch()}
        />
      )}
      <HomeStats t={t} home={home.data} isLoading={home.isLoading} />
      <ContinueLearning data={data} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <XpHeatmap
          t={t}
          locale={locale}
          home={home.data}
          isLoading={home.isLoading}
        />
        <RecentActivityList
          t={t}
          locale={locale}
          items={recent.data}
          isLoading={recent.isLoading}
        />
      </div>
    </PageShell>
  );
}
