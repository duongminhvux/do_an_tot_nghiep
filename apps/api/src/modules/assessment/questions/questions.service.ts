import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parseOffice } from 'officeparser';
import { createHash } from 'node:crypto';
import { parseImportText, validateImportDraft } from '@repo/shared-types/assessment-import';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema.js';
import { Question, QuestionDocument } from './schemas/question.schema.js';
import { PassageGroup, PassageGroupDocument } from './schemas/passage-group.schema.js';
import { Passage, PassageDocument } from './schemas/passage.schema.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { CloudinaryService } from '../../upload/cloudinary.service.js';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly inFlightCreates = new Set<string>();
  private readonly inFlightImports = new Set<string>();

  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(PassageGroup.name)
    private readonly passageGroupModel: Model<PassageGroupDocument>,
    @InjectModel(Passage.name)
    private readonly passageModel: Model<PassageDocument>,
    private readonly cloudinaryService: CloudinaryService,
    @InjectModel(Exam.name)
    private readonly examModel?: Model<ExamDocument>,
  ) {}

  private async deleteUnusedImage(url?: string) {
    if (!url || !this.cloudinaryService.extractCloudinaryPublicId(url)) return;
    try {
      const [question, passage] = await Promise.all([
        this.questionModel.exists({ imageUrl: url }),
        this.passageModel.exists({ imageUrl: url }),
      ]);
      if (!question && !passage) await this.cloudinaryService.deleteFile(url);
    } catch (error) {
      this.logger.warn('Could not clean up replaced passage image', error);
    }
  }

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const { examId, passageGroupId, passageId, order, ...rest } = createQuestionDto;
    const effectivePassageGroupId = passageGroupId || passageId;

    let targetOrder = order;
    if (targetOrder === undefined || targetOrder === null) {
      const highest = await this.questionModel
        .findOne({ examId: new Types.ObjectId(examId) })
        .sort({ order: -1 })
        .select('order')
        .lean()
        .exec();
      targetOrder = highest ? (highest.order || 0) + 1 : 1;
    }

    const dedupeKey = `${examId}:${createQuestionDto.part}:${(createQuestionDto.content || '').trim()}:${targetOrder}`;
    if (this.inFlightCreates.has(dedupeKey)) {
      throw new BadRequestException('Yêu cầu tạo câu hỏi này đang được xử lý, vui lòng không gửi lặp lại.');
    }
    this.inFlightCreates.add(dedupeKey);

    try {
      const created = new this.questionModel({
        ...rest,
        examId: new Types.ObjectId(examId),
        passageGroupId: effectivePassageGroupId ? new Types.ObjectId(effectivePassageGroupId) : undefined,
        order: targetOrder,
        isActive: createQuestionDto.isActive ?? true,
      });

      return await created.save();
    } finally {
      setTimeout(() => {
        this.inFlightCreates.delete(dedupeKey);
      }, 1500);
    }
  }

  async findByExam(examId: string, part?: number): Promise<Question[]> {
    const filter: Record<string, any> = {
      examId: Types.ObjectId.isValid(examId) ? new Types.ObjectId(examId) : examId,
    };
    if (part) {
      filter.part = Number(part);
    }

    const questions = await this.questionModel
      .find(filter)
      .sort({ order: 1, createdAt: 1 })
      .populate('passageGroupId')
      .lean()
      .exec();

    return questions.map((q: any) => ({
      ...q,
      isActive: q.isActive ?? (q.status ? q.status === 'ACTIVE' : true),
      passageId: q.passageGroupId,
    })) as Question[];
  }

  async findPassagesByExam(examId: string): Promise<any[]> {
    const validExamId = Types.ObjectId.isValid(examId) ? new Types.ObjectId(examId) : examId;
    const groups = await this.passageGroupModel
      .find({ examId: validExamId })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    const groupIds = groups.map((g) => g._id);
    const passages = await this.passageModel
      .find({ passageGroupId: { $in: groupIds } })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    return groups.map((g) => {
      const childPassages = passages.filter(
        (p) => p.passageGroupId.toString() === g._id.toString(),
      );
      return {
        ...g,
        passages: childPassages,
        content: childPassages.map((cp) => cp.content).filter(Boolean).join('\n\n'),
        audioUrl: childPassages.find((cp) => cp.audioUrl)?.audioUrl,
        imageUrl: childPassages.find((cp) => cp.imageUrl)?.imageUrl,
      };
    });
  }

  private validateReadingPassage(part: unknown, passage: any): void {
    if (![6, 7].includes(Number(part))) return;
    const hasText = Boolean(passage.content?.trim());
    const hasImage = Boolean(passage.imageUrl?.trim());
    if (hasText === hasImage) {
      throw new BadRequestException('Each Part 6 or 7 passage must contain either text or an image.');
    }
  }

  async createPassageGroup(data: any): Promise<PassageGroup> {
    for (const p of Array.isArray(data.passages) && data.passages.length ? data.passages : [data]) {
      this.validateReadingPassage(data.part, p);
    }
    const created = new this.passageGroupModel({
      ...data,
      examId: new Types.ObjectId(data.examId),
    });
    const savedGroup = await created.save();

    if (Array.isArray(data.passages) && data.passages.length > 0) {
      for (let i = 0; i < data.passages.length; i++) {
        const p = data.passages[i];
        await this.passageModel.create({
          passageGroupId: savedGroup._id,
          type: p.type || 'TEXT',
          content: p.content,
          audioUrl: p.audioUrl,
          imageUrl: p.imageUrl,
          order: p.order !== undefined ? p.order : i + 1,
        });
      }
    } else if (data.content || data.audioUrl || data.imageUrl) {
      await this.passageModel.create({
        passageGroupId: savedGroup._id,
        type: data.type || 'TEXT',
        content: data.content,
        audioUrl: data.audioUrl,
        imageUrl: data.imageUrl,
        order: 1,
      });
    }

    return savedGroup;
  }

  async updatePassageGroup(id: string, data: any): Promise<PassageGroup> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('PassageGroup not found');
    }
    const { content, audioUrl, imageUrl, passages, ...groupFields } = data;
    const existingGroup = await this.passageGroupModel.findById(id).exec();
    if (!existingGroup) throw new NotFoundException('PassageGroup not found');
    const previousPassages = await this.passageModel.find({ passageGroupId: new Types.ObjectId(id) }).lean().exec();
    const nextPart = data.part ?? existingGroup.part;
    if (Array.isArray(passages) && passages.length > 0) {
      for (const patch of passages) {
        const existing = previousPassages.find((p) => String(p._id) === String(patch._id));
        if (!existing) throw new NotFoundException('Passage not found in this group');
      }
    } else if (previousPassages.length === 0 && (content !== undefined || imageUrl !== undefined || audioUrl !== undefined)) {
      this.validateReadingPassage(nextPart, { content, imageUrl });
    }
    for (const p of previousPassages) {
      const hasPassagePatches = Array.isArray(passages) && passages.length > 0;
      const patch = hasPassagePatches ? passages.find((item: any) => String(item._id) === String(p._id)) : undefined;
      this.validateReadingPassage(nextPart, { ...p, ...patch,
        ...(!hasPassagePatches && p === previousPassages[0] ? {
          content: content ?? p.content, imageUrl: imageUrl ?? p.imageUrl,
        } : {}),
      });
    }
    const updated = await this.passageGroupModel
      .findByIdAndUpdate(id, { $set: groupFields }, { returnDocument: 'after' })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException('PassageGroup not found');
    }

    const groupId = new Types.ObjectId(id);

    if (Array.isArray(passages) && passages.length > 0) {
      for (const p of passages) {
        if (p._id && Types.ObjectId.isValid(p._id)) {
          await this.passageModel.findByIdAndUpdate(p._id, { $set: p }, { returnDocument: 'after' }).exec();
        }
      }
    } else if (content !== undefined || audioUrl !== undefined || imageUrl !== undefined) {
      const existingChild = await this.passageModel.findOne({ passageGroupId: groupId }).sort({ order: 1 }).exec();
      if (existingChild) {
        if (content !== undefined) existingChild.content = content;
        if (audioUrl !== undefined) existingChild.audioUrl = audioUrl;
        if (imageUrl !== undefined) existingChild.imageUrl = imageUrl;
        await existingChild.save();
      } else {
        await this.passageModel.create({
          passageGroupId: groupId,
          type: data.type || 'TEXT',
          content: content || '',
          audioUrl,
          imageUrl,
          order: 1,
        });
      }
    }

    for (const passage of previousPassages) await this.deleteUnusedImage(passage.imageUrl);
    return updated as PassageGroup;
  }

  async removePassageGroup(id: string): Promise<{ deleted: boolean; deletedQuestionsCount: number }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('PassageGroup not found');
    }
    const groupId = new Types.ObjectId(id);

    await this.passageModel.deleteMany({ passageGroupId: groupId }).exec();
    const deletedQuestions = await this.questionModel.deleteMany({
      passageGroupId: groupId,
    }).exec();

    await this.passageGroupModel.findByIdAndDelete(id).exec();
    return { deleted: true, deletedQuestionsCount: deletedQuestions.deletedCount || 0 };
  }

  async createPassage(data: any): Promise<any> {
    if (data.passageGroupId) {
      const group = await this.passageGroupModel.findById(data.passageGroupId).exec();
      if (!group) throw new NotFoundException('PassageGroup not found');
      this.validateReadingPassage(group.part, data);
      const created = new this.passageModel({
        ...data,
        passageGroupId: new Types.ObjectId(data.passageGroupId),
      });
      return created.save();
    }
    return this.createPassageGroup(data);
  }

  async updatePassage(id: string, data: any): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Passage not found');
    }
    const isPassage = await this.passageModel.findById(id).exec();
    if (isPassage) {
      const group = await this.passageGroupModel.findById(isPassage.passageGroupId).exec();
      this.validateReadingPassage(group?.part, { ...isPassage.toObject(), ...data });
      const { title, ...passageFields } = data;
      const updated = await this.passageModel
        .findByIdAndUpdate(id, { $set: passageFields }, { returnDocument: 'after', runValidators: true })
        .lean()
        .exec();
      if (title && isPassage.passageGroupId) {
        await this.passageGroupModel.findByIdAndUpdate(
          isPassage.passageGroupId,
          { $set: { title } },
          { returnDocument: 'after' }
        ).exec();
      }
      if (updated && data.imageUrl !== undefined && data.imageUrl !== isPassage.imageUrl) {
        await this.deleteUnusedImage(isPassage.imageUrl);
      }
      return updated;
    }
    return this.updatePassageGroup(id, data);
  }

  async removePassage(id: string): Promise<{ deleted: boolean; deletedQuestionsCount: number }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Passage not found');
    }
    const isPassage = await this.passageModel.findById(id).exec();
    if (isPassage) {
      await this.passageModel.findByIdAndDelete(id).exec();
      return { deleted: true, deletedQuestionsCount: 0 };
    }
    return this.removePassageGroup(id);
  }

  async findOne(id: string): Promise<Question> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Question not found');
    }
    const question = await this.questionModel
      .findById(id)
      .populate('passageGroupId')
      .lean()
      .exec();
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return {
      ...question,
      isActive: question.isActive ?? ((question as any).status ? (question as any).status === 'ACTIVE' : true),
      passageId: question.passageGroupId,
    } as any;
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto): Promise<Question> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Question not found');
    }


    if ((updateQuestionDto as any).passageId && !(updateQuestionDto as any).passageGroupId) {
      (updateQuestionDto as any).passageGroupId = (updateQuestionDto as any).passageId;
    }

    const previous = await this.questionModel.findById(id).lean().exec();
    const updated = await this.questionModel
      .findByIdAndUpdate(id, { $set: updateQuestionDto }, { returnDocument: 'after', runValidators: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Question not found');
    }

    if (updateQuestionDto.imageUrl !== undefined && previous?.imageUrl !== updateQuestionDto.imageUrl) {
      await this.deleteUnusedImage(previous?.imageUrl);
    }

    return updated as Question;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Question not found');
    }
    await this.questionModel.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  parseQuestionText(rawText: string, defaultPart = 1, defaultSection?: 'LISTENING' | 'READING') {
    return parseImportText(rawText, defaultPart, defaultSection);
  }

  private async validateImportContext(examId: string, part: number, section?: string) {
    if (!Types.ObjectId.isValid(examId)) throw new NotFoundException('Exam not found');
    if (!Number.isInteger(part) || part < 1 || part > 7) throw new BadRequestException('Part phải từ 1 đến 7.');
    const expectedSection = part >= 5 ? 'READING' : 'LISTENING';
    if (section && section !== expectedSection) throw new BadRequestException('Part không khớp với kỹ năng đã chọn.');
    if (this.examModel) {
      const exam = await this.examModel.findById(examId).lean().exec();
      if (!exam) throw new NotFoundException('Exam not found');
      if (exam.type !== 'TOEIC') throw new BadRequestException('Import hiện hỗ trợ đề TOEIC.');
    }
    return expectedSection;
  }

  async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!['txt', 'docx', 'pdf'].includes(ext || '')) throw new BadRequestException('Chỉ hỗ trợ .docx, .pdf và .txt. Hãy chuyển .doc sang .docx.');
    if (!file.buffer?.length || file.buffer.length > 25 * 1024 * 1024) throw new BadRequestException('File phải có nội dung và không vượt quá 25 MB.');
    if (ext === 'txt') {
      return file.buffer.toString('utf-8');
    }
    try {
      const officeFileType = ext === 'pdf' ? 'pdf' : 'docx';
      const parsedText = await parseOffice(file.buffer, { fileType: officeFileType as any });
      return typeof parsedText === 'string' ? parsedText : String((await parsedText.to('text', { includeImages: false, textConfig: { preserveLayout: false } })).value || '');
    } catch (e: any) {
      throw new BadRequestException(`Không thể đọc nội dung file ${file.originalname}: ${e.message}`);
    }
  }

  async parseQuestions(examId: string, body: any, file?: Express.Multer.File) {
    const part = Number(body.part || 1);
    const section = await this.validateImportContext(examId, part, body.section);
    const rawText = file ? await this.extractTextFromFile(file) : body.rawText;
    if (typeof rawText !== 'string' || !rawText.trim()) throw new BadRequestException('Không có văn bản để phân tích. PDF dạng ảnh cần chuyển thành văn bản trước.');
    if (rawText.length > 1_000_000) throw new BadRequestException('Nội dung đề quá dài (tối đa 1 triệu ký tự).');
    const result = this.parseQuestionText(rawText, part, section);
    return { ...result, total: result.questions.length, rawText, issues: validateImportDraft(result, part) };
  }

  async importQuestions(examId: string, body: any, file?: Express.Multer.File) {
    const part = Number(body.part || 1);
    const section = await this.validateImportContext(examId, part, body.section);
    const json = (value: any, name: string) => {
      if (typeof value !== 'string') return value;
      try { return JSON.parse(value); } catch { throw new BadRequestException(`${name} không phải JSON hợp lệ.`); }
    };
    let questions = json(body.questions, 'questions');
    let groups = json(body.passageGroups, 'passageGroups');
    let passages = json(body.passages, 'passages');
    const rawText = file ? await this.extractTextFromFile(file) : body.rawText;
    if (!questions && rawText) {
      if (typeof rawText !== 'string' || rawText.length > 1_000_000) throw new BadRequestException('Nội dung đề không hợp lệ.');
      const result = this.parseQuestionText(rawText, part, section);
      questions = result.questions; groups ??= result.groups; passages ??= result.passages;
    }
    if (!Array.isArray(questions) || !questions.length || questions.length > 500) throw new BadRequestException('Mỗi lần import cần từ 1 đến 500 câu hỏi.');
    if (groups !== undefined && !Array.isArray(groups)) throw new BadRequestException('passageGroups phải là danh sách.');
    if (!groups?.length && (passages || body.passage)) {
      passages = passages || [json(body.passage, 'passage')];
      if (!Array.isArray(passages)) throw new BadRequestException('passages phải là danh sách.');
      const map = new Map<string, any>();
      for (const [i, p] of passages.entries()) {
        if (!p || typeof p !== 'object') throw new BadRequestException('Đoạn văn không hợp lệ.');
        const id = p.groupTempId || p.tempId || p.id || `group-${i + 1}`;
        if (!map.has(id)) map.set(id, { tempId: id, title: p.title, passages: [] });
        map.get(id).passages.push(p);
      }
      groups = [...map.values()];
    }
    groups = (groups || []).map((g: any, i: number) => {
      if (!g || !Array.isArray(g.passages)) throw new BadRequestException('Nhóm bài tập phải có danh sách passages.');
      const id = g.tempId || g.id || `group-${i + 1}`;
      return { ...g, id, tempId: id, passages: g.passages.map((p: any, pi: number) => {
        if (!p || typeof p !== 'object') throw new BadRequestException('Đoạn văn không hợp lệ.');
        const pid = p.tempId || p.id || `${id}-passage-${pi + 1}`;
        return { ...p, id: pid, tempId: pid, type: p.type || 'TEXT', content: p.content || '' };
      }) };
    });
    questions = questions.map((q: any, i: number) => {
      if (!q || typeof q !== 'object') throw new BadRequestException('Câu hỏi không hợp lệ.');
      if (q.passageGroupId || q.passageId) throw new BadRequestException('Import sử dụng liên kết nhóm trong bản soạn, không sử dụng ID bài đọc đã lưu.');
      return { ...q, order: q.order ?? i + 1 };
    });
    const errors = validateImportDraft({ groups, questions }, part).filter((issue) => issue.severity === 'error');
    if (errors.length) throw new BadRequestException(errors.map((issue) => issue.message));
    const batchId = body.batchId;
    if (batchId !== undefined && (typeof batchId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(batchId))) throw new BadRequestException('Mã lượt import không hợp lệ.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ part, groups, questions })).digest('hex');
    const importLockKey = batchId ? `${examId}:${batchId}` : `${examId}:${fingerprint}`;
    if (this.inFlightImports.has(importLockKey)) {
      throw new BadRequestException('Lượt import này đang được xử lý, vui lòng đợi trong giây lát và không bấm gửi lại.');
    }
    this.inFlightImports.add(importLockKey);
    try {
      const findSavedBatch = async () => {
        if (!batchId) return null;
        const saved = await this.questionModel.find({ examId: new Types.ObjectId(examId), importBatchId: batchId }).sort({ importIndex: 1 }).lean().exec();
        if (!saved.length) return null;
        if (saved.length !== questions.length || saved.some((q) => q.importFingerprint !== fingerprint)) throw new BadRequestException('Lượt import đã tồn tại với dữ liệu khác hoặc chưa hoàn tất. Hãy tải lại đề để kiểm tra.');
        return { importedCount: saved.length, passageGroupsCount: new Set(saved.map((q) => q.passageGroupId?.toString()).filter(Boolean)).size, data: saved };
      };
      const savedBatch = await findSavedBatch();
      if (savedBatch) return savedBatch;
      // Validate every document before writing groups, including Mongoose field constraints.
      for (const q of questions) {
        await new this.questionModel({ ...q, examId: new Types.ObjectId(examId), section, part }).validate();
      }
      const highest = await this.questionModel.findOne({ examId: new Types.ObjectId(examId) }).sort({ order: -1 }).select('order').lean().exec();
      const highestGroup = groups.length ? await this.passageGroupModel.findOne({ examId: new Types.ObjectId(examId) }).sort({ order: -1 }).select('order').lean().exec() : null;
      const groupMap = new Map<string, Types.ObjectId>();
      const passageMap = new Map<string, Types.ObjectId>();
      const createdGroupIds: Types.ObjectId[] = [];
      const questionIds = questions.map(() => new Types.ObjectId());
      try {
        for (const [gi, g] of groups.entries()) {
          const groupId = new Types.ObjectId();
          createdGroupIds.push(groupId);
          await this.passageGroupModel.create({ _id: groupId, examId: new Types.ObjectId(examId), part, section, title: g.title || `Part ${part} - Bài tập ${gi + 1}`, order: (highestGroup?.order || 0) + gi + 1 });
          groupMap.set(g.id, groupId);
          for (const [pi, p] of g.passages.entries()) {
            await this.passageModel.create({ passageGroupId: groupId, type: p.type, content: p.content.trim(), audioUrl: p.audioUrl?.trim(), imageUrl: p.imageUrl?.trim(), order: pi + 1 });
            passageMap.set(p.id, groupId);
          }
        }
        const docs = questions.map((q: any, i: number) => ({
          _id: questionIds[i], examId: new Types.ObjectId(examId), section, part,
          passageGroupId: groupMap.get(q.passageGroupTempId) || passageMap.get(q.passageTempId),
          content: q.content.trim(), options: q.options.map((o: any) => ({ key: o.key, text: o.text.trim() })), correctAnswer: q.correctAnswer,
          explanation: q.explanation?.trim() || '', imageUrl: q.imageUrl?.trim(), audioUrl: q.audioUrl?.trim(),
          order: (highest?.order || 0) + i + 1, isActive: q.isActive ?? true,
          ...(batchId ? { importBatchId: batchId, importIndex: i, importFingerprint: fingerprint } : {}),
        }));
        const inserted = await this.questionModel.insertMany(docs, { ordered: true });
        return { importedCount: inserted.length, passageGroupsCount: createdGroupIds.length, data: inserted };
      } catch (error) {
        // Remove only IDs allocated by this request; no existing exam data is touched.
        try {
          await this.questionModel.deleteMany({ _id: { $in: questionIds } }).exec();
          if (createdGroupIds.length) {
            await this.passageModel.deleteMany({ passageGroupId: { $in: createdGroupIds } }).exec();
            await this.passageGroupModel.deleteMany({ _id: { $in: createdGroupIds } }).exec();
          }
        } catch (cleanupError) {
          this.logger.error('Import cleanup failed', cleanupError);
          throw new BadRequestException('Lưu đề bị gián đoạn và chưa dọn sạch dữ liệu. Hãy tải lại đề để kiểm tra trước khi import lại.');
        }
        // A concurrent retry may have completed the same batch while this request was writing.
        const completedBatch = await findSavedBatch();
        if (completedBatch) return completedBatch;
        throw error;
      }
    } finally {
      this.inFlightImports.delete(importLockKey);
    }
  }
}
