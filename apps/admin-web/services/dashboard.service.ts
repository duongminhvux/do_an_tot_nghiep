import apiClient from '@/lib/axios';
import type { ActivityLogItem } from '@/types/activity-log';
import type { ApiResponse } from '@/types/common';

export interface DashboardOverview {
  period: { days: number; labels: string[] };
  stats: {
    users: number;
    usersGrowth: number;
    exams: number;
    activeExams: number;
    attempts: number;
    attemptsGrowth: number;
    avgScore: number;
    scoreGrowth: number;
  };
  series: { newUsers: number[]; attempts: number[] };
  examTypes: { type: string; count: number }[];
  popularExams: { id: string; name: string; attempts: number }[];
  newUsers: { id: string; name: string; email: string; createdAt: string }[];
  recentActivity: ActivityLogItem[];
}

export const dashboardService = {
  getOverview: async (days: number, lang: string): Promise<DashboardOverview> => {
    const response = await apiClient.get<ApiResponse<DashboardOverview>>(
      '/admin/dashboard/overview',
      { params: { days, lang } },
    );
    return response.data.data;
  },
};
