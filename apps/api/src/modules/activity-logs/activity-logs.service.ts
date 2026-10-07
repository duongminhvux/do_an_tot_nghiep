import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityAction,
  ActivityCategory,
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-log.schema.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { QueryActivityStatsDto } from './dto/query-activity-stats.dto.js';
import { User, UserDocument } from '../users/schema/user.schema.js';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly i18n: I18nService,
  ) {}

  private getLang(customLang?: string): string {
    return customLang || I18nContext.current()?.lang || 'vi';
  }

  async translateAction(action: string, lang: string): Promise<string> {
    try {
      const text = await this.i18n.translate(`activity-log.actions.${action}`, { lang });
      return text && text !== `activity-log.actions.${action}` ? text : action;
    } catch {
      return action;
    }
  }

  async translateCategory(category: string, lang: string): Promise<string> {
    try {
      const text = await this.i18n.translate(`activity-log.categories.${category}`, { lang });
      return text && text !== `activity-log.categories.${category}` ? text : category;
    } catch {
      return category;
    }
  }

  async translateStatus(status: string, lang: string): Promise<string> {
    try {
      const text = await this.i18n.translate(`activity-log.status.${status}`, { lang });
      return text && text !== `activity-log.status.${status}` ? text : status;
    } catch {
      return status;
    }
  }

  /**
   * Helper to automatically determine category based on action string if not provided
   */
  private resolveCategory(action: string, category?: ActivityCategory): ActivityCategory {
    if (category) return category;
    const act = (action || '').toUpperCase();
    if (act.startsWith('AUTH_')) return ActivityCategory.AUTH;
    if (act.startsWith('SESSION_') || act.includes('HEARTBEAT') || act.includes('PAGE_VIEW'))
      return ActivityCategory.SESSION;
    if (act.startsWith('VOCABULARY_') || act.startsWith('VOCAB_'))
      return ActivityCategory.VOCABULARY;
    if (act.startsWith('DICTATION_')) return ActivityCategory.DICTATION;
    if (act.startsWith('TOEIC_') || act.startsWith('ASSESSMENT_') || act.startsWith('EXAM_'))
      return ActivityCategory.ASSESSMENT;
    return ActivityCategory.GENERAL;
  }

  /**
   * Safe asynchronous activity logging.
   * Will never throw an error to prevent disrupting primary business workflows.
   */
  async log(dto: CreateActivityLogDto): Promise<ActivityLogDocument | null> {
    try {
      let resolvedUserId: Types.ObjectId | undefined;
      let userEmail = dto.userEmail;
      let userName = dto.userName;

      if (dto.userId && Types.ObjectId.isValid(dto.userId)) {
        resolvedUserId = new Types.ObjectId(dto.userId);

        // Fetch user snapshot if email or name is missing
        if (!userEmail || !userName) {
          try {
            const user = await this.userModel
              .findById(resolvedUserId)
              .select('email username role')
              .lean();
            if (user) {
              userEmail = userEmail || user.email;
              userName = userName || user.username || user.email.split('@')[0];
            }
          } catch {
            // Ignore user lookup failure
          }
        }
      }

      const category = this.resolveCategory(dto.action, dto.category);

      const created = await this.activityLogModel.create({
        userId: resolvedUserId,
        userEmail: userEmail || undefined,
        userName: userName || undefined,
        role: dto.role || 'USER',
        action: dto.action,
        category,
        description: dto.description,
        metadata: dto.metadata || {},
        ipAddress: dto.ipAddress || undefined,
        userAgent: dto.userAgent || undefined,
        status: dto.status || 'SUCCESS',
        durationMs: dto.durationMs || 0,
      });

      return created;
    } catch (err) {
      this.logger.warn(`Failed to record activity log for action [${dto?.action}]: ${(err as any)?.message}`);
      return null;
    }
  }

  /**
   * Paginated list with multi-criteria filtering for admin management
   */
  async findAll(query: QueryActivityLogsDto, customLang?: string) {
    const lang = this.getLang(customLang || query.lang);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.category && query.category !== 'ALL') {
      filter.category = query.category;
    }

    if (query.action && query.action !== 'ALL') {
      filter.action = query.action;
    }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    if (query.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    if (query.userEmail) {
      filter.userEmail = { $regex: query.userEmail.trim(), $options: 'i' };
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Text search query across email, username, description
    if (query.search?.trim()) {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [
        { userEmail: regex },
        { userName: regex },
        { description: regex },
        { action: regex },
      ];
    }

    const [rawItems, total] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityLogModel.countDocuments(filter),
    ]);

    const items = await Promise.all(
      rawItems.map(async (item) => {
        const [actionLabel, categoryLabel, statusLabel] = await Promise.all([
          this.translateAction(item.action, lang),
          this.translateCategory(item.category, lang),
          this.translateStatus(item.status, lang),
        ]);

        return {
          ...item,
          actionLabel,
          categoryLabel,
          statusLabel,
        };
      }),
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * View detail of a single activity log entry
   */
  async findById(id: string, customLang?: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const item = await this.activityLogModel.findById(id).lean();
    if (!item) return null;

    const lang = this.getLang(customLang);
    const [actionLabel, categoryLabel, statusLabel] = await Promise.all([
      this.translateAction(item.action, lang),
      this.translateCategory(item.category, lang),
      this.translateStatus(item.status, lang),
    ]);

    return {
      ...item,
      actionLabel,
      categoryLabel,
      statusLabel,
    };
  }

  /**
   * Get distinct categories and actions for frontend filter selects with i18n labels
   */
  async getFilterOptions(customLang?: string) {
    const lang = this.getLang(customLang);

    const [distinctCategories, distinctActions] = await Promise.all([
      this.activityLogModel.distinct('category'),
      this.activityLogModel.distinct('action'),
    ]);

    // Ensure all standard categories and actions are available
    const standardCategories = Object.values(ActivityCategory);
    const mergedCategories = Array.from(
      new Set([...standardCategories, ...distinctCategories]),
    );

    const standardActions = Object.values(ActivityAction);
    const mergedActions = Array.from(
      new Set([...standardActions, ...distinctActions]),
    ).sort();

    const categories = await Promise.all(
      mergedCategories.map(async (category) => ({
        value: category,
        label: await this.translateCategory(category, lang),
      })),
    );

    const actions = await Promise.all(
      mergedActions.map(async (action) => ({
        value: action,
        label: await this.translateAction(action, lang),
        category: this.resolveCategory(action),
      })),
    );

    return {
      categories,
      actions,
    };
  }

  /**
   * Get full i18n dictionaries for activity logs (actions, categories, statuses)
   */
  async getI18n(customLang?: string) {
    const lang = this.getLang(customLang);

    const actions: Record<string, string> = {};
    for (const key of Object.values(ActivityAction)) {
      actions[key] = await this.translateAction(key, lang);
    }

    const categories: Record<string, string> = {};
    for (const key of Object.values(ActivityCategory)) {
      categories[key] = await this.translateCategory(key, lang);
    }

    const status: Record<string, string> = {
      SUCCESS: await this.translateStatus('SUCCESS', lang),
      FAILED: await this.translateStatus('FAILED', lang),
      INFO: await this.translateStatus('INFO', lang),
      WARNING: await this.translateStatus('WARNING', lang),
    };

    return {
      lang,
      actions,
      categories,
      status,
    };
  }

  /**
   * Overview statistics for admin dashboard
   */
  async getStats(query: QueryActivityStatsDto, customLang?: string) {
    const lang = this.getLang(customLang || query.lang);
    const days = Math.max(1, Math.min(90, Number(query.days) || 7));
    const now = new Date();

    let startDate: Date;
    let endDate: Date;

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rangeFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const [
      totalActivities,
      activitiesToday,
      uniqueUsers,
      categoryCounts,
      actionCounts,
      dailyTimeline,
      topUsers,
    ] = await Promise.all([
      this.activityLogModel.countDocuments(rangeFilter),
      this.activityLogModel.countDocuments({ createdAt: { $gte: todayStart } }),
      this.activityLogModel.distinct('userId', rangeFilter).then((ids) => ids.filter(Boolean).length),
      // Group by category
      this.activityLogModel.aggregate([
        { $match: rangeFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Top actions
      this.activityLogModel.aggregate([
        { $match: rangeFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Daily timeline
      this.activityLogModel.aggregate([
        { $match: rangeFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Top active users
      this.activityLogModel.aggregate([
        {
          $match: {
            ...rangeFilter,
            userEmail: { $ne: null, $exists: true },
          },
        },
        {
          $group: {
            _id: '$userEmail',
            userName: { $first: '$userName' },
            userId: { $first: '$userId' },
            count: { $sum: 1 },
            lastActive: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const categoryBreakdown = await Promise.all(
      categoryCounts.map(async (c) => ({
        category: c._id,
        label: await this.translateCategory(c._id, lang),
        count: c.count,
        percentage: totalActivities ? Math.round((c.count / totalActivities) * 100) : 0,
      })),
    );

    const topActions = await Promise.all(
      actionCounts.map(async (a) => ({
        action: a._id,
        label: await this.translateAction(a._id, lang),
        count: a.count,
      })),
    );

    return {
      period: {
        days,
        startDate,
        endDate,
      },
      summary: {
        totalActivities,
        activitiesToday,
        uniqueUsers,
      },
      categoryBreakdown,
      topActions,
      dailyTimeline: dailyTimeline.map((d) => ({
        date: d._id,
        count: d.count,
      })),
      topActiveUsers: topUsers.map((u) => ({
        email: u._id,
        name: u.userName || u._id.split('@')[0],
        userId: u.userId,
        count: u.count,
        lastActive: u.lastActive,
      })),
    };
  }
}
