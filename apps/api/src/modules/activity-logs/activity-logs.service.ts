import { LearningActivity, LEARNING_ACTIVITY_TYPES } from '../learning-activity/schemas/learning-activity.schema.js';
import { PgId } from '../../postgres/compat.js';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectPgModel } from '../../postgres/compat.js';
import { type Model } from '../../postgres/compat.js';
import {
  ActivityAction,
  ActivityCategory,
  ActivityLog,
  ActivityLogDocument } from './schemas/activity-log.schema.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { QueryActivityStatsDto } from './dto/query-activity-stats.dto.js';
import { User, UserDocument } from '../users/schema/user.schema.js';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(
    @InjectPgModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLogDocument>,
    @InjectPgModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly i18n: I18nService,
    @InjectPgModel(LearningActivity.name)
    private readonly learningActivities: Model<LearningActivity>,
  ) {}

  private getLang(customLang?: string): string {
    const value = customLang || I18nContext.current()?.lang || 'vi';
    return value.toLowerCase().startsWith('en') ? 'en' : 'vi';
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

  async localizeLog<T extends Pick<ActivityLog, 'action' | 'category' | 'status' | 'description' | 'descriptionKey' | 'descriptionArgs' | 'metadata'>>(item: T, customLang?: string) {
    const lang = this.getLang(customLang);
    const [actionLabel, categoryLabel, statusLabel, description] = await Promise.all([
      this.translateAction(item.action, lang),
      this.translateCategory(item.category, lang),
      this.translateStatus(item.status, lang),
      this.translateDescription(item, lang),
    ]);
    return { ...item, actionLabel, categoryLabel, statusLabel, description };
  }

  private async translateDescription(item: { action: string; status: string; description: string; descriptionKey?: string; descriptionArgs?: Record<string, unknown>; metadata?: Record<string, any> }, lang: string) {
    const known = [...Object.values(ActivityAction), ...LEARNING_ACTIVITY_TYPES].includes(item.action as never);
    const explicit = item.descriptionKey && /^activity-log\.messages\.[A-Z0-9_]+$/.test(item.descriptionKey) ? item.descriptionKey : undefined;
    const key = explicit ?? (known ? `activity-log.messages.${item.action}` : undefined);
    if (!key) return item.description;
    const data = item.metadata ?? {};
    const args = { ...item.descriptionArgs };
    // Nested action labels stay as keys in storage and are translated on read.
    if (typeof args.actionKey === 'string' && /^activity-log\.actions\.[A-Z0-9_]+$/.test(args.actionKey))
      args.action = await this.i18n.translate(args.actionKey, { lang });
    const title = data.lessonTitle ?? data.title ?? data.examName ?? data.wordText ?? data.path;
    let message = await this.i18n.translate(key, { lang, args });
    if (!message || message === key) return item.description;
    if (explicit) return message;
    if (item.status === 'FAILED') message = await this.i18n.translate('activity-log.messages.FAILED_ACTION', { lang, args: { action: await this.translateAction(item.action, lang) } });
    if (item.action === 'VOCABULARY_SAVE' && data.isSaved === false)
      message = await this.i18n.translate('activity-log.messages.VOCABULARY_UNSAVE', { lang });
    if (typeof title === 'string' && title.trim()) message = await this.i18n.translate('activity-log.messages.WITH_TITLE', { lang, args: { message, title } });
    return message;
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
    if (act === 'ARENA_MATCH') return ActivityCategory.ARENA;
    if (act === 'MINIGAME_PLAY') return ActivityCategory.MINIGAME;
    if (['WORD_LEARNED', 'WORD_REVIEWED', 'VOCAB_SESSION'].includes(act)) return ActivityCategory.VOCABULARY;
    return ActivityCategory.GENERAL;
  }

  /**
   * Safe asynchronous activity logging.
   * Will never throw an error to prevent disrupting primary business workflows.
   */
  async log(dto: CreateActivityLogDto): Promise<ActivityLogDocument | null> {
    try {
      let resolvedUserId: PgId | undefined;
      let userEmail = dto.userEmail;
      let userName = dto.userName;

      if (dto.userId && PgId.isValid(dto.userId)) {
        resolvedUserId = new PgId(dto.userId);

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
      const metadata = dto.metadata ?? {};
      const descriptionArgs: Record<string, unknown> = {};
      for (const key of ['score', 'total', 'correct', 'count', 'accuracy', 'path', 'isSaved']) {
        if (metadata[key] !== undefined) descriptionArgs[key] = metadata[key];
      }
      const title = dto.action === 'PAGE_VIEW'
        ? metadata.path ?? metadata.title
        : metadata.lessonTitle ?? metadata.title ?? metadata.examName ?? metadata.wordText;
      if (typeof title === 'string' && title.trim()) descriptionArgs.title = title;
      Object.assign(descriptionArgs, dto.descriptionArgs);
      let descriptionKey = dto.descriptionKey;
      const standard = Object.values(ActivityAction).includes(dto.action as ActivityAction) && dto.action !== ActivityAction.CUSTOM;
      if (!descriptionKey && standard) {
        let action = dto.action === 'VOCABULARY_SAVE' && metadata.isSaved === false ? 'VOCABULARY_UNSAVE' : dto.action;
        if (dto.status === 'FAILED') {
          descriptionKey = 'activity-log.messages.FAILED_ACTION';
          descriptionArgs.actionKey = `activity-log.actions.${dto.action}`;
        } else {
          if (descriptionArgs.title) action += '_WITH_TITLE';
          descriptionKey = `activity-log.messages.${action}`;
        }
      }

      const created = await this.activityLogModel.create({
        userId: resolvedUserId,
        userEmail: userEmail || undefined,
        userName: userName || undefined,
        role: dto.role || 'USER',
        action: dto.action,
        category,
        // Legacy/custom callers may supply fallback text; structured events need none.
        description: dto.descriptionKey || !standard ? dto.description ?? '' : '',
        descriptionKey,
        descriptionArgs,
        metadata: dto.metadata || {},
        ipAddress: dto.ipAddress || undefined,
        userAgent: dto.userAgent || undefined,
        status: dto.status || 'SUCCESS',
        durationMs: dto.durationMs || 0 });

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
    if (query.userId && !PgId.isValid(query.userId))
      throw new BadRequestException(await this.i18n.translate('activity-log.errors.INVALID_USER', { lang }));
    if (query.includeLearning === 'true' && !query.userId)
      throw new BadRequestException(await this.i18n.translate('activity-log.errors.USER_REQUIRED', { lang }));

    if (query.category && query.category !== 'ALL') {
      filter.category = query.category;
    }

    if (query.action && query.action !== 'ALL') {
      filter.action = query.action;
    }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    if (query.userId && PgId.isValid(query.userId)) {
      filter.userId = new PgId(query.userId);
    }

    if (query.userEmail) {
      filter.userEmail = { $regex: query.userEmail.trim(), $options: 'i' };
    }

    // Historical interactions may have an email snapshot but no user ID.
    if (query.includeLearning === 'true' && query.userId) {
      const user = await this.userModel.findById(query.userId).select('email').lean();
      if (!user) throw new BadRequestException(await this.i18n.translate('activity-log.errors.INVALID_USER', { lang }));
      // Public Identity projections intentionally omit email. Keep ID scoping when
      // it is unavailable instead of crashing or broadening the history query.
      const userEmail = typeof user.email === 'string' ? user.email.trim() : '';
      if (userEmail) {
        delete filter.userId;
        const email = userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$and = [{ $or: [
          { userId: new PgId(query.userId) },
          { $and: [{ $or: [{ userId: null }, { userId: { $exists: false } }] }, { userEmail: { $regex: `^${email}$`, $options: 'i' } }] },
        ] }];
      }
    }
    const matchedActions: string[] = [];
    if (query.search?.trim()) {
      const term = query.search.trim().toLocaleLowerCase();
      const actions = [...Object.values(ActivityAction), ...LEARNING_ACTIVITY_TYPES];
      await Promise.all(actions.map(async (action) => {
        const label = await this.translateAction(action, lang);
        const message = await this.i18n.translate(`activity-log.messages.${action}`, { lang });
        if (`${label} ${message}`.toLocaleLowerCase().includes(term)) matchedActions.push(action);
      }));
    }
    // Date range filter
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate.length === 10 ? `${query.startDate}T00:00:00+07:00` : query.startDate);
        filter.createdAt.$gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate.length === 10 ? `${query.endDate}T23:59:59.999+07:00` : query.endDate);
        filter.createdAt.$lte = end;
      }
    }

    // Text search query across email, username, description
    if (query.search?.trim()) {
      const regex = { $regex: query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [
        { userEmail: regex },
        { userName: regex },
        { description: regex },
        { action: regex },
        { action: { $in: matchedActions } },
      ];
    }

    const includeLearning = query.includeLearning === 'true';
    const learningFilter: Record<string, any> = { userId: query.userId ? new PgId(query.userId) : undefined };
    if (query.category && query.category !== 'ALL') {
      learningFilter.module = query.category === 'ASSESSMENT' ? 'TOEIC' : query.category;
    }
    if (query.action && query.action !== 'ALL') learningFilter.type = query.action;
    if (query.status && query.status !== 'ALL' && query.status !== 'SUCCESS') learningFilter.type = { $in: [] };
    if (filter.createdAt) learningFilter.occurredAt = filter.createdAt;
    if (query.search?.trim()) {
      const term = query.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchedTypes = matchedActions.filter((action) => LEARNING_ACTIVITY_TYPES.includes(action as never));
      learningFilter.$or = [{ title: { $regex: escaped, $options: 'i' } }, { type: { $regex: escaped, $options: 'i' } }, { 'metadata.gameType': { $regex: escaped, $options: 'i' } }, { type: { $in: matchedTypes } }];
    }
    const [rawItems, auditTotal, learningRows, learningTotal] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(includeLearning ? 0 : skip)
        .limit(includeLearning ? skip + limit : limit)
        .lean(),
      this.activityLogModel.countDocuments(filter),
      includeLearning ? this.learningActivities.find(learningFilter).sort({ occurredAt: -1, _id: -1 }).limit(skip + limit).lean() : Promise.resolve([]),
      includeLearning ? this.learningActivities.countDocuments(learningFilter) : Promise.resolve(0),
    ]);
    const learningItems = learningRows.map((row) => ({
      _id: `learning:${row._id}`, userId: row.userId, action: row.type,
      category: this.resolveCategory(row.type), status: 'SUCCESS',
      description: '', createdAt: row.occurredAt,
      durationMs: (row.durationSec ?? 0) * 1000,
      source: 'LEARNING',
      metadata: { ...row.metadata, title: row.title, xp: row.xp, score: row.score, correct: row.correct, total: row.total, refId: row.refId },
    }));
    const combined = [...rawItems.map((item) => ({ ...item, source: 'INTERACTION' })), ...learningItems]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime() || String(b._id).localeCompare(String(a._id)));
    const selected = includeLearning ? combined.slice(skip, skip + limit) : combined;
    const total = auditTotal + learningTotal;

    const items = await Promise.all(
      selected.map(async (item) => {
        const [actionLabel, categoryLabel, statusLabel] = await Promise.all([
          this.translateAction(item.action, lang),
          this.translateCategory(item.category, lang),
          this.translateStatus(item.status, lang),
        ]);

        return {
          ...item,
          description: await this.translateDescription(item, lang),
          actionLabel,
          categoryLabel,
          statusLabel };
      }),
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1 };
  }

  /**
   * View detail of a single activity log entry
   */
  async findById(id: string, customLang?: string) {
    if (!PgId.isValid(id)) {
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
      description: await this.translateDescription(item, lang),
      actionLabel,
      categoryLabel,
      statusLabel };
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

    const standardActions = [...Object.values(ActivityAction), ...LEARNING_ACTIVITY_TYPES];
    const mergedActions = Array.from(
      new Set([...standardActions, ...distinctActions]),
    ).sort();

    const categories = await Promise.all(
      mergedCategories.map(async (category) => ({
        value: category,
        label: await this.translateCategory(category, lang) })),
    );

    const actions = await Promise.all(
      mergedActions.map(async (action) => ({
        value: action,
        label: await this.translateAction(action, lang),
        category: this.resolveCategory(action) })),
    );

    return {
      categories,
      actions };
  }

  /**
   * Get full i18n dictionaries for activity logs (actions, categories, statuses)
   */
  async getI18n(customLang?: string) {
    const lang = this.getLang(customLang);

    const actions: Record<string, string> = {};
    for (const key of [...Object.values(ActivityAction), ...LEARNING_ACTIVITY_TYPES]) {
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
      WARNING: await this.translateStatus('WARNING', lang) };

    const messages: Record<string, string> = {};
    for (const action of [...Object.keys(actions).flatMap((key) => [key, `${key}_WITH_TITLE`]), 'WITH_TITLE', 'FAILED_ACTION', 'VOCABULARY_UNSAVE', 'VOCABULARY_UNSAVE_WITH_TITLE']) {
      const key = `activity-log.messages.${action}`;
      const value = await this.i18n.translate(key, { lang });
      if (typeof value === 'string' && value !== key) messages[action] = value;
    }
    return {
      lang,
      actions,
      categories,
      messages,
      status };
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
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Top active users
      this.activityLogModel.aggregate([
        {
          $match: {
            ...rangeFilter,
            userEmail: { $ne: null, $exists: true } } },
        {
          $group: {
            _id: '$userEmail',
            userName: { $first: '$userName' },
            userId: { $first: '$userId' },
            count: { $sum: 1 },
            lastActive: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const categoryBreakdown = await Promise.all(
      categoryCounts.map(async (c) => ({
        category: c._id,
        label: await this.translateCategory(c._id, lang),
        count: c.count,
        percentage: totalActivities ? Math.round((c.count / totalActivities) * 100) : 0 })),
    );

    const topActions = await Promise.all(
      actionCounts.map(async (a) => ({
        action: a._id,
        label: await this.translateAction(a._id, lang),
        count: a.count })),
    );

    return {
      period: {
        days,
        startDate,
        endDate },
      summary: {
        totalActivities,
        activitiesToday,
        uniqueUsers },
      categoryBreakdown,
      topActions,
      dailyTimeline: dailyTimeline.map((d) => ({
        date: d._id,
        count: d.count })),
      topActiveUsers: topUsers.map((u) => ({
        email: u._id,
        name: u.userName || u._id.split('@')[0],
        userId: u.userId,
        count: u.count,
        lastActive: u.lastActive })) };
  }
}
