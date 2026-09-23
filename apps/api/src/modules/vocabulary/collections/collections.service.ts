import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Collection, CollectionDocument } from './collection.schema.js';
import { Lesson, LessonDocument } from '../lessons/lesson.schema.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
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

  async create(createCollectionDto: CreateCollectionDto): Promise<Collection> {
    const rawSlug = createCollectionDto.slug?.trim() || createCollectionDto.name;
    const baseSlug = this.generateSlug(rawSlug) || 'collection';
    let slug = baseSlug;
    let counter = 1;
    while (await this.collectionModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = createCollectionDto.order;
    if (order === undefined || order === null || order <= 0) {
      const count = await this.collectionModel.countDocuments({ isDeleted: { $ne: true } });
      order = count + 1;
    }

    const createdCollection = new this.collectionModel({
      ...createCollectionDto,
      slug,
      order,
    });
    return createdCollection.save();
  }

  async findAll(query: QueryCollectionDto): Promise<{ data: any[]; total: number; page: number; limit: number }> {
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

    const [rawCollections, total] = await Promise.all([
      this.collectionModel
        .find(filter)
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
    const collection = await this.collectionModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean().exec();
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

  async update(id: string, updateCollectionDto: UpdateCollectionDto): Promise<Collection> {
    const lang = this.getLang();
    const updateData: Partial<Collection> = { ...updateCollectionDto } as any;

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
      }
    }

    const updatedCollection = await this.collectionModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { new: true })
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
        { new: true },
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
    const deletedCollection = await this.collectionModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true })
      .exec();
    if (!deletedCollection) {
      throw new NotFoundException(
        await this.i18n.t('collection.COLLECTION_NOT_FOUND', { lang }),
      );
    }
    return deletedCollection;
  }

  async restore(id: string): Promise<Collection> {
    const lang = this.getLang();
    const restored = await this.collectionModel
      .findOneAndUpdate({ _id: id }, { isDeleted: false }, { new: true })
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
}
