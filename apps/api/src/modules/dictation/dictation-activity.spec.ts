import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createConnection, Schema, Types } from 'mongoose';
import { DictationService } from './dictation.service.js';

// The real lesson schema uses enum props whose types come from decorator
// metadata, which vitest (esbuild) does not emit.
vi.mock('./schemas/dictation-lesson.schema.js', () => ({
  DictationLesson: class DictationLesson {},
  DictationLessonSchema: {},
  DictationStatus: { PUBLISHED: 'PUBLISHED' },
  DictationAudioSource: { TTS: 'TTS', UPLOAD: 'UPLOAD' },
  DictationLevel: {},
}));
vi.mock('../users/schema/user.schema.js', () => ({
  User: class User {},
  UserSchema: {},
  AuthProvider: { LOCAL: 'local', GOOGLE: 'google' },
}));
import { DictationProgressSchema } from './schemas/dictation-progress.schema.js';
import { LearningActivityService } from '../learning-activity/learning-activity.service.js';
import { LearningActivitySchema } from '../learning-activity/schemas/learning-activity.schema.js';

describe.skipIf(!process.env.TOEIC_TEST_MONGO_URI)(
  'dictation lesson completion activity',
  () => {
    const connection = createConnection();
    const prefix = `dictation_activity_${new Types.ObjectId()}_`;
    let service: DictationService;
    let activities: any;
    let lessonId: string;

    beforeAll(async () => {
      await connection.openUri(process.env.TOEIC_TEST_MONGO_URI!);
      // Only the fields the progress flow reads (the full schema needs
      // decorator metadata that vitest does not emit).
      const lessons = connection.model(
        'DictationLesson',
        new Schema({
          title: String,
          slug: String,
          status: String,
          sentenceCount: Number,
          totalDurationMs: Number,
          isDeleted: Boolean,
        }),
        `${prefix}lessons`,
      );
      const progress = connection.model(
        'DictationProgress',
        DictationProgressSchema,
        `${prefix}progress`,
      );
      activities = connection.model(
        'LearningActivity',
        LearningActivitySchema,
        `${prefix}activities`,
      );
      await activities.syncIndexes();
      const none = {} as never;
      service = new DictationService(
        lessons as never,
        none,
        progress as never,
        none,
        none,
        none,
        none,
        none,
        none,
        { get: () => undefined } as never,
        new LearningActivityService(activities),
      );
      lessonId = String(
        (
          await lessons.create({
            title: 'Morning routine',
            slug: `${prefix}lesson`,
            status: 'PUBLISHED',
            sentenceCount: 2,
          })
        )._id,
      );
    });

    afterAll(async () => {
      // Other suites share this database in parallel: drop only our collections.
      for (const { name } of await connection.db!.listCollections().toArray())
        if (name.startsWith(prefix)) await connection.db!.dropCollection(name);
      await connection.close();
    });

    it('records a lesson once when it becomes completed, and again after a reset', async () => {
      const user = String(new Types.ObjectId());
      const count = () => activities.countDocuments({ module: 'DICTATION' });

      await service.recordAttempt(user, lessonId, 0, true);
      expect(await count()).toBe(0);
      await service.recordAttempt(user, lessonId, 1, false);
      await service.recordAttempt(user, lessonId, 1, true);
      expect(await count()).toBe(1);
      expect(
        await activities.findOne({ module: 'DICTATION' }).lean(),
      ).toMatchObject({
        title: 'Morning routine',
        correct: 2,
        total: 2,
        // 10 + 1 sentence right on the first try.
        xp: 11,
      });

      // Practising a completed lesson again does not add another activity.
      await service.recordAttempt(user, lessonId, 0, true);
      await service.revealSegment(user, lessonId, 1);
      expect(await count()).toBe(1);

      await service.resetProgress(user, lessonId);
      await service.recordAttempt(user, lessonId, 0, true);
      await service.revealSegment(user, lessonId, 1);
      expect(await count()).toBe(2);
    });
  },
);
