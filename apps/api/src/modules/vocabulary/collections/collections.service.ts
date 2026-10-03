import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Collection, CollectionDocument } from './collection.schema.js';
import { Lesson, LessonDocument } from '../lessons/lesson.schema.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';

@Injectable()
export class CollectionsService implements OnModuleInit {
  constructor(
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit() {
    try {
      const indexes = await this.collectionModel.collection.indexes();
      for (const idx of indexes) {
        if ((idx.name === 'name_1' || idx.name === 'slug_1') && !idx.partialFilterExpression) {
          await this.collectionModel.collection.dropIndex(idx.name);
        }
      }
      await this.collectionModel.syncIndexes();
    } catch {
      // Ignore
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

  async create(createCollectionDto: CreateCollectionDto): Promise<Collection> {
    const lang = this.getLang();
    const trimmedName = createCollectionDto.name.trim();

    // Check if active collection already exists
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingActive = await this.collectionModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (existingActive) {
      throw new ConflictException(
        await this.i18n.t('collection.COLLECTION_ALREADY_EXISTS', { lang }),
      );
    }

    const rawSlug = createCollectionDto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'collection';
    let slug = baseSlug;
    let counter = 1;
    while (await this.collectionModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Free any legacy deleted records
    const legacyDeleted = await this.collectionModel.find({
      $or: [{ name: trimmedName }, { slug }],
      isDeleted: true,
    });
    for (const legacy of legacyDeleted) {
      const ts = Date.now();
      await this.collectionModel.findByIdAndUpdate(legacy._id, {
        name: `${legacy.name}_deleted_${ts}`,
        slug: `${legacy.slug}_deleted_${ts}`,
      });
    }

    let order = createCollectionDto.order;
    if (order === undefined || order === null || order <= 0) {
      const count = await this.collectionModel.countDocuments({ isDeleted: { $ne: true } });
      order = count + 1;
    }

    const createdCollection = new this.collectionModel({
      ...createCollectionDto,
      name: trimmedName,
      groupId: createCollectionDto.groupId ? new Types.ObjectId(createCollectionDto.groupId) : undefined,
      slug,
      order,
    });
    return createdCollection.save();
  }

  async findAll(query: QueryCollectionDto): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const { search, isActive, groupId, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    if (groupId) {
      filter.groupId = new Types.ObjectId(groupId);
    }

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

    const [rawCollections, total] = await Promise.all([
      this.collectionModel
        .find(filter)
        .populate('groupId', 'name slug order isActive')
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.collectionModel.countDocuments(filter).exec(),
    ]);

    const collectionIds = rawCollections.map((c) => c._id);
    const lessonCounts = await this.lessonModel.aggregate([
      { $match: { collectionId: { $in: collectionIds }, isDeleted: { $ne: true } } },
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);
    const lessonCountMap = new Map(
      lessonCounts.map((lc) => [lc._id.toString(), lc.count]),
    );

    const data = rawCollections.map((c) => ({
      ...c,
      lessonsCount: lessonCountMap.get(c._id.toString()) || 0,
    }));

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<any> {
    const lang = this.getLang();
    const collection = await this.collectionModel
      .findOne({ _id: id, isDeleted: { $ne: true } })
      .populate('groupId', 'name slug order isActive')
      .lean()
      .exec();
    if (!collection) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    const lessonsCount = await this.lessonModel.countDocuments({
      collectionId: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    }).exec();
    return {
      ...collection,
      lessonsCount,
    };
  }

  async findBySlug(slug: string): Promise<any> {
    const lang = this.getLang();
    const collection = await this.collectionModel
      .findOne({ slug, isDeleted: { $ne: true } })
      .populate('groupId', 'name slug order isActive')
      .lean()
      .exec();
    if (!collection) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    const lessonsCount = await this.lessonModel.countDocuments({
      collectionId: collection._id,
      isDeleted: { $ne: true },
    }).exec();
    return {
      ...collection,
      lessonsCount,
    };
  }

  async update(id: string, updateCollectionDto: UpdateCollectionDto): Promise<Collection> {
    const lang = this.getLang();
    const updateData: Partial<Collection> = { ...updateCollectionDto } as any;

    if (updateCollectionDto.groupId !== undefined) {
      updateData.groupId = updateCollectionDto.groupId
        ? new Types.ObjectId(updateCollectionDto.groupId)
        : (null as any);
    }

    if (updateCollectionDto.name) {
      const trimmedName = updateCollectionDto.name.trim();
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingActive = await this.collectionModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        isDeleted: { $ne: true },
      });
      if (existingActive) {
        throw new ConflictException(
          await this.i18n.t('collection.COLLECTION_ALREADY_EXISTS', { lang }),
        );
      }
      updateData.name = trimmedName;

      // Free any legacy deleted records
      const legacyDeleted = await this.collectionModel.find({
        _id: { $ne: id },
        name: trimmedName,
        isDeleted: true,
      });
      for (const legacy of legacyDeleted) {
        const ts = Date.now();
        await this.collectionModel.findByIdAndUpdate(legacy._id, {
          name: `${legacy.name}_deleted_${ts}`,
          slug: `${legacy.slug}_deleted_${ts}`,
        });
      }
    }

    if (updateCollectionDto.slug || updateCollectionDto.name) {
      const rawSlug = updateCollectionDto.slug?.trim() || updateCollectionDto.name;
      if (rawSlug) {
        const baseSlug = this.generateSlug(rawSlug) || 'collection';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.collectionModel.exists({
            _id: { $ne: id },
            slug,
            isDeleted: { $ne: true },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;

        // Free any legacy deleted records with this slug
        const legacySlugDeleted = await this.collectionModel.find({
          _id: { $ne: id },
          slug,
          isDeleted: true,
        });
        for (const legacy of legacySlugDeleted) {
          const ts = Date.now();
          await this.collectionModel.findByIdAndUpdate(legacy._id, {
            name: `${legacy.name}_deleted_${ts}`,
            slug: `${legacy.slug}_deleted_${ts}`,
          });
        }
      }
    }

    const updatedCollection = await this.collectionModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { returnDocument: 'after' })
      .exec();
    if (!updatedCollection) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    return updatedCollection;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<Collection> {
    const lang = this.getLang();
    const collection = await this.findOne(id);
    const nextActive = isActive !== undefined ? isActive : !collection.isActive;
    const updated = await this.collectionModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextActive },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    return updated;
  }

  async remove(id: string): Promise<Collection> {
    const lang = this.getLang();
    const collection = await this.collectionModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!collection) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }

    const timestamp = Date.now();
    const deletedName = `${collection.name}_deleted_${timestamp}`;
    const deletedSlug = `${collection.slug}_deleted_${timestamp}`;

    const deletedCollection = await this.collectionModel
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

    return deletedCollection!;
  }

  async restore(id: string): Promise<Collection> {
    const lang = this.getLang();
    const restored = await this.collectionModel
      .findOneAndUpdate({ _id: id }, { isDeleted: false }, { returnDocument: 'after' })
      .exec();
    if (!restored) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    return restored;
  }

  async reorderCollections(items: { id: string; order: number }[]): Promise<void> {
    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { order: item.order } },
      },
    }));
    if (operations.length > 0) {
      await this.collectionModel.bulkWrite(operations);
    }
  }

  async assignGroup(collectionIds: string[], groupId: string | null): Promise<void> {
    const targetGroupId = groupId ? new Types.ObjectId(groupId) : null;
    await this.collectionModel.updateMany(
      { _id: { $in: collectionIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { groupId: targetGroupId } },
    );
  }
}
