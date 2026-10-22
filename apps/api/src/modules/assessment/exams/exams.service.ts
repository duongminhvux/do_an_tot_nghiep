import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Exam, ExamDocument } from './schemas/exam.schema.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { QueryExamDto } from './dto/query-exam.dto.js';
import { Attempt } from '../attempts/schemas/attempt.schema.js';
import { withAttemptCounts } from '../attempts/exam-attempt-counts.js';
import { GROUP_EXAM_SORT, nextGroupOrder } from './group-order.js';

@Injectable()
export class ExamsService {
  private orderQueue: Promise<unknown> = Promise.resolve();

  private ordered<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.orderQueue.then(work);
    this.orderQueue = pending.catch(() => undefined);
    return pending;
  }

  private async normalizeOrders(moveId?: string, position?: number) {
    const rows = await this.examModel
      .find({ isDeleted: { $ne: true } })
      .sort({ order: 1, createdAt: -1, _id: 1 })
      .select('_id order')
      .lean()
      .exec();
    if (moveId) {
      const index = rows.findIndex((row) => String(row._id) === moveId);
      if (index < 0) throw new NotFoundException('Exam not found');
      const [moved] = rows.splice(index, 1);
      rows.splice(
        Math.max(0, Math.min(rows.length, (position || rows.length + 1) - 1)),
        0,
        moved,
      );
    }
    const operations = rows.flatMap((row, index) =>
      row.order === index + 1
        ? []
        : [
            {
              updateOne: {
                filter: { _id: row._id, isDeleted: { $ne: true } },
                update: { $set: { order: index + 1 } },
              },
            },
          ],
    );
    if (operations.length) await this.examModel.bulkWrite(operations);
    return rows.map((row, index) => ({
      id: String(row._id),
      order: index + 1,
    }));
  }
  constructor(
    @InjectModel(Exam.name)
    private readonly examModel: Model<ExamDocument>,
    private readonly i18n: I18nService,
    @Optional() private readonly domainOutbox?: DomainOutboxService,
    @Optional()
    @InjectModel(Attempt.name)
    private readonly attempts?: Model<Attempt>,
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
    return this.ordered(() => this.createOrdered(createExamDto));
  }

  private async createOrdered(createExamDto: CreateExamDto): Promise<Exam> {
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
    if (order === undefined || order === null || order <= 0) {
      const highest = await this.examModel
        .findOne({ isDeleted: { $ne: true } })
        .sort({ order: -1 })
        .select('order')
        .lean()
        .exec();
      order = (highest?.order || 0) + 1;
    }

    const durationMinutes =
      createExamDto.durationMinutes !== undefined &&
      createExamDto.durationMinutes !== null
        ? Number(createExamDto.durationMinutes)
        : 120;
    const totalQuestions =
      createExamDto.totalQuestions !== undefined &&
      createExamDto.totalQuestions !== null
        ? Number(createExamDto.totalQuestions)
        : 200;

    const isActive = createExamDto.isActive ?? true;
    const groupId =
      createExamDto.groupId && Types.ObjectId.isValid(createExamDto.groupId)
        ? new Types.ObjectId(createExamDto.groupId)
        : null;

    const createdExam = new this.examModel({
      ...createExamDto,
      name: trimmedName,
      slug,
      durationMinutes,
      totalQuestions,
      isActive,
      order,
      groupId,
      groupOrder: groupId ? await nextGroupOrder(this.examModel, groupId) : 0,
    });

    const saved = await createdExam.save();
    try {
      await this.domainOutbox?.enqueue(
        'assessment.exam.created.v1',
        String(saved._id),
        {
          examId: String(saved._id),
          type: saved.type,
        },
      );
    } catch (error) {
      // No transaction yet; avoid falsely reporting that the saved exam failed.
      console.warn('Exam event outbox unavailable', error);
    }

    const ranks = await this.normalizeOrders(
      String(saved._id),
      createExamDto.order,
    );
    saved.order = ranks.find((row) => row.id === String(saved._id))!.order;
    return saved;
  }

  async findAll(
    query: QueryExamDto,
  ): Promise<{ data: Exam[]; total: number; page: number; limit: number }> {
    const { search, q, type, isActive, groupId, page = 1, limit = 10 } = query;
    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    const searchTerm = q || search;
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { slug: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (type) {
      filter.type = type;
    }

    if (groupId) {
      if (
        groupId === 'null' ||
        groupId === 'none' ||
        groupId === 'unassigned'
      ) {
        filter.groupId = { $in: [null, undefined] };
      } else if (Types.ObjectId.isValid(groupId)) {
        filter.groupId = new Types.ObjectId(groupId);
      }
    }

    if (isActive !== undefined) {
      filter.$and = [
        {
          $or: [
            { isActive },
            {
              isActive: { $exists: false },
              status: {
                $in: isActive ? ['ACTIVE', null] : ['INACTIVE', 'ARCHIVED'],
              },
            },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;
    const sortable = [
      'name',
      'totalQuestions',
      'durationMinutes',
      'order',
      'isActive',
    ];
    const field =
      query.sortBy && sortable.includes(query.sortBy)
        ? query.sortBy
        : undefined;
    const sort: Record<string, 1 | -1> = field
      ? { [field]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 }
      : filter.groupId instanceof Types.ObjectId
        ? { ...GROUP_EXAM_SORT }
        : { order: 1, createdAt: -1, _id: 1 };

    const [data, total] = await Promise.all([
      this.examModel
        .find(filter)
        .populate('groupId', 'name slug')
        .collation({ locale: 'vi', numericOrdering: true })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.examModel.countDocuments(filter).exec(),
    ]);

    return {
      data: await withAttemptCounts(
        this.attempts,
        data.map((exam: any) => ({
          ...exam,
          isActive:
            exam.isActive ?? (exam.status ? exam.status === 'ACTIVE' : true),
        })),
      ),
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

    const legacyStatus = (exam as any).status;
    const [result] = await withAttemptCounts(this.attempts, [exam]);
    return {
      ...result,
      isActive:
        exam.isActive ?? (legacyStatus ? legacyStatus === 'ACTIVE' : true),
    } as Exam;
  }

  async update(id: string, updateExamDto: UpdateExamDto): Promise<Exam> {
    return this.ordered(() => this.updateOrdered(id, updateExamDto));
  }

  private async updateOrdered(
    id: string,
    updateExamDto: UpdateExamDto,
  ): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const { groupId, order, ...restDto } = updateExamDto;
    const updateData: Record<string, any> = { ...restDto };

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

    if (updateExamDto.groupId !== undefined) {
      updateData.groupId =
        updateExamDto.groupId && Types.ObjectId.isValid(updateExamDto.groupId)
          ? (new Types.ObjectId(updateExamDto.groupId) as any)
          : null;
      // Moving to another group appends the exam at the end of that group.
      if (!updateData.groupId) updateData.groupOrder = 0;
      else if (
        !(await this.examModel.exists({
          _id: id,
          groupId: updateData.groupId,
        }))
      )
        updateData.groupOrder = await nextGroupOrder(
          this.examModel,
          updateData.groupId,
        );
    }

    const updatedExam = await this.examModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, {
        returnDocument: 'after',
      })
      .exec();

    if (!updatedExam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    if (order !== undefined) {
      const ranks = await this.normalizeOrders(id, order);
      updatedExam.order = ranks.find((row) => row.id === id)!.order;
    }
    return updatedExam;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<Exam> {
    const lang = this.getLang();
    const exam = await this.findOne(id);
    const nextActive = isActive ?? !exam.isActive;

    const updated = await this.examModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextActive },
        { returnDocument: 'after' },
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
    return this.ordered(() => this.removeOrdered(id));
  }

  private async removeOrdered(id: string): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const exam = await this.examModel.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });
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
        { returnDocument: 'after' },
      )
      .exec();

    await this.normalizeOrders();
    return deletedExam!;
  }

  async restore(id: string): Promise<Exam> {
    return this.ordered(() => this.restoreOrdered(id));
  }

  private async restoreOrdered(id: string): Promise<Exam> {
    const lang = this.getLang();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const restored = await this.examModel
      .findOneAndUpdate(
        { _id: id },
        { isDeleted: false },
        { returnDocument: 'after' },
      )
      .exec();

    if (!restored) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const ranks = await this.normalizeOrders(id, 0);
    restored.order = ranks.find((row) => row.id === id)!.order;
    return restored;
  }

  async reorderExams(items: { id: string; order: number }[]): Promise<void> {
    await this.ordered(async () => {
      if (!Array.isArray(items))
        throw new BadRequestException('Danh sách thứ tự không hợp lệ.');
      if (!items.length) {
        await this.normalizeOrders();
        return;
      }
      const rows = await this.examModel
        .find({ isDeleted: { $ne: true } })
        .select('_id')
        .lean()
        .exec();
      const ids = new Set(rows.map((row) => String(row._id)));
      if (
        items.length !== ids.size ||
        new Set(items.map((item) => item?.id)).size !== ids.size ||
        new Set(items.map((item) => item?.order)).size !== ids.size ||
        items.some(
          (item) =>
            !ids.has(item?.id) ||
            !Number.isInteger(item?.order) ||
            item.order < 1 ||
            item.order > ids.size,
        )
      ) {
        throw new BadRequestException(
          'Cần đầy đủ các đề với thứ tự 1 đến tổng số đề, không trùng vị trí.',
        );
      }
      await this.examModel.bulkWrite(
        items.map((item) => ({
          updateOne: {
            filter: {
              _id: new Types.ObjectId(item.id),
              isDeleted: { $ne: true },
            },
            update: { $set: { order: item.order } },
          },
        })),
      );
    });
  }
}
