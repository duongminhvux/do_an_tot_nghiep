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

  private generateSlug(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
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

    const baseSlug = this.generateSlug(createWordDto.word) || 'word';
    let slug = baseSlug;
    let counter = 1;
    while (await this.wordModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const createdWord = new this.wordModel({
      ...createWordDto,
      slug,
    });
    const savedWord = await createdWord.save();

    return {
      message: await this.i18n.t('word.WORD_CREATED_SUCCESSFULLY', { lang }),
      data: savedWord,
    };
  }

  async findAll(query: QueryWordDto) {
    const lang = this.getLang();
    const {
      search,
      partOfSpeech,
      level,
      isActive,
      isDeleted,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
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
      filter.word = { $regex: search.trim(), $options: 'i' };
    }

    if (partOfSpeech) {
      filter['parts.partOfSpeech'] = partOfSpeech;
    }

    if (level) {
      filter.level = level;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortField = sortBy || 'createdAt';
    const sortObj: Record<string, 1 | -1> = {
      [sortField]: sortDirection,
      _id: sortDirection,
    };

    const [data, total] = await Promise.all([
      this.wordModel
        .find(filter)
        .select('word ipa audio parts.partOfSpeech parts.meanings.definition level isActive createdAt')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
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

    const updatePayload: Record<string, any> = { ...updateWordDto };
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

      const baseSlug = this.generateSlug(updateWordDto.word) || 'word';
      let slug = baseSlug;
      let counter = 1;
      while (await this.wordModel.exists({ _id: { $ne: id }, slug, isDeleted: { $ne: true } })) {
        slug = `${baseSlug}-${counter++}`;
      }
      updatePayload.slug = slug;
    }

    const updatedWord = await this.wordModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updatePayload, { new: true })
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

  async toggleActive(id: string, isActive?: boolean) {
    const lang = this.getLang();
    const word = await this.wordModel
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .exec();

    if (!word) {
      throw new NotFoundException(
        await this.i18n.t('word.WORD_NOT_FOUND', { lang }),
      );
    }

    const nextState = typeof isActive === 'boolean' ? isActive : !word.isActive;
    const updatedWord = await this.wordModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextState },
        { new: true },
      )
      .exec();

    const messageKey = nextState
      ? 'word.WORD_ACTIVATED_SUCCESSFULLY'
      : 'word.WORD_DEACTIVATED_SUCCESSFULLY';

    return {
      message: await this.i18n.t(messageKey, { lang }),
      data: updatedWord,
    };
  }

  async bulkToggleActive(ids: string[], isActive: boolean) {
    const lang = this.getLang();
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException(
        await this.i18n.t('word.NO_WORDS_PROVIDED', { lang }),
      );
    }

    await this.wordModel.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      { $set: { isActive } },
    );

    const messageKey = isActive
      ? 'word.WORDS_ACTIVATED_SUCCESSFULLY'
      : 'word.WORDS_DEACTIVATED_SUCCESSFULLY';

    return {
      message: await this.i18n.t(messageKey, { lang }),
      modifiedCount: ids.length,
    };
  }

  async bulkLookup(words: string[]) {
    const lang = this.getLang();
    if (!Array.isArray(words) || words.length === 0) {
      throw new BadRequestException(
        await this.i18n.t('word.NO_WORDS_PROVIDED', { lang }),
      );
    }

    // Normalize and deduplicate input words
    const uniqueWords = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];

    // Case-insensitive exact match for all words
    const foundDocs = await this.wordModel
      .find({
        word: { $in: uniqueWords.map((w) => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) },
        isDeleted: { $ne: true },
      })
      .select('word ipa audio parts.partOfSpeech parts.meanings.definition parts.meanings.translation level isActive')
      .exec();

    const foundWordsLower = new Set(foundDocs.map((d) => d.word.toLowerCase()));
    const notFound = uniqueWords.filter((w) => !foundWordsLower.has(w));

    return {
      message: await this.i18n.t('word.BULK_LOOKUP_COMPLETED', { lang }),
      found: foundDocs,
      notFound,
      totalInput: uniqueWords.length,
      totalFound: foundDocs.length,
      totalNotFound: notFound.length,
    };
  }
}

