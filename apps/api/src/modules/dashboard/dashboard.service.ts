import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User, UserDocument } from '../users/schema/user.schema.js';
import { Exam, ExamDocument } from '../assessment/exams/schemas/exam.schema.js';
import { Attempt, AttemptDocument } from '../assessment/attempts/schemas/attempt.schema.js';
import { ToeicAttemptStatus } from '../assessment/attempts/attempt.types.js';
import {
  ActivityLog,
  ActivityLogDocument,
} from '../activity-logs/schemas/activity-log.schema.js';

const COMPLETED_ATTEMPT_STATUSES = [ToeicAttemptStatus.FINISHED, 'COMPLETED'] as const;

type Period = { $gte: Date; $lt: Date };

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Attempt.name) private readonly attemptModel: Model<AttemptDocument>,
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLogDocument>,
  ) {}

  async getOverview(inputDays: number) {
    const days = Math.max(7, Math.min(90, inputDays));
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - days);
    const period: Period = { $gte: start, $lt: new Date(now.getTime() + 1) };
    const previousPeriod: Period = { $gte: previousStart, $lt: start };

    const [
      totalUsers,
      previousUsers,
      totalExams,
      activeExams,
      totalAttempts,
      previousAttempts,
      scoreResult,
      previousScoreResult,
      userTimeline,
      attemptTimeline,
      examTypes,
      popularExams,
      newUsers,
      recentActivity,
    ] = await Promise.all([
      this.userModel.countDocuments({ isDeleted: { $ne: true } }),
      this.userModel.countDocuments({ createdAt: { $lt: start }, isDeleted: { $ne: true } }),
      this.examModel.countDocuments({ isDeleted: { $ne: true }, type: 'TOEIC' }),
      this.examModel.countDocuments({ isDeleted: { $ne: true }, type: 'TOEIC', isActive: true }),
      this.attemptModel.countDocuments({ createdAt: period, status: { $in: COMPLETED_ATTEMPT_STATUSES } }),
      this.attemptModel.countDocuments({ createdAt: previousPeriod, status: { $in: COMPLETED_ATTEMPT_STATUSES } }),
      this.attemptModel.aggregate([
        { $match: { createdAt: period, status: { $in: COMPLETED_ATTEMPT_STATUSES }, score: { $type: 'number' } } },
        { $group: { _id: null, value: { $avg: '$score' } } },
      ]),
      this.attemptModel.aggregate([
        { $match: { createdAt: previousPeriod, status: { $in: COMPLETED_ATTEMPT_STATUSES }, score: { $type: 'number' } } },
        { $group: { _id: null, value: { $avg: '$score' } } },
      ]),
      this.userModel.aggregate([
        { $match: { createdAt: period, isDeleted: { $ne: true } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.attemptModel.aggregate([
        { $match: { createdAt: period, status: { $in: COMPLETED_ATTEMPT_STATUSES } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.examModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.attemptModel.aggregate([
        { $match: { status: { $in: COMPLETED_ATTEMPT_STATUSES } } },
        { $group: { _id: '$examId', attempts: { $sum: 1 } } },
        { $sort: { attempts: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'exams', localField: '_id', foreignField: '_id', as: 'exam' } },
        { $unwind: '$exam' },
        { $match: { 'exam.type': 'TOEIC', 'exam.isDeleted': { $ne: true } } },
        { $project: { id: '$_id', name: '$exam.name', attempts: 1 } },
      ]),
      this.userModel.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(5).select('_id username email createdAt').lean(),
      this.activityLogModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const dailyMap = new Map<string, { newUsers: number; attempts: number }>();
    for (let index = 0; index < days; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, { newUsers: 0, attempts: 0 });
    }
    userTimeline.forEach((item) => dailyMap.get(item._id) && (dailyMap.get(item._id)!.newUsers = item.count));
    attemptTimeline.forEach((item) => dailyMap.get(item._id) && (dailyMap.get(item._id)!.attempts = item.count));

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
        scoreGrowth: averageScore - previousAverageScore,
      },
      series: {
        newUsers: [...dailyMap.values()].map((item) => item.newUsers),
        attempts: [...dailyMap.values()].map((item) => item.attempts),
      },
      examTypes: examTypes
        .filter((item) => item._id === 'TOEIC')
        .map((item) => ({ type: item._id, count: item.count })),
      popularExams: popularExams.map((item) => ({
        id: String(item.id),
        name: item.name,
        attempts: item.attempts,
      })),
      newUsers:             newUsers.map((user) => {
        const item = user as User & { _id: unknown; createdAt?: Date };
        return {
          id: String(item._id),
          name: item.username || item.email.split('@')[0],
          email: item.email,
          createdAt: item.createdAt,
        };
      }),
      recentActivity,
    };
  }
}
