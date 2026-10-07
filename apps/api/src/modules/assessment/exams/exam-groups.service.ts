import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { ExamGroup, ExamGroupDocument } from './schemas/exam-group.schema.js';
import { Exam, ExamDocument } from './schemas/exam.schema.js';
import { CreateExamGroupDto } from './dto/create-exam-group.dto.js';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto.js';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';

@Injectable()
export class ExamGroupsService {
  constructor(
    @InjectModel(ExamGroup.name)
    private readonly examGroupModel: Model<ExamGroupDocument>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
  ) {}

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

  async create(dto: CreateExamGroupDto): Promise<ExamGroup> {
    const trimmedName = dto.name.trim();
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const existing = await this.examGroupModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      isDeleted: { $ne: true },
    });

    if (existing) {
      throw new ConflictException('Exam group with this name already exists');
    }

    const rawSlug = dto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'exam-group';
    let slug = baseSlug;
    let counter = 1;
    while (await this.examGroupModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = dto.order;
    if (order === undefined || order === null || order < 0) {
      const count = await this.examGroupModel.countDocuments({ isDeleted: { $ne: true } });
      order = count + 1;
    }

    const created = new this.examGroupModel({
      ...dto,
      name: trimmedName,
      slug,
      order,
      isActive: dto.isActive ?? true,
      isDeleted: false,
    });

    return created.save();
  }

  async findAll(query: QueryExamGroupDto): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const { search, q, isActive, page = 1, limit = 20 } = query;
    const matchStage: Record<string, any> = { isDeleted: { $ne: true } };

    const searchTerm = q || search;
    if (searchTerm) {
      matchStage.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      matchStage.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'exams',
          let: { groupId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$groupId', '$$groupId'] },
                isDeleted: { $ne: true },
              },
            },
            { $count: 'count' },
          ],
          as: 'examCountObj',
        },
      },
      {
        $addFields: {
          examCount: {
            $ifNull: [{ $arrayElemAt: ['$examCountObj.count', 0] }, 0],
          },
        },
      },
      { $project: { examCountObj: 0 } },
      { $sort: { order: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [data, total] = await Promise.all([
      this.examGroupModel.aggregate(pipeline).exec(),
      this.examGroupModel.countDocuments(matchStage).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(idOrSlug: string): Promise<any> {
    const query: Record<string, any> = { isDeleted: { $ne: true } };
    if (Types.ObjectId.isValid(idOrSlug)) {
      query._id = new Types.ObjectId(idOrSlug);
    } else {
      query.slug = idOrSlug;
    }

    const group = await this.examGroupModel.findOne(query).lean().exec();
    if (!group) {
      throw new NotFoundException('Exam group not found');
    }

    const examCount = await this.examModel.countDocuments({
      groupId: group._id,
      isDeleted: { $ne: true },
    });

    return {
      ...group,
      examCount,
    };
  }

  async update(id: string, dto: UpdateExamGroupDto): Promise<ExamGroup> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Exam group not found');
    }

    const currentGroup = await this.examGroupModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    });

    if (!currentGroup) {
      throw new NotFoundException('Exam group not found');
    }

    const updateData: Partial<ExamGroup> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== currentGroup.name.toLowerCase()) {
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await this.examGroupModel.findOne({
          _id: { $ne: new Types.ObjectId(id) },
          name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
          isDeleted: { $ne: true },
        });

        if (existing) {
          throw new ConflictException('Exam group with this name already exists');
        }
      }
      updateData.name = trimmedName;

      if (dto.slug) {
        const rawSlug = dto.slug.trim();
        const baseSlug = this.generateSlug(rawSlug) || 'exam-group';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.examGroupModel.exists({
            _id: { $ne: new Types.ObjectId(id) },
            slug,
            isDeleted: { $ne: true },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;
      } else if (trimmedName.toLowerCase() !== currentGroup.name.toLowerCase()) {
        const baseSlug = this.generateSlug(trimmedName) || 'exam-group';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.examGroupModel.exists({
            _id: { $ne: new Types.ObjectId(id) },
            slug,
            isDeleted: { $ne: true },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;
      }
    } else if (dto.slug !== undefined) {
      const rawSlug = dto.slug.trim();
      const baseSlug = this.generateSlug(rawSlug) || 'exam-group';
      let slug = baseSlug;
      let counter = 1;
      while (
        await this.examGroupModel.exists({
          _id: { $ne: new Types.ObjectId(id) },
          slug,
          isDeleted: { $ne: true },
        })
      ) {
        slug = `${baseSlug}-${counter++}`;
      }
      updateData.slug = slug;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description ? dto.description.trim() : '';
    }

    if (dto.order !== undefined) {
      updateData.order = dto.order;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const updated = await this.examGroupModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isDeleted: { $ne: true } },
        { $set: updateData },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Exam group not found');
    }

    return updated;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<ExamGroup> {
    const group = await this.findOne(id);
    const nextActive = isActive ?? !group.isActive;

    const updated = await this.examGroupModel
      .findByIdAndUpdate(id, { isActive: nextActive }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException('Exam group not found');
    }

    return updated;
  }

  async remove(id: string): Promise<ExamGroup> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Exam group not found');
    }

    const group = await this.examGroupModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isDeleted: true },
        { returnDocument: 'after' },
      )
      .exec();

    if (!group) {
      throw new NotFoundException('Exam group not found');
    }

    // Unset groupId from associated exams
    await this.examModel.updateMany(
      { groupId: new Types.ObjectId(id) },
      { $set: { groupId: null } },
    );

    return group;
  }

  async getExams(groupIdOrSlug: string, query?: any): Promise<any[]> {
    let groupObjectId: Types.ObjectId;
    if (Types.ObjectId.isValid(groupIdOrSlug)) {
      groupObjectId = new Types.ObjectId(groupIdOrSlug);
    } else {
      const group = await this.examGroupModel
        .findOne({ slug: groupIdOrSlug, isDeleted: { $ne: true } })
        .lean()
        .exec();
      if (!group) {
        throw new NotFoundException('Exam group not found');
      }
      groupObjectId = group._id as Types.ObjectId;
    }

    return this.examModel
      .find({
        groupId: groupObjectId,
        isDeleted: { $ne: true },
      })
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  async addExams(groupId: string, examIds: string[]): Promise<{ updatedCount: number }> {
    await this.findOne(groupId);
    if (!examIds || !examIds.length) {
      return { updatedCount: 0 };
    }

    const objectIds = examIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const result = await this.examModel.updateMany(
      { _id: { $in: objectIds }, isDeleted: { $ne: true } },
      { $set: { groupId: new Types.ObjectId(groupId) } },
    );

    return { updatedCount: result.modifiedCount };
  }

  async removeExam(groupId: string, examId: string): Promise<{ success: boolean }> {
    await this.findOne(groupId);
    if (!Types.ObjectId.isValid(examId)) {
      throw new NotFoundException('Exam not found');
    }

    await this.examModel.updateOne(
      { _id: new Types.ObjectId(examId), groupId: new Types.ObjectId(groupId) },
      { $set: { groupId: null } },
    );

    return { success: true };
  }
}
