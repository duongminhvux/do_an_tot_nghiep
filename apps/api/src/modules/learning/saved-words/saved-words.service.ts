import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserSavedWord,
  UserSavedWordDocument,
} from './schema/saved-word.schema.js';
import {
  UserWordReview,
  UserWordReviewDocument,
} from '../reviews/schemas/user-word-review.schema.js';
import { Word, WordDocument } from '../../vocabulary/words/word.schema.js';
import { CreateSavedWordDto } from './dto/create-saved-word.dto.js';
import { QuerySavedWordsDto } from './dto/query-saved-words.dto.js';
import { UpdateSavedWordNoteDto } from './dto/update-saved-word.dto.js';

@Injectable()
export class SavedWordsService {
  constructor(
    @InjectModel(UserSavedWord.name)
    private userSavedWordModel: Model<UserSavedWordDocument>,
    @InjectModel(Word.name)
    private wordModel: Model<WordDocument>,
    @InjectModel(UserWordReview.name)
    private reviewModel: Model<UserWordReviewDocument>,
  ) {}

  /**
   * Lưu từ vựng
   */
  async saveWord(userId: string, dto: CreateSavedWordDto) {
    if (!Types.ObjectId.isValid(dto.wordId)) {
      throw new BadRequestException('ID từ vựng không hợp lệ');
    }

    const userObjId = new Types.ObjectId(userId);
    const wordObjId = new Types.ObjectId(dto.wordId);

    const word = await this.wordModel.findById(wordObjId);
    if (!word || word.isDeleted) {
      throw new NotFoundException('Không tìm thấy từ vựng');
    }

    const saved = await this.userSavedWordModel.findOneAndUpdate(
      { userId: userObjId, wordId: wordObjId },
      {
        $setOnInsert: { savedAt: new Date() },
        ...(dto.note !== undefined ? { $set: { note: dto.note } } : {}),
      },
      { upsert: true, returnDocument: 'after' },
    );

    return saved;
  }

  /**
   * Bật/tắt lưu từ vựng (Toggle bookmark)
   */
  async toggleSave(userId: string, wordId: string) {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID từ vựng không hợp lệ');
    }

    const userObjId = new Types.ObjectId(userId);
    const wordObjId = new Types.ObjectId(wordId);

    const existing = await this.userSavedWordModel.findOne({
      userId: userObjId,
      wordId: wordObjId,
    });

    if (existing) {
      await this.userSavedWordModel.deleteOne({ _id: existing._id });
      return { saved: false, wordId };
    }

    const word = await this.wordModel.findById(wordObjId);
    if (!word || word.isDeleted) {
      throw new NotFoundException('Không tìm thấy từ vựng');
    }

    const saved = await this.userSavedWordModel.create({
      userId: userObjId,
      wordId: wordObjId,
      savedAt: new Date(),
    });

    return { saved: true, wordId, data: saved };
  }

  /**
   * Bỏ lưu từ vựng
   */
  async unsaveWord(userId: string, wordId: string) {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID từ vựng không hợp lệ');
    }

    const res = await this.userSavedWordModel.deleteOne({
      userId: new Types.ObjectId(userId),
      wordId: new Types.ObjectId(wordId),
    });

    return { success: res.deletedCount > 0, wordId };
  }

  /**
   * Cập nhật ghi chú cho từ đã lưu
   */
  async updateNote(userId: string, wordId: string, dto: UpdateSavedWordNoteDto) {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID từ vựng không hợp lệ');
    }

    const saved = await this.userSavedWordModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        wordId: new Types.ObjectId(wordId),
      },
      { $set: { note: dto.note ?? '' } },
      { returnDocument: 'after' },
    );

    if (!saved) {
      throw new NotFoundException('Từ chưa được lưu vào danh sách');
    }

    return saved;
  }

  /**
   * Kiểm tra từ có đang được lưu bởi user không
   */
  async checkIsSaved(userId: string, wordId: string) {
    if (!Types.ObjectId.isValid(wordId)) {
      return { isSaved: false };
    }

    const count = await this.userSavedWordModel.countDocuments({
      userId: new Types.ObjectId(userId),
      wordId: new Types.ObjectId(wordId),
    });

    return { isSaved: count > 0 };
  }

  /**
   * Lấy danh sách ID của tất cả từ đã lưu (dùng để highlight bookmark trên UI)
   */
  async getAllSavedWordIds(userId: string) {
    const records = await this.userSavedWordModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('wordId')
      .lean();

    return records.map((r) => String(r.wordId));
  }

  /**
   * Lấy danh sách từ đã lưu phân trang, tìm kiếm, lọc theo level và sắp xếp
   */
  async findAll(userId: string, query: QuerySavedWordsDto) {
    const userObjId = new Types.ObjectId(userId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const savedFilter: any = { userId: userObjId };

    // Tìm kiếm hoặc lọc theo level
    const hasSearch = Boolean(query.search && query.search.trim());
    const hasLevel = Boolean(query.level && query.level !== 'all');

    if (hasSearch || hasLevel) {
      const wordFilter: any = { isDeleted: false };

      if (hasLevel) {
        wordFilter.level = query.level!.toUpperCase();
      }

      if (hasSearch) {
        const regex = new RegExp(query.search!.trim(), 'i');
        wordFilter.$or = [
          { word: regex },
          { 'parts.meanings.translation': regex },
          { 'parts.meanings.definition': regex },
        ];
      }

      const matchedWords = await this.wordModel
        .find(wordFilter)
        .select('_id')
        .lean();

      const matchedIds = matchedWords.map((w) => w._id);
      savedFilter.wordId = { $in: matchedIds };
    }

    const total = await this.userSavedWordModel.countDocuments(savedFilter);

    const sortOption: any =
      query.sortBy === 'savedAt' && query.order === 'asc'
        ? { savedAt: 1 }
        : { savedAt: -1 };

    const records = await this.userSavedWordModel
      .find(savedFilter)
      .populate({
        path: 'wordId',
        select: 'word slug level phonetic ipa audio image parts isActive',
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    // Lấy thông tin SRS review cho các từ này
    const validRecords = records.filter((r) => r.wordId);
    const wordIds = validRecords.map((r) => (r.wordId as any)._id);

    const reviews = await this.reviewModel
      .find({
        userId: userObjId,
        wordId: { $in: wordIds },
      })
      .select('wordId status reviewCount intervalDays nextReviewAt')
      .lean();

    const reviewMap = new Map(reviews.map((rv) => [String(rv.wordId), rv]));

    const items = validRecords.map((r) => {
      const w = r.wordId as any;
      const rev = reviewMap.get(String(w._id));
      return {
        _id: String(r._id),
        savedAt: r.savedAt,
        note: r.note || '',
        word: w,
        reviewStatus: rev?.status || 'NOT_STUDIED',
        reviewCount: rev?.reviewCount || 0,
        nextReviewAt: rev?.nextReviewAt,
      };
    });

    // Nếu sắp xếp A-Z theo từ
    if (query.sortBy === 'alpha') {
      items.sort((a, b) =>
        query.order === 'desc'
          ? (b.word?.word || '').localeCompare(a.word?.word || '')
          : (a.word?.word || '').localeCompare(b.word?.word || ''),
      );
    }

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Thống kê tổng quan số từ đã lưu
   */
  async getStats(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const total = await this.userSavedWordModel.countDocuments({
      userId: userObjId,
    });

    return { total };
  }
}
