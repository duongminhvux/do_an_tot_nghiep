import {
BadRequestException,
Body,
Controller,
ForbiddenException,
Headers,
Post
} from '@nestjs/common';
import type { LearningModule } from '@repo/shared-types/learning-xp';
import { LEARNING_MODULES } from '@repo/shared-types/learning-xp';
import { timingSafeEqual } from 'node:crypto';
import { isUuid } from '../../postgres/ids.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { RecordActivityInput } from './learning-activity.service.js';
import { LearningActivityService } from './learning-activity.service.js';
import type { LearningActivityType } from './rows/learning-activity.row.js';
import { LEARNING_ACTIVITY_TYPES } from './rows/learning-activity.row.js';

@Controller('_internal/learning')
export class InternalLearningActivityController {
  constructor(private readonly activities: LearningActivityService) {}

  @Public()
  @Post('activity')
  async record(
    @Headers('x-internal-token') supplied: string,
    @Body() payload: Record<string, unknown>,
  ) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN || '';
    if (expected.length < 24 || typeof supplied !== 'string' ||
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      throw new ForbiddenException('Internal token invalid');
    }
    if (!payload || typeof payload !== 'object' ||
      typeof payload.userId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.userId) ||
      !isUuid(payload.userId) ||
      typeof payload.sourceKey !== 'string' ||
      payload.sourceKey.length < 1 || payload.sourceKey.length > 250 ||
      typeof payload.module !== 'string' ||
      !LEARNING_MODULES.includes(payload.module as LearningModule) ||
      typeof payload.type !== 'string' ||
      !LEARNING_ACTIVITY_TYPES.includes(payload.type as LearningActivityType) ||
      typeof payload.xp !== 'number' ||
      !Number.isFinite(payload.xp) || payload.xp < 0 || payload.xp > 10000) {
      throw new BadRequestException('Invalid learning activity');
    }
    const occurredAt = payload.occurredAt === undefined
      ? new Date() : new Date(String(payload.occurredAt));
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Invalid occurredAt');
    }
    // Never blindly persist arbitrary client fields. An internal access token
    // authorizes delivery, not unrestricted writes to the SQL table.
    const text = (name: string, max = 500) =>
      typeof payload[name] === 'string' ? payload[name].slice(0, max) : undefined;
    const number = (name: string) =>
      typeof payload[name] === 'number' && Number.isFinite(payload[name])
        ? payload[name] as number : undefined;
    const metadata = payload.metadata && typeof payload.metadata === 'object' &&
      !Array.isArray(payload.metadata)
      ? payload.metadata as Record<string, unknown> : undefined;
    const input: RecordActivityInput = {
      userId: payload.userId,
      sourceKey: payload.sourceKey,
      module: payload.module as LearningModule,
      type: payload.type as LearningActivityType,
      xp: payload.xp,
      occurredAt,
      title: text('title'),
      refId: text('refId', 100),
      link: text('link'),
      correct: number('correct'),
      total: number('total'),
      score: number('score'),
      durationSec: number('durationSec'),
      metadata };
    return { created: await this.activities.record(input) };
  }
}
