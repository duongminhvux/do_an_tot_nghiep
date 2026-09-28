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
