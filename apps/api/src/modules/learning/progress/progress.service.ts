import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserLessonProgress,
  UserLessonProgressDocument,
} from './schemas/user-lesson-progress.schema.js';
import {
  UserLessonWord,
  UserLessonWordDocument,
} from './schemas/user-lesson-word.schema.js';
import {
  UserWordReview,
  UserWordReviewDocument,
} from '../reviews/schemas/user-word-review.schema.js';
import {
  Lesson,
  LessonDocument,
} from '../../vocabulary/lessons/lesson.schema.js';
import {
  Section,
  SectionDocument,
} from '../../vocabulary/lessons/section.schema.js';
import {
  LessonWord,
  LessonWordDocument,
} from '../../vocabulary/lessons/lesson-word.schema.js';
import {
  LearningSession,
  LearningSessionDocument,
} from '../sessions/schemas/learning-session.schema.js';
import {
  Collection,
  CollectionDocument,
} from '../../vocabulary/collections/collection.schema.js';
import {
  UserDailyActivity,
  UserDailyActivityDocument,
} from './schemas/user-daily-activity.schema.js';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(UserLessonProgress.name)
    private progressModel: Model<UserLessonProgressDocument>,
    @InjectModel(UserLessonWord.name)
    private userLessonWordModel: Model<UserLessonWordDocument>,
    @InjectModel(UserWordReview.name)
    private reviewModel: Model<UserWordReviewDocument>,
    @InjectModel(Lesson.name)
    private lessonModel: Model<LessonDocument>,
    @InjectModel(Section.name)
    private sectionModel: Model<SectionDocument>,
    @InjectModel(LessonWord.name)
    private lessonWordModel: Model<LessonWordDocument>,
    @InjectModel(LearningSession.name)
    private sessionModel: Model<LearningSessionDocument>,
    @InjectModel(Collection.name)
    private collectionModel: Model<CollectionDocument>,
    @InjectModel(UserDailyActivity.name)
    private dailyActivityModel: Model<UserDailyActivityDocument>,
  ) {}

  /**
   * Lấy tiến độ học chi tiết của 1 Lesson bao gồm thống kê từ đã thuộc, cần ôn, chưa học và theo từng Section
   */
  async getLessonProgress(userId: string, lessonId: string) {
    const userObjId = new Types.ObjectId(userId);
    const lessonObjId = new Types.ObjectId(lessonId);

    const progress = await this.progressModel.findOne({
      userId: userObjId,
      lessonId: lessonObjId,
    });

    const lessonWords = await this.lessonWordModel
      .find({ lessonId: lessonObjId })
      .select('_id wordId sectionId order');

    const lwMap = new Map(
      lessonWords.map((lw) => [String(lw._id), String(lw.wordId)]),
    );
    const lwIds = Array.from(lwMap.keys()).map((id) => new Types.ObjectId(id));
    const allWordIds = Array.from(
      new Set(lessonWords.map((lw) => String(lw.wordId))),
    );
    const allWordObjIds = allWordIds.map((id) => new Types.ObjectId(id));

    // 1. Lấy dữ liệu user học từ trong lesson
    const userWords = await this.userLessonWordModel.find({
      userId: userObjId,
      lessonWordId: { $in: lwIds },
    });

    // 2. Lấy dữ liệu SRS Spaced Repetition reviews
    const reviews = await this.reviewModel.find({
      userId: userObjId,
      wordId: { $in: allWordObjIds },
    });

    const reviewMap = new Map(reviews.map((r) => [String(r.wordId), r]));

    const masteredWordIdSet = new Set<string>();
    const needReviewWordIdSet = new Set<string>();

    // Phân loại từ userLessonWords
    userWords.forEach((uw) => {
      const wId = lwMap.get(String(uw.lessonWordId));
      if (!wId) return;

      const review = reviewMap.get(wId);
      const isMastered = !!uw.completedAt || review?.status === 'MASTERED';

      if (isMastered) {
        masteredWordIdSet.add(wId);
      } else {
        needReviewWordIdSet.add(wId);
      }
    });

    // Kiểm tra thêm các review
    reviews.forEach((r) => {
      const wId = String(r.wordId);
      if (r.status === 'MASTERED') {
        masteredWordIdSet.add(wId);
        needReviewWordIdSet.delete(wId);
      } else if (!masteredWordIdSet.has(wId)) {
        needReviewWordIdSet.add(wId);
      }
    });

    // Từ chưa học
    const unlearnedWordIds = allWordIds.filter(
      (wId) => !masteredWordIdSet.has(wId) && !needReviewWordIdSet.has(wId),
    );

    // 3. Lấy thông tin các Sections trong bài học
    const rawSections = await this.sectionModel
      .find({ lessonId: lessonObjId })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    // Thống kê theo từng Section/Part
    const sectionStatsMap: Record<
      string,
      {
        sectionId: string;
        name: string;
        order?: number;
        totalWords: number;
        learnedCount: number;
        masteredCount: number;
        needReviewCount: number;
        unlearnedCount: number;
        progressPercent: number;
        isCompleted: boolean;
        masteredWordIds: string[];
        needReviewWordIds: string[];
        unlearnedWordIds: string[];
      }
    > = {};

    // Khởi tạo trước cho toàn bộ sections có trong lesson
    rawSections.forEach((sec) => {
      const sId = String(sec._id);
      sectionStatsMap[sId] = {
        sectionId: sId,
        name: sec.name,
        order: sec.order,
        totalWords: 0,
        learnedCount: 0,
        masteredCount: 0,
        needReviewCount: 0,
        unlearnedCount: 0,
        progressPercent: 0,
        isCompleted: false,
        masteredWordIds: [],
        needReviewWordIds: [],
        unlearnedWordIds: [],
      };
    });

    lessonWords.forEach((lw) => {
      const secId = String(lw.sectionId || 'default');
      const wId = String(lw.wordId);

      if (!sectionStatsMap[secId]) {
        sectionStatsMap[secId] = {
          sectionId: secId,
          name: 'Phần chung',
          order: 999,
          totalWords: 0,
          learnedCount: 0,
          masteredCount: 0,
          needReviewCount: 0,
          unlearnedCount: 0,
          progressPercent: 0,
          isCompleted: false,
          masteredWordIds: [],
          needReviewWordIds: [],
          unlearnedWordIds: [],
        };
      }
      const stat = sectionStatsMap[secId]!;
      stat.totalWords += 1;
      if (masteredWordIdSet.has(wId)) {
        stat.masteredCount += 1;
        stat.masteredWordIds.push(wId);
      } else if (needReviewWordIdSet.has(wId)) {
        stat.needReviewCount += 1;
        stat.needReviewWordIds.push(wId);
      } else {
        stat.unlearnedCount += 1;
        stat.unlearnedWordIds.push(wId);
      }
    });

    // Cập nhật learnedCount, progressPercent, isCompleted cho từng section
    Object.values(sectionStatsMap).forEach((stat) => {
      stat.learnedCount = stat.masteredCount + stat.needReviewCount;
      stat.progressPercent =
        stat.totalWords > 0
          ? Math.round((stat.learnedCount / stat.totalWords) * 100)
          : 0;
      stat.isCompleted =
        stat.totalWords > 0 && stat.masteredCount >= stat.totalWords;
    });

    const sectionsList = rawSections.map((sec) => {
      const sId = String(sec._id);
      return (
        sectionStatsMap[sId] || {
          sectionId: sId,
          name: sec.name,
          order: sec.order,
          totalWords: 0,
          learnedCount: 0,
          masteredCount: 0,
          needReviewCount: 0,
          unlearnedCount: 0,
          progressPercent: 0,
          isCompleted: false,
          masteredWordIds: [],
          needReviewWordIds: [],
          unlearnedWordIds: [],
        }
      );
    });

    const totalLearnedCount = masteredWordIdSet.size + needReviewWordIdSet.size;

    return {
      lessonId,
      progress: progress?.progress ?? 0,
      status: progress?.status ?? 'NOT_STARTED',
      startedAt: progress?.startedAt,
      lastStudiedAt: progress?.lastStudiedAt,
      completedAt: progress?.completedAt,
      totalWords: lessonWords.length,
      learnedCount: totalLearnedCount,
      masteredCount: masteredWordIdSet.size,
      needReviewCount: needReviewWordIdSet.size,
      unlearnedCount: unlearnedWordIds.length,
      learnedWordIds: Array.from(
        new Set([...masteredWordIdSet, ...needReviewWordIdSet]),
      ),
      masteredWordIds: Array.from(masteredWordIdSet),
      needReviewWordIds: Array.from(needReviewWordIdSet),
      unlearnedWordIds,
      sections: sectionsList,
      sectionStats: sectionStatsMap,
    };
  }

  /**
   * Lấy chi tiết tiến độ các section trong một bài học (bao gồm số từ đã học của từng section)
   */
  async getLessonSectionsProgress(userId: string, lessonId: string) {
    const progress = await this.getLessonProgress(userId, lessonId);
    return progress.sections;
  }

  /**
   * Lấy danh sách từ vựng cần học:
   * Mặc định lọc bỏ các từ ĐÃ HỌC QUA (đã có UserLessonWord) vì các từ này đã được đưa vào UserWordReview để ôn tập riêng.
   */
  async getWordsStatus(
    userId: string,
    lessonId: string,
    excludeLearned: boolean = true,
    sectionId?: string,
    excludeMastered: boolean = false,
  ) {
    const lessonProgress = await this.getLessonProgress(userId, lessonId);
    const learnedSet = new Set(lessonProgress.learnedWordIds);
    const masteredSet = new Set(lessonProgress.masteredWordIds);

    const filter: any = { lessonId: new Types.ObjectId(lessonId) };
    if (sectionId && sectionId !== 'all') {
      filter.sectionId = new Types.ObjectId(sectionId);
    }

    const lessonWords = await this.lessonWordModel
      .find(filter)
      .populate('wordId')
      .sort({ order: 1 });

    const filteredWords = lessonWords.filter((lw) => {
      if (!lw.wordId) return false;
      const wId = String((lw.wordId as any)._id || lw.wordId);

      // Nếu excludeLearned = true: Loại bỏ các từ đã học qua (đã có trong UserLessonWord)
      if (excludeLearned && learnedSet.has(wId)) {
        return false;
      }
      // Nếu excludeMastered = true: Loại bỏ các từ đã thuộc
      if (excludeMastered && masteredSet.has(wId)) {
        return false;
      }
      return true;
    });

    return {
      lessonId,
      totalWords: lessonWords.length,
      filteredWordsCount: filteredWords.length,
      learnedCount: lessonProgress.learnedCount,
      masteredCount: lessonProgress.masteredCount,
      needReviewCount: lessonProgress.needReviewCount,
      unlearnedCount: lessonProgress.unlearnedCount,
      words: filteredWords,
    };
  }

  /**
   * Lấy tiến độ toàn bộ các bài học trong một Collection
   */
  async getCollectionProgress(userId: string, collectionId: string) {
    const userObjId = new Types.ObjectId(userId);
    const collectionObjId = new Types.ObjectId(collectionId);

    const lessons = await this.lessonModel
      .find({ collectionId: collectionObjId, isActive: true, isDeleted: false })
      .sort({ order: 1 });

    if (!lessons.length) {
      return {
        collectionId,
        overallProgress: 0,
        completedLessonsCount: 0,
        totalLessonsCount: 0,
        totalWordsCount: 0,
        masteredWords: 0,
        learningWords: 0,
        unlearnedWords: 0,
        studyMinutes: 0,
        lessons: [],
      };
    }

    const lessonIds = lessons.map((l) => l._id);

    const [progressList, allLessonWords, sessions] = await Promise.all([
      this.progressModel
        .find({
          userId: userObjId,
          lessonId: { $in: lessonIds },
        })
        .lean(),
      this.lessonWordModel
        .find({
          lessonId: { $in: lessonIds },
        })
        .select('_id wordId')
        .lean(),
      this.sessionModel
        .find({
          userId: userObjId,
          lessonId: { $in: lessonIds },
        })
        .lean(),
    ]);

    const progressMap = new Map(
      progressList.map((p) => [String(p.lessonId), p]),
    );

    let totalProgressSum = 0;
    let completedLessonsCount = 0;

    const lessonsResult = lessons.map((lesson) => {
      const p = progressMap.get(String(lesson._id));
      const prog = p?.progress ?? 0;
      totalProgressSum += prog;
      if (p?.status === 'COMPLETED') completedLessonsCount += 1;

      return {
        lessonId: String(lesson._id),
        title: lesson.title,
        slug: lesson.slug,
        wordsCount: (lesson as any).wordsCount || 0,
        order: (lesson as any).order || 0,
        progress: prog,
        status: p?.status ?? 'NOT_STARTED',
        lastStudiedAt: p?.lastStudiedAt,
      };
    });

    const allLwIds = allLessonWords.map((lw) => lw._id);
    const allWordIds = Array.from(
      new Set(allLessonWords.map((lw) => lw.wordId)),
    );
    const totalWordsCount = allLessonWords.length;

    const [userWords, reviews] = await Promise.all([
      this.userLessonWordModel
        .find({
          userId: userObjId,
          lessonWordId: { $in: allLwIds },
        })
        .lean(),
      this.reviewModel
        .find({
          userId: userObjId,
          wordId: { $in: allWordIds },
        })
        .lean(),
    ]);

    let masteredWords = 0;
    let learningWords = 0;

    userWords.forEach((uw) => {
      if (uw.completedAt) {
        masteredWords += 1;
      } else {
        learningWords += 1;
      }
    });

    const unlearnedWords = Math.max(
      0,
      totalWordsCount - masteredWords - learningWords,
    );

    let totalDurationSeconds = 0;
    for (const s of sessions) {
      totalDurationSeconds +=
        s.durationSeconds || Math.max(30, (s.completedWords || 1) * 30);
    }
    const studyMinutes =
      totalDurationSeconds > 0
        ? Math.max(1, Math.round(totalDurationSeconds / 60))
        : 0;

    const overallProgress =
      totalProgressSum > 0 ||
      completedLessonsCount > 0 ||
      masteredWords > 0 ||
      learningWords > 0
        ? Math.max(1, Math.round(totalProgressSum / lessons.length))
        : 0;

    return {
      collectionId,
      overallProgress,
      completedLessonsCount,
      totalLessonsCount: lessons.length,
      totalWordsCount,
      masteredWords,
      learningWords,
      unlearnedWords,
      studyMinutes,
      lessons: lessonsResult,
    };
  }

  /**
   * Lấy tất cả tiến độ học của user
   */
  async getAllUserProgress(userId: string) {
    return this.progressModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ lastStudiedAt: -1 });
  }

  /**
   * Thống kê tổng quan cho Widget "Học hôm nay" và "Thành tích của bạn"
   */
  async getDashboardStats(userId: string, timezoneOffset?: string) {
    const userObjId = new Types.ObjectId(userId);

    // Tính toán thời gian theo múi giờ client (offset phút, mặc định -420 cho UTC+7)
    const offsetMinutes =
      timezoneOffset !== undefined && !isNaN(Number(timezoneOffset))
        ? Number(timezoneOffset)
        : -420;

    const now = new Date();
    const localNowMs = now.getTime() - offsetMinutes * 60 * 1000;
    const localNow = new Date(localNowMs);

    const startOfTodayLocal = new Date(localNow);
    startOfTodayLocal.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(
      startOfTodayLocal.getTime() + offsetMinutes * 60 * 1000,
    );

    const endOfTodayLocal = new Date(localNow);
    endOfTodayLocal.setUTCHours(23, 59, 59, 999);
    const endOfToday = new Date(
      endOfTodayLocal.getTime() + offsetMinutes * 60 * 1000,
    );

    // 1. Số từ học hôm nay
    const todayReviewedWords = await this.reviewModel.countDocuments({
      userId: userObjId,
      lastReviewedAt: { $gte: startOfToday, $lte: endOfToday },
    });

    const todayLearnedLessonWords = await this.userLessonWordModel.countDocuments({
      userId: userObjId,
      learnedAt: { $gte: startOfToday, $lte: endOfToday },
    });

    const todayLearnedCount = Math.max(todayReviewedWords, todayLearnedLessonWords);
    const dailyGoal = 20;

    // 2. Tổng số từ đã học và từ đã ghi nhớ (Mastered)
    const [totalReviewedWords, totalMasteredWords, totalLessonWords, totalMasteredLessonWords] =
      await Promise.all([
        this.reviewModel.countDocuments({ userId: userObjId }),
        this.reviewModel.countDocuments({
          userId: userObjId,
          status: 'MASTERED',
        }),
        this.userLessonWordModel.countDocuments({ userId: userObjId }),
        this.userLessonWordModel.countDocuments({
          userId: userObjId,
          completedAt: { $exists: true, $ne: null },
        }),
      ]);

    const totalLearnedWords = Math.max(totalReviewedWords, totalLessonWords);
    const totalMastered = Math.max(totalMasteredWords, totalMasteredLessonWords);

    // 3. Tính streak: Tìm các ngày có hoạt động học
    const [sessions, reviews, progresses] = await Promise.all([
      this.sessionModel
        .find({ userId: userObjId })
        .select('startedAt')
        .lean(),
      this.reviewModel
        .find({ userId: userObjId, lastReviewedAt: { $exists: true } })
        .select('lastReviewedAt')
        .lean(),
      this.progressModel
        .find({ userId: userObjId, lastStudiedAt: { $exists: true } })
        .select('lastStudiedAt')
        .lean(),
    ]);

    const toLocalDateStr = (d: Date) => {
      const local = new Date(d.getTime() - offsetMinutes * 60 * 1000);
      return local.toISOString().slice(0, 10);
    };

    const studyDates = new Set<string>();
    sessions.forEach((s) => {
      if (s.startedAt) studyDates.add(toLocalDateStr(new Date(s.startedAt)));
    });
    reviews.forEach((r) => {
      if (r.lastReviewedAt)
        studyDates.add(toLocalDateStr(new Date(r.lastReviewedAt)));
    });
    progresses.forEach((p) => {
      if (p.lastStudiedAt)
        studyDates.add(toLocalDateStr(new Date(p.lastStudiedAt)));
    });

    const todayStr = toLocalDateStr(now);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = toLocalDateStr(yesterday);

    let streak = 0;
    let checkDate = new Date(now);

    if (studyDates.has(todayStr)) {
      while (studyDates.has(toLocalDateStr(checkDate))) {
        streak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    } else if (studyDates.has(yesterdayStr)) {
      checkDate = yesterday;
      while (studyDates.has(toLocalDateStr(checkDate))) {
        streak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    } else {
      streak = 0;
    }

    // 4. Tìm bài học đang học dở hoặc gần nhất để làm CTA
    const lastProgress = await this.progressModel
      .findOne({ userId: userObjId })
      .sort({ lastStudiedAt: -1, updatedAt: -1 })
      .populate('lessonId');

    let continueLesson: {
      lessonId: string;
      lessonTitle: string;
      lessonSlug: string;
      collectionSlug?: string;
      progress: number;
    } | null = null;

    if (lastProgress && lastProgress.lessonId) {
      const lessonObj = lastProgress.lessonId as any;
      if (lessonObj && lessonObj.slug) {
        let colSlug = '';
        if (lessonObj.collectionId) {
          const col = await this.collectionModel
            .findById(lessonObj.collectionId)
            .select('slug');
          colSlug = col?.slug || String(lessonObj.collectionId);
        }
        continueLesson = {
          lessonId: String(lessonObj._id),
          lessonTitle: lessonObj.title,
          lessonSlug: lessonObj.slug,
          collectionSlug: colSlug,
          progress: lastProgress.progress || 0,
        };
      }
    }

    return {
      dailyGoal,
      todayLearnedCount,
      streak,
      totalLearnedWords,
      totalMasteredWords: totalMastered,
      hasStudiedToday: studyDates.has(todayStr),
      continueLesson,
    };
  }

  /**
   * GET /progress/overview
   * Trả về: currentStreak, longestStreak, totalWordsLearned, totalWordsReviewed, totalStudyMinutes
   */
  async getOverview(userId: string) {
    const userObjId = new Types.ObjectId(userId);

    // 1. Tổng từ đã học
    const [totalUserLessonWords, totalReviewedWords] = await Promise.all([
      this.userLessonWordModel.countDocuments({ userId: userObjId }),
      this.reviewModel.countDocuments({ userId: userObjId }),
    ]);
    const totalWordsLearned = Math.max(totalUserLessonWords, totalReviewedWords);

    // 2. Tổng từ đã ôn (tổng reviewCount)
    const reviewAgg = await this.reviewModel.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: null, total: { $sum: '$reviewCount' } } },
    ]);
    const totalWordsReviewed = reviewAgg[0]?.total || 0;

    // 3. Tổng thời gian học (phút)
    const dailyAgg = await this.dailyActivityModel.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: null, total: { $sum: '$studyMinutes' } } },
    ]);
    const dailyMinutes = dailyAgg[0]?.total || 0;

    const sessionAgg = await this.sessionModel.aggregate([
      {
        $match: {
          userId: userObjId,
          startedAt: { $exists: true },
          endedAt: { $exists: true },
        },
      },
      {
        $project: {
          durationMinutes: {
            $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 60000],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$durationMinutes' },
        },
      },
    ]);
    const sessionMinutes = Math.round(sessionAgg[0]?.total || 0);
    const totalStudyMinutes = Math.max(dailyMinutes, sessionMinutes);

    // 4. Tính currentStreak & longestStreak
    const [dailyActivities, sessions, reviews, progresses] = await Promise.all([
      this.dailyActivityModel
        .find({ userId: userObjId })
        .select('date')
        .lean(),
      this.sessionModel
        .find({ userId: userObjId })
        .select('startedAt')
        .lean(),
      this.reviewModel
        .find({ userId: userObjId, lastReviewedAt: { $exists: true } })
        .select('lastReviewedAt')
        .lean(),
      this.progressModel
        .find({ userId: userObjId, lastStudiedAt: { $exists: true } })
        .select('lastStudiedAt')
        .lean(),
    ]);

    const studyDates = new Set<string>();
    dailyActivities.forEach((d) => {
      if (d.date) studyDates.add(new Date(d.date).toISOString().slice(0, 10));
    });
    sessions.forEach((s) => {
      if (s.startedAt)
        studyDates.add(new Date(s.startedAt).toISOString().slice(0, 10));
    });
    reviews.forEach((r) => {
      if (r.lastReviewedAt)
        studyDates.add(new Date(r.lastReviewedAt).toISOString().slice(0, 10));
    });
    progresses.forEach((p) => {
      if (p.lastStudiedAt)
        studyDates.add(new Date(p.lastStudiedAt).toISOString().slice(0, 10));
    });

    const sortedDates = Array.from(studyDates).sort();

    // Longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevTime: number | null = null;

    for (const dStr of sortedDates) {
      const curTime = new Date(`${dStr}T00:00:00.000Z`).getTime();
      if (prevTime === null) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curTime - prevTime) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevTime = curTime;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }

    // Current streak
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let currentStreak = 0;
    let checkDate = new Date(now);

    if (studyDates.has(todayStr)) {
      while (studyDates.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    } else if (studyDates.has(yesterdayStr)) {
      checkDate = yesterday;
      while (studyDates.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    // 5. Tính growth so với tuần trước
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeekActivities, lastWeekActivities] = await Promise.all([
      this.dailyActivityModel
        .find({
          userId: userObjId,
          date: { $gte: sevenDaysAgo },
        })
        .lean(),
      this.dailyActivityModel
        .find({
          userId: userObjId,
          date: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        })
        .lean(),
    ]);

    const thisWeekWordsLearned = thisWeekActivities.reduce(
      (s, a) => s + (a.wordsLearned || 0),
      0,
    );
    const thisWeekWordsReviewed = thisWeekActivities.reduce(
      (s, a) => s + (a.wordsReviewed || 0),
      0,
    );
    const thisWeekMinutes = thisWeekActivities.reduce(
      (s, a) => s + (a.studyMinutes || 0),
      0,
    );

    const lastWeekWordsLearned = lastWeekActivities.reduce(
      (s, a) => s + (a.wordsLearned || 0),
      0,
    );
    const lastWeekWordsReviewed = lastWeekActivities.reduce(
      (s, a) => s + (a.wordsReviewed || 0),
      0,
    );
    const lastWeekMinutes = lastWeekActivities.reduce(
      (s, a) => s + (a.studyMinutes || 0),
      0,
    );

    const wordsLearnedGrowth = thisWeekWordsLearned - lastWeekWordsLearned;
    const wordsReviewedGrowth = thisWeekWordsReviewed - lastWeekWordsReviewed;
    const studyMinutesGrowth = thisWeekMinutes - lastWeekMinutes;
    const streakGrowth = Math.min(currentStreak, Math.max(0, currentStreak - 3));

    return {
      currentStreak,
      longestStreak,
      totalWordsLearned,
      totalWordsReviewed,
      totalStudyMinutes,
      streakGrowth: streakGrowth > 0 ? streakGrowth : (currentStreak > 0 ? 1 : 0),
      wordsLearnedGrowth: Math.max(0, wordsLearnedGrowth || Math.min(totalWordsLearned, 12)),
      wordsReviewedGrowth: Math.max(0, wordsReviewedGrowth || Math.min(totalWordsReviewed, 8)),
      studyMinutesGrowth: Math.max(0, studyMinutesGrowth || Math.min(totalStudyMinutes, 80)),
    };
  }

  /**
   * GET /progress/activity?days=90
   * Trả về hoạt động theo từng ngày trong số ngày yêu cầu kèm chi tiết nội dung đã học
   */
  async getActivity(
    userId: string,
    days: number = 90,
    timezoneOffset?: string,
  ) {
    const userObjId = new Types.ObjectId(userId);
    const limitDays = Math.max(1, Math.min(365, Number(days) || 90));

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - limitDays);

    const [dailyActivities, sessions, userWords] = await Promise.all([
      this.dailyActivityModel
        .find({
          userId: userObjId,
          date: { $gte: startDate },
        })
        .sort({ date: 1 })
        .lean(),
      this.sessionModel
        .find({
          userId: userObjId,
          startedAt: { $gte: startDate },
        })
        .populate({
          path: 'lessonId',
          populate: { path: 'collectionId', select: 'name slug' },
        })
        .sort({ startedAt: 1 })
        .lean(),
      this.userLessonWordModel
        .find({
          userId: userObjId,
          createdAt: { $gte: startDate },
        })
        .lean(),
    ]);

    // Offset in minutes: default -420 (Vietnam UTC+7) if not provided
    const offsetMinutes =
      timezoneOffset !== undefined ? Number(timezoneOffset) : -420;

    const toDateKey = (d: Date | string | number) => {
      const date = new Date(d);
      const local = new Date(date.getTime() - offsetMinutes * 60 * 1000);
      return local.toISOString().slice(0, 10);
    };

    const dayMap = new Map<
      string,
      {
        date: string;
        dateKey: string;
        studyMinutes: number;
        wordsLearned: number;
        wordsReviewed: number;
        sessionCount: number;
        lessonsMap: Map<string, any>;
      }
    >();

    // 1. Process Sessions
    for (const s of sessions) {
      if (!s.startedAt) continue;
      const dKey = toDateKey(s.startedAt);
      if (!dayMap.has(dKey)) {
        dayMap.set(dKey, {
          date: dKey,
          dateKey: dKey,
          studyMinutes: 0,
          wordsLearned: 0,
          wordsReviewed: 0,
          sessionCount: 0,
          lessonsMap: new Map(),
        });
      }
      const day = dayMap.get(dKey)!;
      day.sessionCount += 1;
      const durMins = Math.round((s.durationSeconds || 0) / 60);
      day.studyMinutes +=
        durMins > 0
          ? durMins
          : Math.max(1, Math.round((s.completedWords || 1) * 0.5));
      if (s.type === 'REVIEW') {
        day.wordsReviewed += s.completedWords || 0;
      } else {
        day.wordsLearned += s.completedWords || 0;
      }

      if (s.lessonId) {
        const lessonObj = s.lessonId as any;
        const lIdStr = String(lessonObj._id);
        if (!day.lessonsMap.has(lIdStr)) {
          day.lessonsMap.set(lIdStr, {
            lessonId: lIdStr,
            lessonTitle: lessonObj.title || 'Bài học',
            collectionName: lessonObj.collectionId?.name || '',
            collectionSlug: lessonObj.collectionId?.slug || '',
            type: s.type || 'LESSON',
            wordsCount: 0,
          });
        }
        day.lessonsMap.get(lIdStr).wordsCount += s.completedWords || 0;
      }
    }

    // 2. Process DailyActivities
    for (const act of dailyActivities) {
      if (!act.date) continue;
      const dKey = toDateKey(act.date);
      if (!dayMap.has(dKey)) {
        dayMap.set(dKey, {
          date: dKey,
          dateKey: dKey,
          studyMinutes: act.studyMinutes || 0,
          wordsLearned: act.wordsLearned || 0,
          wordsReviewed: act.wordsReviewed || 0,
          sessionCount: act.sessionCount || 0,
          lessonsMap: new Map(),
        });
      } else {
        const day = dayMap.get(dKey)!;
        day.studyMinutes = Math.max(day.studyMinutes, act.studyMinutes || 0);
        day.wordsLearned = Math.max(day.wordsLearned, act.wordsLearned || 0);
        day.wordsReviewed = Math.max(day.wordsReviewed, act.wordsReviewed || 0);
        day.sessionCount = Math.max(day.sessionCount, act.sessionCount || 0);
      }
    }

    return Array.from(dayMap.values())
      .map((d) => ({
        date: d.date,
        dateKey: d.dateKey,
        studyMinutes: d.studyMinutes,
        wordsLearned: d.wordsLearned,
        wordsReviewed: d.wordsReviewed,
        sessionCount: d.sessionCount,
        lessons: Array.from(d.lessonsMap.values()),
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  /**
   * GET /progress/vocabulary
   * Trả về tiến độ vocabulary theo Collection
   */
  async getVocabularyProgress(userId: string) {
    const userObjId = new Types.ObjectId(userId);

    const collections = await this.collectionModel
      .find({ isActive: true, isDeleted: false })
      .sort({ order: 1 })
      .lean();

    const results = [];

    for (const col of collections) {
      const lessons = await this.lessonModel
        .find({
          collectionId: col._id,
          isActive: true,
          isDeleted: false,
        })
        .select('_id')
        .lean();

      const lessonIds = lessons.map((l) => l._id);

      if (lessonIds.length === 0) {
        results.push({
          collectionId: String(col._id),
          collectionName: col.name,
          collectionSlug: col.slug || '',
          letter: (col.name || 'C').charAt(0).toUpperCase(),
          totalWords: 0,
          learnedWords: 0,
          progress: 0,
        });
        continue;
      }

      const [lessonWords, userProgresses] = await Promise.all([
        this.lessonWordModel
          .find({ lessonId: { $in: lessonIds } })
          .select('_id')
          .lean(),
        this.progressModel
          .find({
            userId: userObjId,
            lessonId: { $in: lessonIds },
          })
          .lean(),
      ]);

      const totalWords = lessonWords.length;
      const lwIds = lessonWords.map((lw) => lw._id);

      const learnedWords = await this.userLessonWordModel.countDocuments({
        userId: userObjId,
        lessonWordId: { $in: lwIds },
      });

      // 1. Tiến độ theo bài học (tương tự như logic admin)
      const totalLessons = lessons.length;
      const completedLessonsCount = userProgresses.filter(
        (p) => p.status === 'COMPLETED',
      ).length;
      const totalProgSum = userProgresses.reduce(
        (acc, p) => acc + (p.progress || 0),
        0,
      );

      const lessonProgressPercent =
        totalLessons > 0
          ? completedLessonsCount > 0
            ? Math.round((completedLessonsCount / totalLessons) * 100)
            : totalProgSum > 0
              ? Math.max(1, Math.round(totalProgSum / totalLessons))
              : 0
          : 0;

      // 2. Tiến độ theo số từ vựng
      const wordProgressPercent =
        totalWords > 0
          ? Math.round((learnedWords / totalWords) * 100)
          : 0;

      // 3. Tổng hợp: lấy tỷ lệ lớn nhất
      let progress = Math.max(lessonProgressPercent, wordProgressPercent);
      if (progress === 0 && (userProgresses.length > 0 || learnedWords > 0)) {
        progress = 1;
      }
      progress = Math.min(100, progress);

      results.push({
        collectionId: String(col._id),
        collectionName: col.name,
        collectionSlug: col.slug || '',
        letter: (col.name || 'C').charAt(0).toUpperCase(),
        totalWords,
        learnedWords,
        completedLessonsCount,
        totalLessons,
        progress,
      });
    }

    return results;
  }

  /**
   * GET /learning/today-tasks (hoặc /progress/today-tasks)
   * Trả về việc cần học hôm nay
   */
  async getTodayTasks(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const now = new Date();

    // 1. Số từ cần ôn hôm nay (SRS due)
    const wordsToReview = await this.reviewModel.countDocuments({
      userId: userObjId,
      nextReviewAt: { $lte: now },
    });

    // 2. Bài học đang học dở hoặc gần nhất
    const lastProgress = await this.progressModel
      .findOne({ userId: userObjId })
      .sort({ lastStudiedAt: -1, updatedAt: -1 })
      .populate('lessonId')
      .lean();

    let currentLesson: {
      lessonId: string;
      title: string;
      slug: string;
      collectionName?: string;
      collectionSlug?: string;
      progress: number;
    } | null = null;

    if (lastProgress && lastProgress.lessonId) {
      const lessonObj = lastProgress.lessonId as any;
      if (lessonObj && lessonObj.slug) {
        let colName = '';
        let colSlug = '';
        if (lessonObj.collectionId) {
          const col = await this.collectionModel
            .findById(lessonObj.collectionId)
            .select('name slug')
            .lean();
          colName = col?.name || '';
          colSlug = col?.slug || String(lessonObj.collectionId);
        }
        currentLesson = {
          lessonId: String(lessonObj._id),
          title: lessonObj.title,
          slug: lessonObj.slug,
          collectionName: colName,
          collectionSlug: colSlug,
          progress: lastProgress.progress || 0,
        };
      }
    }

    if (!currentLesson) {
      const firstLesson = await this.lessonModel
        .findOne({ isActive: true, isDeleted: false })
        .sort({ order: 1, createdAt: 1 })
        .populate('collectionId')
        .lean();

      if (firstLesson) {
        const colObj = firstLesson.collectionId as any;
        currentLesson = {
          lessonId: String(firstLesson._id),
          title: firstLesson.title,
          slug: firstLesson.slug,
          collectionName: colObj?.name || '',
          collectionSlug: colObj?.slug || '',
          progress: 0,
        };
      }
    }

    const dailyGoal = 20;

    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const todayActivity = await this.dailyActivityModel.findOne({
      userId: userObjId,
      date: { $gte: startOfToday },
    });

    const todayLearnedCount = todayActivity?.wordsLearned || 0;
    const newWordsCount = Math.max(0, dailyGoal - todayLearnedCount);
    const tasksCount = (wordsToReview > 0 ? 1 : 0) + (currentLesson ? 1 : 0);

    return {
      tasksCount: Math.max(1, tasksCount),
      wordsToReview,
      newWordsCount: newWordsCount > 0 ? newWordsCount : 10,
      currentLesson,
      dailyGoal,
      todayLearnedCount,
    };
  }

  /**
   * GET /progress/recent-activity
   * Trả về các hoạt động học gần đây
   */
  async getRecentActivities(userId: string) {
    const userObjId = new Types.ObjectId(userId);

    const [recentProgresses, recentSessions] = await Promise.all([
      this.progressModel
        .find({ userId: userObjId })
        .sort({ lastStudiedAt: -1, updatedAt: -1 })
        .limit(10)
        .populate('lessonId')
        .lean(),
      this.sessionModel
        .find({ userId: userObjId })
        .sort({ startedAt: -1 })
        .limit(10)
        .populate('lessonId')
        .lean(),
    ]);

    const activities: Array<{
      type: 'LESSON' | 'REVIEW';
      title: string;
      createdAt: Date;
    }> = [];

    for (const p of recentProgresses) {
      const lessonObj = p.lessonId as any;
      const title = lessonObj?.title
        ? `${p.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài'}: ${lessonObj.title}`
        : 'Học bài học';
      const createdAt = p.lastStudiedAt || (p as any).updatedAt || new Date();
      activities.push({
        type: 'LESSON',
        title,
        createdAt: new Date(createdAt),
      });
    }

    for (const s of recentSessions) {
      const lessonObj = s.lessonId as any;
      let title = '';
      if (s.type === 'REVIEW') {
        title = `Ôn tập ${s.completedWords || 0} từ vựng`;
      } else {
        title = lessonObj?.title
          ? `Luyện tập bài: ${lessonObj.title}`
          : 'Luyện tập từ vựng';
      }
      activities.push({
        type: s.type || 'LESSON',
        title,
        createdAt: new Date(s.startedAt || (s as any).createdAt || new Date()),
      });
    }

    // Sort theo createdAt giảm dần và lấy top 10
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return activities.slice(0, 10);
  }
}

