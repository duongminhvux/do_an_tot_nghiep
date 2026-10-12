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
import { CreateVocabularyFolderDto } from './dto/create-vocabulary-folder.dto.js';
import { UpdateVocabularyFolderDto } from './dto/update-vocabulary-folder.dto.js';
import {
  VocabularyFolder,
  VocabularyFolderDocument,
} from './schema/vocabulary-folder.schema.js';

@Injectable()
export class SavedWordsService {
  constructor(
    @InjectModel(UserSavedWord.name)
    private userSavedWordModel: Model<UserSavedWordDocument>,
    @InjectModel(Word.name)
    private wordModel: Model<WordDocument>,
    @InjectModel(UserWordReview.name)
    private reviewModel: Model<UserWordReviewDocument>,
    @InjectModel(VocabularyFolder.name)
    private folderModel: Model<VocabularyFolderDocument>,
  ) {}

  async searchWords(userId: string, folderId: string, search?: string) {
    const userObjId = new Types.ObjectId(userId);
    await this.validateFolder(userObjId, folderId);
    const term = search?.trim().slice(0, 100);
    if (!term) return [];
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const words = await this.wordModel
      .find({
        isActive: true,
        isDeleted: false,
        $or: [{ word: regex }, { 'parts.meanings.translation': regex }],
      })
      .select('word slug level ipa parts')
      .sort({ word: 1 })
      .limit(30)
      .lean();
    const saved = await this.userSavedWordModel
      .find({
        userId: userObjId,
        wordId: { $in: words.map((word) => word._id) },
      })
      .select('wordId folderId')
      .lean();
    const savedMap = new Map(saved.map((item) => [String(item.wordId), item]));
    return words.map((word) => ({
      ...word,
      _id: String(word._id),
      saved: savedMap.has(String(word._id)),
      inFolder: String(savedMap.get(String(word._id))?.folderId) === folderId,
    }));
  }
  async getFolders(userId: string) {
    const folders = await this.folderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ name: 1 })
      .lean();

    const counts = await this.userSavedWordModel.aggregate([
      {
        $match: { userId: new Types.ObjectId(userId), folderId: { $ne: null } },
      },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      counts.map((item) => [String(item._id), item.count]),
    );

    return folders.map((folder) => ({
      _id: String(folder._id),
      name: folder.name,
      slug: folder.slug || this.folderSlug(folder.name, String(folder._id)),
      description: folder.description || '',
      count: countMap.get(String(folder._id)) || 0,
      createdAt: folder.createdAt,
    }));
  }

  async createFolder(userId: string, dto: CreateVocabularyFolderDto) {
    try {
      const folder = await this.folderModel.create({
        userId: new Types.ObjectId(userId),
        name: this.folderName(dto.name),
        slug: this.folderSlug(dto.name),
        description: this.folderDescription(dto.description),
      });
      return {
        _id: String(folder._id),
        name: folder.name,
        slug: folder.slug,
        description: folder.description || '',
        count: 0,
        createdAt: folder.createdAt,
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new BadRequestException('Thư mục đã tồn tại');
      }
      throw error;
    }
  }

  async updateFolder(
    userId: string,
    folderId: string,
    dto: UpdateVocabularyFolderDto,
  ) {
    if (!Types.ObjectId.isValid(folderId)) {
      throw new BadRequestException('ID thư mục không hợp lệ');
    }
    const folder = await this.folderModel.findOneAndUpdate(
      { _id: new Types.ObjectId(folderId), userId: new Types.ObjectId(userId) },
      {
        $set: {
          name: this.folderName(dto.name),
          slug: this.folderSlug(dto.name, folderId),
          ...(dto.description !== undefined
            ? { description: this.folderDescription(dto.description) }
            : {}),
        },
      },
      { returnDocument: 'after' },
    );
    if (!folder) throw new NotFoundException('Không tìm thấy thư mục');
    return {
      _id: String(folder._id),
      name: folder.name,
      slug: folder.slug,
      description: folder.description || '',
      createdAt: folder.createdAt,
    };
  }

  async deleteFolder(userId: string, folderId: string) {
    if (!Types.ObjectId.isValid(folderId)) {
      throw new BadRequestException('ID thư mục không hợp lệ');
    }
    const filter = {
      _id: new Types.ObjectId(folderId),
      userId: new Types.ObjectId(userId),
    };
    const deleted = await this.folderModel.findOneAndDelete(filter);
    if (!deleted) throw new NotFoundException('Không tìm thấy thư mục');
    await this.userSavedWordModel.updateMany(
      { userId: filter.userId, folderId: filter._id },
      { $unset: { folderId: 1 } },
    );
    return { success: true, folderId };
  }

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

    let folderId: Types.ObjectId | undefined;
    if (dto.folderId) {
      if (!Types.ObjectId.isValid(dto.folderId)) {
        throw new BadRequestException('ID thư mục không hợp lệ');
      }
      const folder = await this.folderModel.findOne({
        _id: new Types.ObjectId(dto.folderId),
        userId: userObjId,
      });
      if (!folder) throw new NotFoundException('Không tìm thấy thư mục');
      folderId = folder._id;
    }

    const saved = await this.userSavedWordModel.findOneAndUpdate(
      { userId: userObjId, wordId: wordObjId },
      {
        $setOnInsert: { savedAt: new Date() },
        ...(dto.note !== undefined || folderId
          ? {
              $set: {
                ...(dto.note !== undefined ? { note: dto.note } : {}),
                ...(folderId ? { folderId } : {}),
              },
            }
          : {}),
      },
      { upsert: true, returnDocument: 'after' },
    );

    return saved;
  }

  /**
   * Bật/tắt lưu từ vựng (Toggle bookmark)
   */
  async toggleSave(userId: string, wordId: string, folderId?: string) {
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
      ...(folderId
        ? {
            folderId: await this.validateFolder(userObjId, folderId),
          }
        : {}),
    });

    return { saved: true, wordId, data: saved };
  }

  private folderName(name: string) {
    const trimmed = name.trim();
    if (!trimmed)
      throw new BadRequestException('Tên thư mục không được để trống');
    return trimmed;
  }

  private folderDescription(description?: string) {
    return description?.trim() || '';
  }

  private folderSlug(name: string, suffix?: string) {
    const slug = this.folderName(name)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || `folder-${suffix || Date.now()}`;
  }

  private async validateFolder(userId: Types.ObjectId, folderId: string) {
    if (!Types.ObjectId.isValid(folderId)) {
      throw new BadRequestException('ID thư mục không hợp lệ');
    }
    const folder = await this.folderModel.findOne({
      _id: new Types.ObjectId(folderId),
      userId,
    });
    if (!folder) throw new NotFoundException('Không tìm thấy thư mục');
    return folder._id;
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
  async updateNote(
    userId: string,
    wordId: string,
    dto: UpdateSavedWordNoteDto,
  ) {
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
    if (query.folderId === 'unfiled') {
      savedFilter.folderId = null;
    } else if (query.folderId) {
      savedFilter.folderId = await this.validateFolder(
        userObjId,
        query.folderId,
      );
    }

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
