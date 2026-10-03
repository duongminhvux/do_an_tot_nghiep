import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { VocabularyGroup, VocabularyGroupDocument } from './vocabulary-group.schema.js';
import { Collection, CollectionDocument } from '../collections/collection.schema.js';
import { Lesson, LessonDocument } from '../lessons/lesson.schema.js';
import { LessonWord, LessonWordDocument } from '../lessons/lesson-word.schema.js';
import { CreateVocabularyGroupDto } from './dto/create-vocabulary-group.dto.js';
import { UpdateVocabularyGroupDto } from './dto/update-vocabulary-group.dto.js';
import { QueryVocabularyGroupDto } from './dto/query-vocabulary-group.dto.js';

@Injectable()
export class VocabularyGroupsService implements OnModuleInit {
  constructor(
    @InjectModel(VocabularyGroup.name)
    private readonly vocabularyGroupModel: Model<VocabularyGroupDocument>,
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(LessonWord.name)
    private readonly lessonWordModel: Model<LessonWordDocument>,
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit() {
    try {
      // Drop old unique indexes if they exist without partialFilterExpression
      const indexes = await this.vocabularyGroupModel.collection.indexes();
      for (const idx of indexes) {
        if ((idx.name === 'name_1' || idx.name === 'slug_1') && !idx.partialFilterExpression) {
          await this.vocabularyGroupModel.collection.dropIndex(idx.name);
        }
      }
      await this.vocabularyGroupModel.syncIndexes();
    } catch {
      // Ignore if index doesn't exist or collection hasn't been created yet
    }
  }

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

  async create(createVocabularyGroupDto: CreateVocabularyGroupDto): Promise<VocabularyGroup> {
    const lang = this.getLang();
    const trimmedName = createVocabularyGroupDto.name.trim();

    // 1. Check if an ACTIVE group with this name already exists
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingActive = await this.vocabularyGroupModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (existingActive) {
      throw new ConflictException(
        await this.i18n.t('vocabulary-group.GROUP_ALREADY_EXISTS', { lang }),
      );
    }

    const rawSlug = createVocabularyGroupDto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'group';
    let slug = baseSlug;
    let counter = 1;
    while (await this.vocabularyGroupModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // 2. Free any legacy deleted records that had this name or slug to avoid E11000
    const legacyDeleted = await this.vocabularyGroupModel.find({
      $or: [{ name: trimmedName }, { slug }],
      isDeleted: true,
    });
    for (const legacy of legacyDeleted) {
      const ts = Date.now();
      await this.vocabularyGroupModel.findByIdAndUpdate(legacy._id, {
        name: `${legacy.name}_deleted_${ts}`,
        slug: `${legacy.slug}_deleted_${ts}`,
      });
    }

    let order = createVocabularyGroupDto.order;
    if (order === undefined || order === null || order <= 0) {
      const count = await this.vocabularyGroupModel.countDocuments({ isDeleted: { $ne: true } });
      order = count + 1;
    }

    const createdGroup = new this.vocabularyGroupModel({
      ...createVocabularyGroupDto,
      name: trimmedName,
      slug,
      order,
    });
    return createdGroup.save();
  }

  async findAll(query: QueryVocabularyGroupDto): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const { search, isActive, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [rawGroups, total] = await Promise.all([
      this.vocabularyGroupModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.vocabularyGroupModel.countDocuments(filter).exec(),
    ]);

    const groupIds = rawGroups.map((g) => g._id);

    // Fetch collections for these groups
    const rawCollections = await this.collectionModel
      .find({ groupId: { $in: groupIds }, isDeleted: { $ne: true } })
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();

    const collectionIds = rawCollections.map((c) => c._id);

    // Fetch lessons for these collections
    const rawLessons = await this.lessonModel
      .find({ collectionId: { $in: collectionIds }, isDeleted: { $ne: true } })
      .select('_id collectionId')
      .lean()
      .exec();

    const lessonIds = rawLessons.map((l) => l._id);

    // Count words per lesson
    const wordCountsPerLesson = await this.lessonWordModel.aggregate([
      { $match: { lessonId: { $in: lessonIds } } },
      { $group: { _id: '$lessonId', count: { $sum: 1 } } },
    ]);
    const lessonWordCountMap = new Map(wordCountsPerLesson.map((w) => [w._id.toString(), w.count]));

    // Map lessons and words to collections
    const collectionLessonsCountMap = new Map<string, number>();
    const collectionWordsCountMap = new Map<string, number>();

    rawLessons.forEach((lesson) => {
      const colId = lesson.collectionId.toString();
      collectionLessonsCountMap.set(colId, (collectionLessonsCountMap.get(colId) || 0) + 1);
      const wordsInLesson = lessonWordCountMap.get(lesson._id.toString()) || 0;
      collectionWordsCountMap.set(colId, (collectionWordsCountMap.get(colId) || 0) + wordsInLesson);
    });

    // Group collections by groupId
    const collectionsByGroup = new Map<string, any[]>();
    rawCollections.forEach((c) => {
      const gId = c.groupId?.toString();
      if (!gId) return;
      if (!collectionsByGroup.has(gId)) {
        collectionsByGroup.set(gId, []);
      }
      collectionsByGroup.get(gId)!.push({
        ...c,
        lessonsCount: collectionLessonsCountMap.get(c._id.toString()) || 0,
        wordsCount: collectionWordsCountMap.get(c._id.toString()) || 0,
      });
    });

    const data = rawGroups.map((g) => {
      const cols = collectionsByGroup.get(g._id.toString()) || [];
      const totalLessons = cols.reduce((acc, cur) => acc + (cur.lessonsCount || 0), 0);
      const totalWords = cols.reduce((acc, cur) => acc + (cur.wordsCount || 0), 0);
      return {
        ...g,
        collectionsCount: cols.length,
        lessonsCount: totalLessons,
        wordsCount: totalWords,
        collections: cols,
      };
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<any> {
    const lang = this.getLang();
    const group = await this.vocabularyGroupModel
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .lean()
      .exec();

    if (!group) {
      throw new NotFoundException(
        await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', { lang }),
      );
    }

    const collectionsCount = await this.collectionModel.countDocuments({
      groupId: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    }).exec();

    return {
      ...group,
      collectionsCount,
    };
  }

  async update(id: string, updateVocabularyGroupDto: UpdateVocabularyGroupDto): Promise<VocabularyGroup> {
    const lang = this.getLang();
    const updateData: Partial<VocabularyGroup> = { ...updateVocabularyGroupDto } as any;

    if (updateVocabularyGroupDto.name) {
      const trimmedName = updateVocabularyGroupDto.name.trim();
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingActive = await this.vocabularyGroupModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        isDeleted: { $ne: true },
      });
      if (existingActive) {
        throw new ConflictException(
          await this.i18n.t('vocabulary-group.GROUP_ALREADY_EXISTS', { lang }),
        );
      }
      updateData.name = trimmedName;

      // Free any legacy deleted records with this name
      const legacyDeleted = await this.vocabularyGroupModel.find({
        _id: { $ne: id },
        name: trimmedName,
        isDeleted: true,
      });
      for (const legacy of legacyDeleted) {
        const ts = Date.now();
        await this.vocabularyGroupModel.findByIdAndUpdate(legacy._id, {
          name: `${legacy.name}_deleted_${ts}`,
          slug: `${legacy.slug}_deleted_${ts}`,
        });
      }
    }

    if (updateVocabularyGroupDto.slug || updateVocabularyGroupDto.name) {
      const rawSlug = updateVocabularyGroupDto.slug?.trim() || updateVocabularyGroupDto.name;
      if (rawSlug) {
        const baseSlug = this.generateSlug(rawSlug) || 'group';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.vocabularyGroupModel.exists({
            _id: { $ne: id },
            slug,
            isDeleted: { $ne: true },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;

        // Free any legacy deleted records with this slug
        const legacySlugDeleted = await this.vocabularyGroupModel.find({
          _id: { $ne: id },
          slug,
          isDeleted: true,
        });
        for (const legacy of legacySlugDeleted) {
          const ts = Date.now();
          await this.vocabularyGroupModel.findByIdAndUpdate(legacy._id, {
            name: `${legacy.name}_deleted_${ts}`,
            slug: `${legacy.slug}_deleted_${ts}`,
          });
        }
      }
    }

    const updatedGroup = await this.vocabularyGroupModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { returnDocument: 'after' })
      .exec();

    if (!updatedGroup) {
      throw new NotFoundException(
        await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', { lang }),
      );
    }
    return updatedGroup;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<VocabularyGroup> {
    const lang = this.getLang();
    const group = await this.findOne(id);
    const nextActive = isActive !== undefined ? isActive : !group.isActive;
    const updated = await this.vocabularyGroupModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextActive },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', { lang }),
      );
    }
    return updated;
  }

  async remove(id: string): Promise<VocabularyGroup> {
    const lang = this.getLang();
    const group = await this.vocabularyGroupModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!group) {
      throw new NotFoundException(
        await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', { lang }),
      );
    }

    const timestamp = Date.now();
    const deletedName = `${group.name}_deleted_${timestamp}`;
    const deletedSlug = `${group.slug}_deleted_${timestamp}`;

    const deletedGroup = await this.vocabularyGroupModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          name: deletedName,
          slug: deletedSlug,
        },
        { returnDocument: 'after' },
      )
      .exec();

    // Detach all collections assigned to this group
    await this.collectionModel
      .updateMany({ groupId: new Types.ObjectId(id) }, { $unset: { groupId: 1 } })
      .exec();

    return deletedGroup!;
  }

  async restore(id: string): Promise<VocabularyGroup> {
    const lang = this.getLang();
    const restored = await this.vocabularyGroupModel
      .findOneAndUpdate({ _id: id }, { isDeleted: false }, { returnDocument: 'after' })
      .exec();

    if (!restored) {
      throw new NotFoundException(
        await this.i18n.t('vocabulary-group.GROUP_NOT_FOUND', { lang }),
      );
    }
    return restored;
  }

  async reorderGroups(items: { id: string; order: number }[]): Promise<void> {
    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { order: item.order } },
      },
    }));
    if (operations.length > 0) {
      await this.vocabularyGroupModel.bulkWrite(operations);
    }
  }
}
