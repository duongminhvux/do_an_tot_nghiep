import { Injectable } from '@nestjs/common';
import { InjectPgConnection,type PgConnection } from '../../postgres/connection.js';
import { ActivityLogsService } from '../activity-logs/activity-logs.service.js';
import { dashboardData } from './dashboard-reader.js';
import { dashboardPeriod } from './dashboard-period.js';

import { ToeicAttemptStatus } from '../assessment/attempts/attempt.types.js';
import { User } from '../users/rows/user.row.js';

const COMPLETED_ATTEMPT_STATUSES = [ToeicAttemptStatus.FINISHED, 'COMPLETED'] as const;



@Injectable()
export class DashboardService {
  constructor(
    @InjectPgConnection() private readonly db:PgConnection,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async getOverview(inputDays: number, lang?: string) {
    const {days,labels,...period}=dashboardPeriod(inputDays);
    const [identity,assessment,notification]=await Promise.all([dashboardData(this.db,'identity',period),dashboardData(this.db,'assessment',period),dashboardData(this.db,'notification',period)]);
    const {totalUsers,previousUsers,userTimeline,newUsers}=identity;
    const {totalExams,activeExams,totalAttempts,previousAttempts,scoreResult,previousScoreResult,attemptTimeline,examTypes,popularExams}=assessment;
    const {recentActivity}=notification;

    const dailyMap = new Map<string, { newUsers: number; attempts: number }>();
    for (const key of labels)dailyMap.set(key,{newUsers:0,attempts:0});
    userTimeline.forEach((item:any) => dailyMap.get(item._id) && (dailyMap.get(item._id)!.newUsers = item.count));
    attemptTimeline.forEach((item:any) => dailyMap.get(item._id) && (dailyMap.get(item._id)!.attempts = item.count));

    const percentage = (value: number, previous: number) =>
      previous === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - previous) / previous) * 100);
    const averageScore = Math.round(scoreResult[0]?.value || 0);
    const previousAverageScore = Math.round(previousScoreResult[0]?.value || 0);

    return {
      period: { days, labels: [...dailyMap.keys()] },
      stats: {
        users: totalUsers,
        usersGrowth: percentage(totalUsers, previousUsers),
        exams: totalExams,
        activeExams,
        attempts: totalAttempts,
        attemptsGrowth: percentage(totalAttempts, previousAttempts),
        avgScore: averageScore,
        scoreGrowth: averageScore - previousAverageScore },
      series: {
        newUsers: [...dailyMap.values()].map((item:any) => item.newUsers),
        attempts: [...dailyMap.values()].map((item:any) => item.attempts) },
      examTypes: examTypes
        .filter((item:any) => item._id === 'TOEIC')
        .map((item:any) => ({ type: item._id, count: item.count })),
      popularExams: popularExams.map((item:any) => ({
        id: String(item.id),
        name: item.name,
        attempts: item.attempts })),
      newUsers:             newUsers.map((user:any) => {
        const item = user as User & { _id: unknown; createdAt?: Date };
        return {
          id: String(item._id),
          name: item.username || item.email.split('@')[0],
          email: item.email,
          createdAt: item.createdAt };
      }),
      recentActivity: await Promise.all(recentActivity.map((item:any) => this.activityLogsService.localizeLog(item, lang))) };
  }
}
