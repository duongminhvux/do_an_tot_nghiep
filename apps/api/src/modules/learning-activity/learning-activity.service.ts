import { PgId } from '../../postgres/compat.js';
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
  ) {}

  /**
   * Records a completed activity once per (user, sourceKey). Best effort: a
   * failure is logged and never breaks the learning flow that triggered it.
   */
  async record(input: RecordActivityInput): Promise<boolean> {
    try {
      const { userId, sourceKey, ...fields } = input;
      const result = await this.activities
        .updateOne(
          { userId: new PgId(String(userId)), sourceKey },
          {
            $setOnInsert: {
              ...fields,
              xp: Math.max(0, Math.round(fields.xp)),
              occurredAt: fields.occurredAt ?? new Date() } },
          { upsert: true },
        )
        .exec();
      return result.upsertedCount > 0;
    } catch (error) {
      this.logger.warn(
        `Could not record ${input.sourceKey}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async home(userId: string, timezone = DEFAULT_TIMEZONE) {
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
            durationSec: { $sum: { $ifNull: ['$durationSec', 0] } } } },
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
      day.durationSec += row.durationSec;
      day.byModule[row._id.module] = {
        xp: row.xp,
        count: row.count,
        durationSec: row.durationSec };
      days.set(row._id.day, day);
      for (const target of [totals, byModule[row._id.module]]) {
        target.xp += row.xp;
        target.count += row.count;
        target.durationSec += row.durationSec;
      }
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone }).format(new Date());
    const sum = (from: number, to: number) => {
      const result = emptyTotals();
      for (let i = from; i < to; i++) {
        const day = days.get(addDays(today, -i));
        if (!day) continue;
        result.xp += day.xp;
        result.count += day.count;
        result.durationSec += day.durationSec;
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
        durationSec: todayTotals.durationSec },
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
        .map(([date, day]) => ({ date, ...day })) };
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
