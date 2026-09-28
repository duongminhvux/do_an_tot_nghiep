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
        lessons: [],
      };
    }

    const lessonIds = lessons.map((l) => l._id);

    const progressList = await this.progressModel.find({
      userId: userObjId,
      lessonId: { $in: lessonIds },
    });

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
        progress: prog,
        status: p?.status ?? 'NOT_STARTED',
        lastStudiedAt: p?.lastStudiedAt,
      };
    });

    const overallProgress = Math.round(totalProgressSum / lessons.length);

    return {
      collectionId,
      overallProgress,
      completedLessonsCount,
      totalLessonsCount: lessons.length,
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
}
