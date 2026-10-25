import { ActiveTimeService } from './active-time.service.js';
import { PgId, InjectPgConnection, type PgConnection } from '../../postgres/compat.js';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectPgModel } from '../../postgres/compat.js';
import { Model } from '../../postgres/compat.js';
import {
  DAILY_GOAL_XP,
  LEARNING_MODULES } from '@repo/shared-types/learning-xp';
import type { LearningModule } from '@repo/shared-types/learning-xp';
import {
  LearningActivity,
  type LearningActivityType } from './schemas/learning-activity.schema.js';

export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';
const HEATMAP_DAYS = 90;
// Single-word events earn XP and keep the streak, but are too fine-grained to
// count as an "activity" or to appear in the recent feed (the session does).
const WORD_TYPES: LearningActivityType[] = ['WORD_LEARNED', 'WORD_REVIEWED'];
const GROWTH_DAYS = 7;

export interface RecordActivityInput {
  userId: string | PgId;
  module: LearningModule;
  type: LearningActivityType;
  sourceKey: string;
  xp: number;
  occurredAt?: Date;
  title?: string;
  refId?: string;
  link?: string;
  correct?: number;
  total?: number;
  score?: number;
  durationSec?: number;
  metadata?: Record<string, unknown>;
}

export interface LearningActivityWriter {
  record(input: RecordActivityInput): Promise<boolean>;
}

export interface DayTotals {
  xp: number;
  count: number;
  durationSec: number;
}

const emptyTotals = (): DayTotals => ({ xp: 0, count: 0, durationSec: 0 });

// 'YYYY-MM-DD' calendar arithmetic, independent of the server time zone.
function addDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function growth(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

@Injectable()
export class LearningActivityService {
  private readonly logger = new Logger(LearningActivityService.name);

  constructor(
    @InjectPgModel(LearningActivity.name)
    private readonly activities: Model<LearningActivity>,
    @InjectPgConnection() private readonly connection: PgConnection,
    private readonly activeTime: ActiveTimeService,
  ) {}

  /** Exactly-once learning credit effect using one PostgreSQL transaction.
   * This is a learning-owned operation. External owners publish outbox events;
   * the Learning consumer applies the same activity + ledger invariant.
   */
  async record(input: RecordActivityInput): Promise<boolean> {
    if (!input.sourceKey || input.sourceKey.length > 250 ||
        !Number.isFinite(input.xp) || input.xp < 0) {
      throw new Error('Invalid learning credit');
    }
    const client = await this.connection.pool.connect();
    const userId = String(input.userId);
    const activityId = randomUUID();
    const xp = Math.max(0, Math.round(input.xp));
    const occurredAt = input.occurredAt ?? new Date();
    const payload = { ...input, userId, occurredAt: occurredAt.toISOString(), xp };
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{id:string}>(`INSERT INTO public.learning_activities
        (id,user_id,module,type,source_key,xp,occurred_at,title,ref_id,link,
         correct,total,score,duration_sec,metadata,payload)
        VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)
        ON CONFLICT (user_id,source_key) DO NOTHING RETURNING id`,
        [activityId,userId,input.module,input.type,input.sourceKey,xp,occurredAt,
         input.title ?? null,input.refId ?? null,input.link ?? null,
         input.correct ?? null,input.total ?? null,input.score ?? null,
         input.durationSec ?? null,JSON.stringify(input.metadata ?? {}),JSON.stringify(payload)]);
      if (inserted.rows.length) {
        await client.query(`INSERT INTO public.learning_credit_ledger
          (id,user_id,source_key,event_id,source_service,xp,activity_id,occurred_at)
          VALUES($1,$2::uuid,$3,$4,'learning',$5,$6,$7)`,
          [randomUUID(),userId,input.sourceKey,randomUUID(),xp,activityId,occurredAt]);
      }
      await client.query('COMMIT');
      return inserted.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Learning credit failed for ${input.sourceKey}`, (error as Error).stack);
      throw error;
    } finally {
      client.release();
    }
  }

  async home(userId: string, timezone = DEFAULT_TIMEZONE) {
    const activeByDay = await this.activeTime.daily(userId, timezone);
    const rows = await this.activities
      .aggregate<{
        _id: { day: string; module: LearningModule };
        xp: number;
        count: number;
        durationSec: number;
      }>([
        { $match: { userId: new PgId(userId) } },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$occurredAt',
                  timezone } },
              module: '$module' },
            xp: { $sum: '$xp' },
            count: {
              $sum: { $cond: [{ $in: ['$type', WORD_TYPES] }, 0, 1] } },
            durationSec: { $sum: 0 } } },
      ])
      .exec();

    const days = new Map<
      string,
      DayTotals & { byModule: Partial<Record<LearningModule, DayTotals>> }
    >();
    const totals = emptyTotals();
    const byModule = Object.fromEntries(
      LEARNING_MODULES.map((m) => [m, emptyTotals()]),
    ) as Record<LearningModule, DayTotals>;
    for (const row of rows) {
      const day = days.get(row._id.day) ?? { ...emptyTotals(), byModule: {} };
      day.xp += row.xp;
      day.count += row.count;
      day.byModule[row._id.module] = {
        xp: row.xp,
        count: row.count,
        durationSec: 0 };
      days.set(row._id.day, day);
      for (const target of [totals, byModule[row._id.module]]) {
        target.xp += row.xp;
        target.count += row.count;
      }
    }

    totals.durationSec = [...activeByDay.values()].reduce((sum, seconds) => sum + seconds, 0);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone }).format(new Date());
    const sum = (from: number, to: number) => {
      const result = emptyTotals();
      for (let i = from; i < to; i++) {
        const date = addDays(today, -i);
        result.durationSec += activeByDay.get(date) ?? 0;
        const day = days.get(date);
        if (!day) continue;
        result.xp += day.xp;
        result.count += day.count;
      }
      return result;
    };
    const thisWeek = sum(0, GROWTH_DAYS);
    const lastWeek = sum(GROWTH_DAYS, GROWTH_DAYS * 2);

    // A streak survives until the end of today even if today has no activity yet.
    let current = 0;
    for (
      let day = days.has(today) ? today : addDays(today, -1);
      days.has(day);
      day = addDays(day, -1)
    )
      current++;
    let longest = 0;
    let run = 0;
    let previous = '';
    for (const day of [...days.keys()].sort()) {
      run = previous && addDays(previous, 1) === day ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = day;
    }

    const todayTotals = days.get(today) ?? { ...emptyTotals(), byModule: {} };
    const heatmapStart = addDays(today, -(HEATMAP_DAYS - 1));
    return {
      timezone,
      today: {
        date: today,
        xp: todayTotals.xp,
        goalXp: DAILY_GOAL_XP,
        activities: todayTotals.count,
        durationSec: activeByDay.get(today) ?? 0 },
      streak: { current, longest, activeToday: days.has(today) },
      totals: { ...totals, activeDays: days.size },
      week: thisWeek,
      growth: {
        xp: growth(thisWeek.xp, lastWeek.xp),
        count: growth(thisWeek.count, lastWeek.count),
        durationSec: growth(thisWeek.durationSec, lastWeek.durationSec) },
      byModule,
      heatmap: [...days.entries()]
        .filter(([day]) => day >= heatmapStart)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, day]) => ({ date, ...day, durationSec: activeByDay.get(date) ?? 0 })) };
  }

  async recent(userId: string, limit = 20, before?: Date) {
    const rows = await this.activities
      .find({
        userId: new PgId(userId),
        type: { $nin: WORD_TYPES },
        ...(before ? { occurredAt: { $lt: before } } : {}) })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(50, limit)))
      .select('-userId -sourceKey')
      .lean()
      .exec();
    return rows.map(({ _id, ...row }) => ({ ...row, id: String(_id) }));
  }
}
