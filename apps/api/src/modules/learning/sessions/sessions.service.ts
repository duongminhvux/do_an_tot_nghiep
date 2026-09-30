import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LearningSession,
  LearningSessionDocument,
} from './schemas/learning-session.schema.js';
import {
  LearningSessionWord,
  LearningSessionWordDocument,
} from './schemas/learning-session-word.schema.js';
import {
  UserLessonProgress,
  UserLessonProgressDocument,
} from '../progress/schemas/user-lesson-progress.schema.js';
import {
  UserLessonWord,
  UserLessonWordDocument,
} from '../progress/schemas/user-lesson-word.schema.js';
import {
  UserWordReview,
  UserWordReviewDocument,
} from '../reviews/schemas/user-word-review.schema.js';
import {
  UserDailyActivity,
  UserDailyActivityDocument,
} from '../progress/schemas/user-daily-activity.schema.js';
import {
  Lesson,
  LessonDocument,
} from '../../vocabulary/lessons/lesson.schema.js';
import {
  LessonWord,
  LessonWordDocument,
} from '../../vocabulary/lessons/lesson-word.schema.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { RecordActionDto } from './dto/record-action.dto.js';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(LearningSession.name)
    private sessionModel: Model<LearningSessionDocument>,
    @InjectModel(LearningSessionWord.name)
    private sessionWordModel: Model<LearningSessionWordDocument>,
    @InjectModel(UserLessonProgress.name)
    private progressModel: Model<UserLessonProgressDocument>,
    @InjectModel(UserLessonWord.name)
    private userLessonWordModel: Model<UserLessonWordDocument>,
    @InjectModel(UserWordReview.name)
    private reviewModel: Model<UserWordReviewDocument>,
    @InjectModel(Lesson.name)
    private lessonModel: Model<LessonDocument>,
    @InjectModel(LessonWord.name)
    private lessonWordModel: Model<LessonWordDocument>,
    @InjectModel(UserDailyActivity.name)
    private dailyActivityModel: Model<UserDailyActivityDocument>,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Khởi tạo phiên học mới (khi user tương tác hoặc khi bắt đầu)
   */
  async create(userId: string, createSessionDto: CreateSessionDto) {
    const lesson = await this.lessonModel.findById(createSessionDto.lessonId);
    if (!lesson) {
      throw new NotFoundException(await this.i18n.t('learning.LESSON_NOT_FOUND'));
    }

    const totalWords = await this.lessonWordModel.countDocuments({
      lessonId: lesson._id,
    });

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      type: createSessionDto.type || 'LESSON',
      lessonId: lesson._id,
      startedAt: createSessionDto.startedAt
        ? new Date(createSessionDto.startedAt)
        : new Date(),
      totalWords,
      completedWords: 0,
    });

    if (session.lessonId) {
      await this.progressModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          lessonId: session.lessonId,
        },
        {
          $set: {
            lastStudiedAt: session.startedAt,
          },
          $setOnInsert: {
            status: 'IN_PROGRESS',
            progress: 0,
            startedAt: session.startedAt,
          },
        },
        { upsert: true },
      );
    }

    return session;
  }

  /**
   * Ghi nhận tương tác đánh giá từ (Atomic: Session + Review + Progress + LessonWord)
   * Tự động khởi tạo Session nếu client chưa có sessionId
   */
  async recordAction(userId: string, dto: RecordActionDto) {
    const userObjId = new Types.ObjectId(userId);
    const wordObjId = new Types.ObjectId(dto.wordId);
    const now = dto.answeredAt ? new Date(dto.answeredAt) : new Date();

    // 1. Tìm hoặc Khởi tạo LearningSession
    let session: LearningSessionDocument | null = null;
    if (dto.sessionId) {
      session = await this.sessionModel.findOne({
        _id: new Types.ObjectId(dto.sessionId),
        userId: userObjId,
      });
      if (!session) {
        throw new NotFoundException(
          await this.i18n.t('learning.SESSION_NOT_FOUND'),
        );
      }
    } else {
      if (!dto.lessonId) {
        throw new BadRequestException(
          await this.i18n.t('learning.LESSON_ID_REQUIRED'),
        );
      }
      const lesson = await this.lessonModel.findById(dto.lessonId);
      if (!lesson) {
        throw new NotFoundException(
          await this.i18n.t('learning.LESSON_NOT_FOUND'),
        );
      }
      const totalWords = await this.lessonWordModel.countDocuments({
        lessonId: lesson._id,
      });

      session = await this.sessionModel.create({
        userId: userObjId,
        type: 'LESSON',
        lessonId: lesson._id,
        startedAt: dto.sessionStartedAt
          ? new Date(dto.sessionStartedAt)
          : now,
        totalWords,
        completedWords: 0,
      });
    }

    // 2. Xác định LessonWord ID tương ứng (nếu chưa truyền)
    let lessonWordId: Types.ObjectId | undefined = undefined;
    if (dto.lessonWordId) {
      lessonWordId = new Types.ObjectId(dto.lessonWordId);
    } else if (session.lessonId) {
      const lw = await this.lessonWordModel.findOne({
        lessonId: session.lessonId,
        wordId: wordObjId,
      });
      if (lw) {
        lessonWordId = lw._id;
      }
    }

    // 3. Ghi log tương tác: LearningSessionWord
    const sessionWord = await this.sessionWordModel.create({
      sessionId: session._id,
      wordId: wordObjId,
      lessonWordId,
      mode: dto.mode,
      rating: dto.rating,
      isCorrect: dto.isCorrect,
      answeredAt: now,
    });

    // Cập nhật số từ độc lập đã làm trong session
    const evaluatedWordIds = await this.sessionWordModel.distinct('wordId', {
      sessionId: session._id,
    });
    session.completedWords = evaluatedWordIds.length;
    await session.save();

    // 4. CHỈ KHI NÀO người dùng bấm chọn 1 trong 4 nút (AGAIN, HARD, GOOD, EASY) thì mới tạo UserLessonWord
    const isRatingSelected =
      !!dto.rating && ['AGAIN', 'HARD', 'GOOD', 'EASY'].includes(dto.rating);

    let review: UserWordReviewDocument | null = null;
    let lessonProgress: UserLessonProgressDocument | null = null;

    if (isRatingSelected) {
      // 4.1. Tạo / Cập nhật UserLessonWord (Đánh dấu từ đã học trong Lesson)
      if (lessonWordId) {
        const isMasteredRating = dto.rating === 'GOOD' || dto.rating === 'EASY';
        await this.userLessonWordModel.findOneAndUpdate(
          {
            userId: userObjId,
            lessonWordId,
          },
          {
            $setOnInsert: { learnedAt: now },
            ...(isMasteredRating ? { $set: { completedAt: now } } : {}),
          },
          { upsert: true, new: true },
        );
      }

      // 4.2. Cập nhật UserWordReview (Thuật toán lặp lại ngắt quãng SRS)
      review = await this.reviewModel.findOne({
        userId: userObjId,
        wordId: wordObjId,
      });

      if (!review) {
        review = new this.reviewModel({
          userId: userObjId,
          wordId: wordObjId,
          status: 'LEARNING',
          reviewCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          intervalDays: 0,
        });
      }

      review.reviewCount += 1;
      review.lastReviewedAt = now;

      const isAgain = dto.rating === 'AGAIN';
      const isHard = dto.rating === 'HARD';
      const isEasy = dto.rating === 'EASY';

      if (isAgain) {
        review.incorrectCount += 1;
        review.intervalDays = 0;
        review.status = 'LEARNING';
        // Học lại sau 10 phút
        review.nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
      } else if (isHard) {
        review.intervalDays = Math.max(1, Math.round((review.intervalDays || 1) * 1.2));
        review.nextReviewAt = new Date(
          now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
        );
      } else if (isEasy) {
        review.correctCount += 1;
        review.intervalDays =
          review.intervalDays === 0 ? 3 : Math.round(review.intervalDays * 3.5);
        if (review.reviewCount >= 2) {
          review.status = 'MASTERED';
        }
        review.nextReviewAt = new Date(
          now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
        );
      } else {
        // 'GOOD'
        review.correctCount += 1;
        review.intervalDays =
          review.intervalDays === 0
            ? 1
            : review.intervalDays === 1
              ? 3
              : Math.round(review.intervalDays * 2.5);
        if (review.reviewCount >= 4 && review.correctCount >= 3) {
          review.status = 'MASTERED';
        }
        review.nextReviewAt = new Date(
          now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
        );
      }

      await review.save();

      if (review.reviewCount === 1) {
        await this.incrementDailyActivity(userObjId, now, { wordsLearned: 1 });
      } else {
        await this.incrementDailyActivity(userObjId, now, { wordsReviewed: 1 });
      }

      // 4.3. Tính toán và cập nhật UserLessonProgress
      if (session.lessonId) {
        const allLessonWords = await this.lessonWordModel
          .find({ lessonId: session.lessonId })
          .select('_id');

        const allLessonWordIds = allLessonWords.map((lw) => lw._id);
        const totalLessonWords = allLessonWordIds.length || 1;

        const learnedCount = await this.userLessonWordModel.countDocuments({
          userId: userObjId,
          lessonWordId: { $in: allLessonWordIds },
        });

        const progressPercent = Math.min(
          100,
          Math.round((learnedCount / totalLessonWords) * 100),
        );
        const lessonStatus =
          progressPercent >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

        lessonProgress = await this.progressModel.findOneAndUpdate(
          {
            userId: userObjId,
            lessonId: session.lessonId,
          },
          {
            $set: {
              progress: progressPercent,
              status: lessonStatus,
              lastStudiedAt: now,
              ...(progressPercent >= 100 ? { completedAt: now } : {}),
            },
            $setOnInsert: {
              startedAt: session.startedAt || now,
            },
          },
          { upsert: true, new: true },
        );
      }
    } else {
      // Nếu chưa bấm chọn 4 nút, lấy dữ liệu hiện tại (nếu có)
      if (session.lessonId) {
        lessonProgress = await this.progressModel.findOne({
          userId: userObjId,
          lessonId: session.lessonId,
        });
      }
      review = await this.reviewModel.findOne({
        userId: userObjId,
        wordId: wordObjId,
      });
    }

    return {
      sessionId: String(session._id),
      sessionWordId: String(sessionWord._id),
      completedWords: session.completedWords,
      totalWords: session.totalWords,
      progress: lessonProgress?.progress ?? 0,
      lessonStatus: lessonProgress?.status ?? 'IN_PROGRESS',
      wordReview: review
        ? {
            status: review.status,
            intervalDays: review.intervalDays,
            nextReviewAt: review.nextReviewAt,
          }
        : undefined,
    };
  }

  /**
   * Kết thúc phiên học (khi hoàn thành bài hoặc user thoát)
   */
  async complete(userId: string, sessionId: string, endedAt?: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });
    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('learning.SESSION_NOT_FOUND'),
      );
    }

    session.endedAt = endedAt ? new Date(endedAt) : new Date();
    const durationSeconds = Math.max(
      0,
      Math.round(
        (session.endedAt.getTime() - session.startedAt.getTime()) / 1000,
      ),
    );
    session.durationSeconds = durationSeconds;
    await session.save();

    const studyMinutes = Math.max(1, Math.round(durationSeconds / 60));
    await this.incrementDailyActivity(session.userId, session.endedAt, {
      sessionCount: 1,
      studyMinutes,
    });

    return session;
  }

  async findOne(userId: string, id: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('learning.SESSION_NOT_FOUND'),
      );
    }
    return session;
  }

  async findAll(userId: string) {
    return this.sessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ startedAt: -1 })
      .limit(50);
  }

  async incrementDailyActivity(
    userId: Types.ObjectId,
    date: Date,
    inc: {
      studyMinutes?: number;
      wordsLearned?: number;
      wordsReviewed?: number;
      sessionCount?: number;
    },
  ) {
    try {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);

      const incFields: Record<string, number> = {};
      if (inc.studyMinutes) incFields.studyMinutes = inc.studyMinutes;
      if (inc.wordsLearned) incFields.wordsLearned = inc.wordsLearned;
      if (inc.wordsReviewed) incFields.wordsReviewed = inc.wordsReviewed;
      if (inc.sessionCount) incFields.sessionCount = inc.sessionCount;

      if (Object.keys(incFields).length === 0) return;

      await this.dailyActivityModel.findOneAndUpdate(
        { userId, date: dayStart },
        { $inc: incFields },
        { upsert: true, new: true },
      );
    } catch {
      // Ignored to prevent breaking session operations
    }
  }
}
