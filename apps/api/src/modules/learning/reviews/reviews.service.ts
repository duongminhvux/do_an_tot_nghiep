import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserWordReview,
  UserWordReviewDocument,
} from './schemas/user-word-review.schema.js';
import { Word, WordDocument } from '../../vocabulary/words/word.schema.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(UserWordReview.name)
    private reviewModel: Model<UserWordReviewDocument>,
    @InjectModel(Word.name)
    private wordModel: Model<WordDocument>,
  ) {}

  /**
   * Lấy danh sách các từ đến hạn ôn tập (Spaced Repetition)
   */
  async getDueReviews(userId: string, limit: number = 30) {
    const userObjId = new Types.ObjectId(userId);
    const now = new Date();

    return this.reviewModel
      .find({
        userId: userObjId,
        nextReviewAt: { $lte: now },
      })
      .populate('wordId')
      .sort({ nextReviewAt: 1 })
      .limit(limit);
  }

  /**
   * Thống kê tổng quan ôn tập của user
   */
  async getStats(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [totalWords, learningWords, masteredWords, dueToday] =
      await Promise.all([
        this.reviewModel.countDocuments({ userId: userObjId }),
        this.reviewModel.countDocuments({
          userId: userObjId,
          status: 'LEARNING',
        }),
        this.reviewModel.countDocuments({
          userId: userObjId,
          status: 'MASTERED',
        }),
        this.reviewModel.countDocuments({
          userId: userObjId,
          nextReviewAt: { $lte: endOfDay },
        }),
      ]);

    return {
      totalWords,
      learningWords,
      masteredWords,
      dueToday,
    };
  }

  /**
   * Kiểm tra nhanh số từ đến hạn ôn tập cho popup và thanh thông báo
   */
  async checkDue(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [dueCount, dueToday, totalLearning] = await Promise.all([
      this.reviewModel.countDocuments({
        userId: userObjId,
        nextReviewAt: { $lte: now },
      }),
      this.reviewModel.countDocuments({
        userId: userObjId,
        nextReviewAt: { $lte: endOfDay },
      }),
      this.reviewModel.countDocuments({
        userId: userObjId,
        status: 'LEARNING',
      }),
    ]);

    let previewWords: string[] = [];
    if (dueCount > 0) {
      const sampleReviews = await this.reviewModel
        .find({
          userId: userObjId,
          nextReviewAt: { $lte: now },
        })
        .populate('wordId', 'word')
        .limit(3)
        .lean();

      previewWords = sampleReviews
        .map((r: any) => r.wordId?.word)
        .filter(Boolean);
    }

    return {
      hasDueWords: dueCount > 0,
      dueCount,
      dueToday,
      totalLearning,
      previewWords,
    };
  }

  /**
   * Đánh giá 1 từ trong quá trình ôn tập SRS (AGAIN, HARD, GOOD, EASY)
   */
  async recordReview(
    userId: string,
    wordId: string,
    rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY',
  ) {
    const userObjId = new Types.ObjectId(userId);
    const wordObjId = new Types.ObjectId(wordId);
    const now = new Date();

    let review = await this.reviewModel.findOne({
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

    const isAgain = rating === 'AGAIN';
    const isHard = rating === 'HARD';
    const isEasy = rating === 'EASY';

    if (isAgain) {
      review.incorrectCount += 1;
      review.intervalDays = 0;
      review.status = 'LEARNING';
      // Ôn lại sau 10 phút
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

    return review.save();
  }

  /**
   * Lấy toàn bộ danh sách ôn tập
   */
  async findAll(userId: string, status?: string) {
    const query: any = { userId: new Types.ObjectId(userId) };
    if (status) {
      query.status = status;
    }

    return this.reviewModel
      .find(query)
      .populate('wordId')
      .sort({ nextReviewAt: 1 })
      .limit(100);
  }
}
