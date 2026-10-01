import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Exam, ExamDocument } from './schemas/exam.schema.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { QueryExamDto } from './dto/query-exam.dto.js';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
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

  async create(createExamDto: CreateExamDto): Promise<Exam> {
    const lang = this.getLang();
    const trimmedName = createExamDto.name.trim();

    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await this.examModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      isDeleted: { $ne: true },
    });

    if (existing) {
      throw new ConflictException(
        await this.i18n.t('exam.EXAM_ALREADY_EXISTS', { lang }),
      );
    }

    const rawSlug = createExamDto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'exam';
    let slug = baseSlug;
    let counter = 1;
    while (await this.examModel.exists({ slug, isDeleted: { $ne: true } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = createExamDto.order;
    if (order === undefined || order === null || order < 0) {
      const count = await this.examModel.countDocuments({ isDeleted: { $ne: true } });
      order = count + 1;
    }

    const section = createExamDto.section || (createExamDto.mode === 'FULL_TEST' ? 'FULL_TEST' : undefined);

    const status = createExamDto.status || (createExamDto.isActive === false ? 'INACTIVE' : 'ACTIVE');
    const isActive = status === 'INACTIVE' ? false : (createExamDto.isActive ?? true);

    const createdExam = new this.examModel({
      ...createExamDto,
      name: trimmedName,
      slug,
      section,
      status,
      isActive,
      order,
    });

    return createdExam.save();
  }

  async findAll(query: QueryExamDto): Promise<{ data: Exam[]; total: number; page: number; limit: number }> {
    const { search, type, mode, section, status, isActive, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (type) {
      filter.type = type;
    }

    if (mode) {
      filter.mode = mode;
    }

    if (section) {
      filter.section = section;
    }

    if (status) {
      filter.status = status;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.examModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.examModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(idOrSlug: string): Promise<Exam> {
    const lang = this.getLang();
    const query: Record<string, any> = { isDeleted: { $ne: true } };

    if (Types.ObjectId.isValid(idOrSlug)) {
      query._id = idOrSlug;
    } else {
      query.slug = idOrSlug;
    }

    const exam = await this.examModel.findOne(query).lean().exec();

    if (!exam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    return exam as Exam;
  }

  async update(id: string, updateExamDto: UpdateExamDto): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const updateData: Partial<Exam> = { ...updateExamDto };

    if (updateExamDto.name) {
      const trimmedName = updateExamDto.name.trim();
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await this.examModel.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        isDeleted: { $ne: true },
      });

      if (existing) {
        throw new ConflictException(
          await this.i18n.t('exam.EXAM_ALREADY_EXISTS', { lang }),
        );
      }
      updateData.name = trimmedName;
    }

    if (updateExamDto.slug || updateExamDto.name) {
      const rawSlug = updateExamDto.slug?.trim() || updateExamDto.name;
      if (rawSlug) {
        const baseSlug = this.generateSlug(rawSlug) || 'exam';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.examModel.exists({
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

    const updatedExam = await this.examModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { new: true })
      .exec();

    if (!updatedExam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    return updatedExam;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<Exam> {
    const lang = this.getLang();
    const exam = await this.findOne(id);
    const nextActive = isActive !== undefined ? isActive : !exam.isActive;

    const updated = await this.examModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextActive },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    return updated;
  }

  async remove(id: string): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const exam = await this.examModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!exam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const deletedExam = await this.examModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
        },
        { new: true },
      )
      .exec();

    return deletedExam!;
  }

  async restore(id: string): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const restored = await this.examModel
      .findOneAndUpdate({ _id: id }, { isDeleted: false }, { new: true })
      .exec();

    if (!restored) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    return restored;
  }

  async reorderExams(items: { id: string; order: number }[]): Promise<void> {
    const operations = items
      .filter((item) => Types.ObjectId.isValid(item.id))
      .map((item) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(item.id) },
          update: { $set: { order: item.order } },
        },
      }));

    if (operations.length > 0) {
      await this.examModel.bulkWrite(operations);
    }
  }
}
