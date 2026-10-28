import { BadRequestException,Injectable,Logger } from '@nestjs/common';
import { I18nContext,I18nService } from 'nestjs-i18n';
import { InjectPgConnection,type PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { SqlRecords } from '../../postgres/records.js';
import { first,joinSql,literal,rows,sql,type Sql } from '../../postgres/sql.js';
import { LEARNING_ACTIVITY_TYPES } from '../learning-activity/rows/learning-activity.row.js';
import { learningFeed } from '../learning/learning-reader.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { QueryActivityStatsDto } from './dto/query-activity-stats.dto.js';
import {
ActivityAction,
ActivityCategory,
ActivityLog,
ActivityLogRow
} from './rows/activity-log.row.js';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(@InjectPgConnection() private readonly db:PgConnection,private readonly i18n:I18nService){}
  private get logs(){return new SqlRecords(this.db,'activitylogs');}
  private get users(){return new SqlRecords(this.db,'identity_profiles');}
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
  async log(dto: CreateActivityLogDto): Promise<ActivityLogRow | null> {
    try {
      let resolvedUserId:string|undefined;
      let userEmail = dto.userEmail;
      let userName = dto.userName;

      if (dto.userId && isUuid(dto.userId)) {
        resolvedUserId = dto.userId;

        // Fetch user snapshot if email or name is missing
        if (!userEmail || !userName) {
          try {
            const user=await this.users.one(sql`id=${resolvedUserId}::uuid`);
            if (user) {
              userEmail = userEmail || user.email;
              userName = userName || user.username || user.email?.split('@')[0];
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

      const created = await this.logs.insert({
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

    const conditions:Sql[]=[literal('TRUE')];
    if(query.userId&&!isUuid(query.userId))throw new BadRequestException(await this.i18n.translate('activity-log.errors.INVALID_USER',{lang}));
    if(query.includeLearning==='true'&&!query.userId)throw new BadRequestException(await this.i18n.translate('activity-log.errors.USER_REQUIRED',{lang}));
    if(query.category&&query.category!=='ALL')conditions.push(sql`category=${JSON.stringify(query.category)}::jsonb`);
    if(query.action&&query.action!=='ALL')conditions.push(sql`action=${query.action}`);
    if(query.status&&query.status!=='ALL')conditions.push(sql`status=${query.status}`);
    if(query.userId)conditions.push(sql`user_id=${query.userId}::uuid`);
    if(query.userEmail)conditions.push(sql`user_email ILIKE '%'||${query.userEmail.trim()}||'%'`);
    if(query.includeLearning==='true'&&query.userId&&!await this.users.one(sql`id=${query.userId}::uuid`))
      throw new BadRequestException(await this.i18n.translate('activity-log.errors.INVALID_USER',{lang}));
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

    const from=query.startDate?new Date(query.startDate.length===10?`${query.startDate}T00:00:00+07:00`:query.startDate):null;
    const to=query.endDate?new Date(query.endDate.length===10?`${query.endDate}T23:59:59.999+07:00`:query.endDate):null;
    if(from)conditions.push(sql`created_at>=${from}`);if(to)conditions.push(sql`created_at<=${to}`);
    if(query.search?.trim())conditions.push(sql`(user_email ILIKE '%'||${query.search.trim()}||'%' OR user_name ILIKE '%'||${query.search.trim()}||'%'
      OR description ILIKE '%'||${query.search.trim()}||'%' OR action ILIKE '%'||${query.search.trim()}||'%' OR action=ANY(${matchedActions}::text[]))`);
    const includeLearning=query.includeLearning==='true',where=joinSql(conditions,' AND ');
    const [rawItems,auditTotal,learning]=await Promise.all([
      this.logs.select(where,sql`ORDER BY created_at DESC,id DESC LIMIT ${includeLearning?skip+limit:limit} OFFSET ${includeLearning?0:skip}`),this.logs.count(where),
      includeLearning?learningFeed(this.db,{userId:query.userId!,module:query.category&&query.category!=='ALL'?(query.category==='ASSESSMENT'?'TOEIC':query.category):undefined,
        type:query.action&&query.action!=='ALL'?query.action:undefined,disabled:!!query.status&&query.status!=='ALL'&&query.status!=='SUCCESS',
        from:from?.toISOString(),to:to?.toISOString(),search:query.search?.trim(),matchedTypes:matchedActions.filter(action=>LEARNING_ACTIVITY_TYPES.includes(action as never)),limit:skip+limit}):Promise.resolve({items:[],total:0}),
    ]);
    const learningRows=learning.items,learningTotal=learning.total;
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
    if (!isUuid(id)) {
      return null;
    }
    const item = await this.logs.one(sql`id=${id}::uuid`);
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
      rows(this.db,sql`SELECT DISTINCT category AS value FROM public.activitylogs`).then(result=>result.map(row=>String(row.value))),
      rows(this.db,sql`SELECT DISTINCT action AS value FROM public.activitylogs`).then(result=>result.map(row=>String(row.value))),
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

    const range=sql`created_at>=${startDate} AND created_at<=${endDate}`;
    const [summary,categoryCounts,actionCounts,dailyTimeline,topUsers]=await Promise.all([
      first(this.db,sql`SELECT (SELECT COUNT(*)::integer FROM public.activitylogs WHERE ${range}) AS total,
        (SELECT COUNT(*)::integer FROM public.activitylogs WHERE created_at>=${todayStart}) AS today,
        (SELECT COUNT(DISTINCT user_id)::integer FROM public.activitylogs WHERE ${range}) AS users`),
      rows(this.db,sql`SELECT category AS "_id",COUNT(*)::integer AS count FROM public.activitylogs WHERE ${range} GROUP BY category ORDER BY count DESC`),
      rows(this.db,sql`SELECT action AS "_id",COUNT(*)::integer AS count FROM public.activitylogs WHERE ${range} GROUP BY action ORDER BY count DESC LIMIT 10`),
      rows(this.db,sql`SELECT TO_CHAR(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS "_id",COUNT(*)::integer AS count FROM public.activitylogs WHERE ${range} GROUP BY 1 ORDER BY 1`),
      rows(this.db,sql`SELECT user_email AS "_id",(ARRAY_AGG(user_name ORDER BY created_at,id))[1] AS "userName",
        (ARRAY_AGG(user_id ORDER BY created_at,id))[1] AS "userId",COUNT(*)::integer AS count,MAX(created_at) AS "lastActive"
        FROM public.activitylogs WHERE ${range} AND user_email IS NOT NULL GROUP BY user_email ORDER BY count DESC LIMIT 8`),
    ]);
    const totalActivities=Number(summary?.total??0),activitiesToday=Number(summary?.today??0),uniqueUsers=Number(summary?.users??0);
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
