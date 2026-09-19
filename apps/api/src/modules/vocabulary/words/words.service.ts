import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Word, WordDocument } from './word.schema.js';
import { CreateWordDto } from './dto/create-word.dto.js';
import { UpdateWordDto } from './dto/update-word.dto.js';
import { QueryWordDto } from './dto/query-word.dto.js';

@Injectable()
export class WordsService {
  constructor(
    @InjectModel(Word.name) private readonly wordModel: Model<WordDocument>,
    private readonly i18n: I18nService,
  ) {}

  private getLang(): string {
    return I18nContext.current()?.lang || 'vi';
  }

  async create(createWordDto: CreateWordDto) {
    const lang = this.getLang();
    const existing = await this.wordModel.findOne({
      word: createWordDto.word.trim(),
      isDeleted: { $ne: true },
    });

    if (existing) {
      throw new BadRequestException(
        await this.i18n.t('word.WORD_ALREADY_EXISTS', { lang }),
      );
    }

    const createdWord = new this.wordModel(createWordDto);
    const savedWord = await createdWord.save();

    return {
      message: await this.i18n.t('word.WORD_CREATED_SUCCESSFULLY', { lang }),
      data: savedWord,
    };
  }

  async findAll(query: QueryWordDto) {
    const lang = this.getLang();
    const { search, partOfSpeech, level, isActive, isDeleted, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = {};

    if (typeof isDeleted === 'boolean') {
      filter.isDeleted = isDeleted;
    } else {
      filter.isDeleted = { $ne: true };
    }

    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    if (search) {
      filter.$or = [
        { word: { $regex: search, $options: 'i' } },
        { 'parts.meanings.definition': { $regex: search, $options: 'i' } },
        { 'parts.meanings.translation': { $regex: search, $options: 'i' } },
        { definition: { $regex: search, $options: 'i' } },
        { translation: { $regex: search, $options: 'i' } },
      ];
    }

    if (partOfSpeech) {
      filter['parts.partOfSpeech'] = partOfSpeech;
    }

    if (level) {
      filter.level = level;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.wordModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.wordModel.countDocuments(filter).exec(),
    ]);

    return {
      message: await this.i18n.t('word.WORD_LIST_FETCHED_SUCCESSFULLY', { lang }),
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const lang = this.getLang();
    const word = await this.wordModel.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
    if (!word) {
      throw new NotFoundException(
        await this.i18n.t('word.WORD_NOT_FOUND', { lang }),
      );
    }
    return {
      message: await this.i18n.t('word.WORD_FETCHED_SUCCESSFULLY', { lang }),
      data: word,
    };
  }

  async update(id: string, updateWordDto: UpdateWordDto) {
    const lang = this.getLang();

    if (updateWordDto.word) {
      const existing = await this.wordModel.findOne({
        _id: { $ne: id },
        word: updateWordDto.word.trim(),
        isDeleted: { $ne: true },
      });
      if (existing) {
        throw new BadRequestException(
          await this.i18n.t('word.WORD_ALREADY_EXISTS', { lang }),
        );
      }
    }

    const updatedWord = await this.wordModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateWordDto, { new: true })
      .exec();

    if (!updatedWord) {
      throw new NotFoundException(
        await this.i18n.t('word.WORD_NOT_FOUND', { lang }),
      );
    }

    return {
      message: await this.i18n.t('word.WORD_UPDATED_SUCCESSFULLY', { lang }),
      data: updatedWord,
    };
  }

  async remove(id: string) {
    const lang = this.getLang();
    const deletedWord = await this.wordModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true })
      .exec();

    if (!deletedWord) {
      throw new NotFoundException(
        await this.i18n.t('word.WORD_NOT_FOUND', { lang }),
      );
    }

    return {
      message: await this.i18n.t('word.WORD_DELETED_SUCCESSFULLY', { lang }),
      data: deletedWord,
    };
  }

  async restore(id: string) {
    const lang = this.getLang();
    const restoredWord = await this.wordModel
      .findOneAndUpdate({ _id: id, isDeleted: true }, { isDeleted: false }, { new: true })
      .exec();

    if (!restoredWord) {
      throw new NotFoundException(
        await this.i18n.t('word.WORD_NOT_FOUND_OR_NOT_DELETED', { lang }),
      );
    }

    return {
      message: await this.i18n.t('word.WORD_RESTORED_SUCCESSFULLY', { lang }),
      data: restoredWord,
    };
  }
}
