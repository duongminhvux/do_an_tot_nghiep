import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from './collection.schema.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
  ) {}

  async create(createCollectionDto: CreateCollectionDto): Promise<Collection> {
    const createdCollection = new this.collectionModel(createCollectionDto);
    return createdCollection.save();
  }

  async findAll(query: QueryCollectionDto): Promise<{ data: Collection[]; total: number; page: number; limit: number }> {
    const { search, category, isActive, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.collectionModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.collectionModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Collection> {
    const collection = await this.collectionModel.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }
    return collection;
  }

  async update(id: string, updateCollectionDto: UpdateCollectionDto): Promise<Collection> {
    const updatedCollection = await this.collectionModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateCollectionDto, { new: true })
      .exec();
    if (!updatedCollection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }
    return updatedCollection;
  }

  async remove(id: string): Promise<Collection> {
    const deletedCollection = await this.collectionModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true })
      .exec();
    if (!deletedCollection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }
    return deletedCollection;
  }
}
