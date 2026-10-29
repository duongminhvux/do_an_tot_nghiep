'use client';
import { LoadError } from '@/components/ui/load-error';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { dashboardService } from '@/services/dashboard.service';
import { OverviewHeader } from '@/components/dashboard/overview-header';
import { StatCards } from '@/components/dashboard/stat-cards';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { ExamStatusCard } from '@/components/dashboard/exam-status-card';
import { PopularExams } from '@/components/dashboard/popular-exams';
import { NewUsersCard } from '@/components/dashboard/new-users-card';
import { RecentActivityCard } from '@/components/dashboard/recent-activity-card';
import {
  mapLogToActivity,
  toMinutesAgo,
  type ActivityViewItem,
  type NewUserItem,
  type PopularExamItem,
  type TimeRangeDays,
} from '@/components/dashboard/dashboard-data';

export default function AdminHomePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t, i18n } = useTranslation('dashboard');
  const language = (i18n.resolvedLanguage || i18n.language || locale).startsWith('en') ? 'en' : 'vi';
  const [days, setDays] = useState<TimeRangeDays>(7);

  const overviewQuery = useQuery({
    queryKey: ['admin-dashboard-overview', days, language],
    queryFn: () => dashboardService.getOverview(days, language),
  });
  const overview = overviewQuery.data;
  const loading = overviewQuery.isLoading;
  const chartData = {
    labels: overview?.period.labels || [],
    listening: overview?.series.newUsers || [],
    reading: overview?.series.attempts || [],
    fullTest: [],
  };
  const stats = overview?.stats;
  const newUsers: NewUserItem[] = (overview?.newUsers || []).map((user) => ({
    ...user,
    minutesAgo: toMinutesAgo(user.createdAt),
  }));
  const recentActivity: ActivityViewItem[] = (overview?.recentActivity || []).map(mapLogToActivity);
  const popularExams: PopularExamItem[] = overview?.popularExams || [];
  const toeicExams = overview?.examTypes.find((item) => item.type === 'TOEIC')?.count || 0;

  const formatMinutes = (minutes: number) => {
    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('time.hoursAgo', { n: hours });
    return t('time.daysAgo', { n: Math.floor(hours / 24) });
  };

  if (overviewQuery.isError) return <LoadError onRetry={() => { void overviewQuery.refetch(); }} />;

  return (
    <main className="w-full flex-1 space-y-3.5 px-3 py-4 sm:px-4 lg:px-5 lg:py-5">
      <OverviewHeader locale={locale} days={days} onChange={setDays} />

      {/* 4 card thống kê chính */}
      <StatCards
        locale={locale}
        loading={loading}
        users={stats?.users || 0}
        usersGrowth={stats?.usersGrowth || 0}
        exams={stats?.exams || 0}
        activeExams={stats?.activeExams || 0}
        attempts={stats?.attempts || 0}
        attemptsGrowth={stats?.attemptsGrowth || 0}
        avgScore={stats?.avgScore || 0}
        scoreGrowth={stats?.scoreGrowth || 0}
      />

      {/* Biểu đồ hoạt động + Tình trạng đề thi */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-6">
          <ActivityChart
            locale={locale}
            days={days}
            data={chartData}
            loading={false}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <ExamStatusCard
          locale={locale}
          total={stats?.exams || 0}
          toeic={toeicExams}
          active={stats?.activeExams || 0}
          inactive={Math.max(0, (stats?.exams || 0) - (stats?.activeExams || 0))}
          loading={loading}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <PopularExams
            locale={locale}
            exams={popularExams}
            loading={loading}
          />
        </div>
      </div>

      {/* Người dùng mới + Hoạt động gần đây */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <NewUsersCard
          locale={locale}
          users={newUsers}
          loading={loading}
          formatMinutes={formatMinutes}
        />
        <RecentActivityCard
          activities={recentActivity}
          loading={loading}
          formatMinutes={formatMinutes}
        />
      </div>
    </main>
  );
}
