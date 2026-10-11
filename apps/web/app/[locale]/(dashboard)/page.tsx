"use client";

import { useDashboardData } from "./hooks/use-dashboard-data";
import { DashboardHeader } from "./components/dashboard-header";
import { DashboardErrors } from "./components/dashboard-errors";
import { DashboardStats } from "./components/dashboard-stats";
import { VocabularyProgress } from "./components/vocabulary-progress";
import { ActivityHeatmap } from "./components/activity-heatmap";
import { DashboardTasks } from "./components/dashboard-tasks";

export default function StudentHomePage() {
  const data = useDashboardData();
  return (
    <div className="flex-1 w-full px-3 sm:px-4 lg:px-5 py-6 space-y-6">
      <DashboardHeader {...data} />
      <DashboardErrors {...data} />
      <DashboardStats {...data} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VocabularyProgress {...data} />
        <ActivityHeatmap {...data} />
      </div>
      <DashboardTasks {...data} />
    </div>
  );
}
