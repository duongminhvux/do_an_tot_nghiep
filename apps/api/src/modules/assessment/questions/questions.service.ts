import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parseOffice } from 'officeparser';
import { Question, QuestionDocument } from './schemas/question.schema.js';
import { PassageGroup, PassageGroupDocument } from './schemas/passage-group.schema.js';
import { Passage, PassageDocument } from './schemas/passage.schema.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(PassageGroup.name)
    private readonly passageGroupModel: Model<PassageGroupDocument>,
    @InjectModel(Passage.name)
    private readonly passageModel: Model<PassageDocument>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const { examId, passageGroupId, passageId, order, status, ...rest } = createQuestionDto;
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

    const resolvedStatus = status || 'ACTIVE';
    const created = new this.questionModel({
      ...rest,
      examId: new Types.ObjectId(examId),
      passageGroupId: effectivePassageGroupId ? new Types.ObjectId(effectivePassageGroupId) : undefined,
      order: targetOrder,
      isActive: resolvedStatus === 'ACTIVE',
    });

    return created.save();
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
      status: q.status || (q.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
      isActive: q.status ? q.status === 'ACTIVE' : q.isActive !== false,
      passageId: q.passageGroupId,
      passageTitle: q.passageTitle || q.passageGroupId?.title || undefined,
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
      };
    });
  }

  async createPassageGroup(data: any): Promise<PassageGroup> {
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
          title: p.title,
          content: p.content,
          audioUrl: p.audioUrl,
          order: p.order !== undefined ? p.order : i + 1,
        });
      }
    } else if (data.content || data.audioUrl) {
      await this.passageModel.create({
        passageGroupId: savedGroup._id,
        type: data.type || 'TEXT',
        title: data.title,
        content: data.content,
        audioUrl: data.audioUrl,
        order: 1,
      });
    }

    return savedGroup;
  }

  async updatePassageGroup(id: string, data: any): Promise<PassageGroup> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('PassageGroup not found');
    }
    const updated = await this.passageGroupModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException('PassageGroup not found');
    }
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
      return this.passageModel
        .findByIdAndUpdate(id, { $set: data }, { new: true })
        .lean()
        .exec();
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
      passageId: question.passageGroupId,
    } as any;
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto): Promise<Question> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Question not found');
    }

    if (updateQuestionDto.status) {
      (updateQuestionDto as any).isActive = updateQuestionDto.status === 'ACTIVE';
    } else if (updateQuestionDto.isActive !== undefined) {
      (updateQuestionDto as any).status = updateQuestionDto.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    if ((updateQuestionDto as any).passageId && !(updateQuestionDto as any).passageGroupId) {
      (updateQuestionDto as any).passageGroupId = (updateQuestionDto as any).passageId;
    }

    const updated = await this.questionModel
      .findByIdAndUpdate(id, { $set: updateQuestionDto }, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Question not found');
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

  parseQuestionText(rawText: string, defaultPart?: number, defaultSection?: 'LISTENING' | 'READING') {
    const lines = rawText.split(/\r?\n/);
    const passages: Array<{
      tempId: string;
      type: 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT';
      title?: string;
      content?: string;
      audioUrl?: string;
      order: number;
    }> = [];
    const questions: any[] = [];

    let currentPassage: {
      tempId: string;
      type: 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT';
      title?: string;
      content?: string;
      audioUrl?: string;
      order: number;
    } | null = null;
    let inPassage = false;

    let currentQ: any = null;
    let currentOptions: { key: 'A' | 'B' | 'C' | 'D'; text: string }[] = [];
    let inExplanation = false;

    const finalizeCurrent = () => {
      if (currentQ && currentQ.content && currentOptions.length >= 2) {
        currentQ.options = [...currentOptions];
        if (!currentQ.correctAnswer) currentQ.correctAnswer = 'A';
        questions.push(currentQ);
      }
      currentQ = null;
      currentOptions = [];
      inExplanation = false;
    };

    const detectPassageType = (rawTag: string): 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT' => {
      const tag = rawTag.toUpperCase();
      if (tag.includes('EMAIL') || tag.includes('THƯ')) return 'EMAIL';
      if (tag.includes('ADVERT') || tag.includes('QUẢNG CÁO') || tag.includes('ADS')) return 'ADVERTISEMENT';
      if (tag.includes('ARTICLE') || tag.includes('BÀI BÁO')) return 'ARTICLE';
      if (tag.includes('NOTICE') || tag.includes('THÔNG BÁO')) return 'NOTICE';
      if (tag.includes('CHAT') || tag.includes('HỘI THOẠI')) return 'CHAT';
      return 'TEXT';
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const line = raw.trim();
      if (!line) continue;

      // 1. Check Passage start: [PASSAGE], [EMAIL], [ARTICLE], [NOTICE], [CHAT], [ADVERTISEMENT], or Vietnamese equivalents
      const passageMatch = line.match(
        /^(?:\[(PASSAGE|TEXT|EMAIL|ADVERTISEMENT|ARTICLE|NOTICE|CHAT)\]|(?:passage|đoạn văn|doan van|đoạn hội thoại|bài đọc|bài nghe|bài nói|email|thư|quảng cáo|thông báo|bài báo|chat))(?:\s+\d+)?[:\s\-]*(.*)$/i,
      );
      if (passageMatch) {
        finalizeCurrent();
        inPassage = true;
        inExplanation = false;
        const matchedTag = passageMatch[1] || passageMatch[0];
        const passageType = detectPassageType(matchedTag);
        const inlineTitle = passageMatch[2]?.trim();
        const passageIndex = passages.length + 1;
        currentPassage = {
          tempId: `passage-${passageIndex}`,
          type: passageType,
          title: inlineTitle || `${passageType} ${passageIndex}`,
          content: '',
          audioUrl: undefined,
          order: passageIndex,
        };
        passages.push(currentPassage);
        continue;
      }

      if (inPassage && currentPassage) {
        const isQ = line.match(
          /^(?:(?:\d+)[\.\/\:\)]\s*|(?:câu|question)\s+\d+[:.]\s*|\[QUESTION[^\]]*\]\s*)(.+)$/i,
        );
        if (isQ) {
          inPassage = false;
          // fall through to process question
        } else {
          if (/^(?:type|loại):/i.test(line)) {
            const rawType = line.replace(/^(?:type|loại):\s*/i, '').trim();
            currentPassage.type = detectPassageType(rawType);
          } else if (/^(?:title|tiêu đề|tieu de):/i.test(line)) {
            currentPassage.title = line.replace(/^(?:title|tiêu đề|tieu de):\s*/i, '').trim();
          } else if (/^(?:audio|âm thanh|am thanh|\[audio\]):/i.test(line)) {
            currentPassage.audioUrl = line.replace(/^(?:audio|âm thanh|am thanh|\[audio\]):\s*/i, '').trim();
          } else if (/^(?:transcript|content|nội dung|noi dung|lời thoại):/i.test(line)) {
            const extra = line.replace(/^(?:transcript|content|nội dung|noi dung|lời thoại):\s*/i, '').trim();
            if (extra) {
              currentPassage.content = (currentPassage.content ? currentPassage.content + '\n' : '') + extra;
            }
          } else {
            currentPassage.content = (currentPassage.content ? currentPassage.content + '\n' : '') + line;
          }
          continue;
        }
      }

      // 2. Check Question start: 101. The manager... or 1. Look at... or Câu 101: or [QUESTION]
      const qMatch = line.match(
        /^(?:(?:\d+)[\.\/\:\)]\s*|(?:câu|question)\s+\d+[:.]\s*|\[QUESTION[^\]]*\]\s*)(.+)$/i,
      );
      if (qMatch && qMatch[1]) {
        finalizeCurrent();
        currentQ = {
          content: qMatch[1].trim(),
          part: defaultPart || 1,
          section: defaultSection || 'LISTENING',
          options: [],
          correctAnswer: 'A',
          explanation: '',
          passageTempId: currentPassage ? currentPassage.tempId : undefined,
          passageTitle: currentPassage ? currentPassage.title : undefined,
        };
        continue;
      }

      if (!currentQ) continue;

      // 3. Check Options: A. / B. / C. / D. or A) or (A)
      const optMatch = line.match(/^(?:([A-D])[\.\)]|\(([A-D])\))\s+(.*)$/i);
      if (optMatch) {
        const key = ((optMatch[1] || optMatch[2]) as string).toUpperCase() as
          | 'A'
          | 'B'
          | 'C'
          | 'D';
        const text = (optMatch[3] || '').trim();
        currentOptions.push({ key, text });
        inExplanation = false;
        continue;
      }

      // 4. Check Answer: Answer: B, Đáp án: B, Key: B, [ANSWER]: B
      const ansMatch = line.match(
        /^(?:answer|đáp án|dap an|key|\[ANSWER\])[:\s\-]+(?:\()?([A-D])(?:\))?/i,
      );
      if (ansMatch && ansMatch[1]) {
        currentQ.correctAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        inExplanation = false;
        continue;
      }

      // 5. Check Explanation: Explanation: ... or Giải thích: ...
      const expMatch = line.match(
        /^(?:explanation|giải thích|giai thich|lời giải|loi giai|\[EXPLANATION\])[:\s\-]*(.*)$/i,
      );
      if (expMatch) {
        inExplanation = true;
        if (expMatch[1] && expMatch[1].trim()) {
          currentQ.explanation = expMatch[1].trim();
        }
        continue;
      }

      // 6. Multi-line continuation
      if (inExplanation) {
        currentQ.explanation += (currentQ.explanation ? ' ' : '') + line;
      } else if (currentOptions.length === 0) {
        currentQ.content += ' ' + line;
      }
    }

    finalizeCurrent();

    return {
      passages,
      passage: passages[0] || null,
      questions,
    };
  }

  async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext === 'txt') {
      return file.buffer.toString('utf-8');
    }
    try {
      const officeFileType = ext === 'pdf' ? 'pdf' : 'docx';
      const parsedText = await parseOffice(file.buffer, { fileType: officeFileType as any });
      return typeof parsedText === 'string' ? parsedText : String(parsedText || '');
    } catch (e: any) {
      const fallbackStr = file.buffer.toString('utf-8');
      if (fallbackStr.includes('[QUESTION') || fallbackStr.includes('Câu ')) {
        return fallbackStr;
      }
      throw new BadRequestException(`Không thể đọc nội dung file ${file.originalname}: ${e.message}`);
    }
  }

  async parseQuestions(examId: string, body: any, file?: Express.Multer.File) {
    let rawText = body.rawText;
    if (file) {
      const extracted = await this.extractTextFromFile(file);
      if (extracted) {
        rawText = extracted;
      }
    }

    if (!rawText) {
      throw new BadRequestException('Vui lòng cung cấp file hoặc nội dung văn bản để phân tích.');
    }

    const part = body.part ? Number(body.part) : 1;
    const section = body.section || (part >= 5 ? 'READING' : 'LISTENING');
    const result = this.parseQuestionText(rawText, part, section);

    return {
      success: true,
      passages: result.passages,
      passage: result.passage,
      questions: result.questions,
      total: result.questions.length,
      rawText,
    };
  }

  async importQuestions(examId: string, body: any, file?: Express.Multer.File) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new NotFoundException('Exam not found');
    }

    let rawText = body.rawText;
    if (file) {
      const extracted = await this.extractTextFromFile(file);
      if (extracted) {
        rawText = extracted;
      }
    }

    let parsedQuestions = body.questions;
    if (typeof parsedQuestions === 'string') {
      try {
        parsedQuestions = JSON.parse(parsedQuestions);
      } catch {
        parsedQuestions = undefined;
      }
    }

    let parsedPassages = body.passages;
    if (typeof parsedPassages === 'string') {
      try {
        parsedPassages = JSON.parse(parsedPassages);
      } catch {
        parsedPassages = undefined;
      }
    }

    let parsedPassage = body.passage;
    if (typeof parsedPassage === 'string') {
      try {
        parsedPassage = JSON.parse(parsedPassage);
      } catch {
        parsedPassage = undefined;
      }
    }

    if ((!parsedPassages || parsedPassages.length === 0) && parsedPassage) {
      parsedPassages = [parsedPassage];
    }

    const part = body.part ? Number(body.part) : 1;
    const section = body.section || (part >= 5 ? 'READING' : 'LISTENING');

    if ((!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) && rawText) {
      const result = this.parseQuestionText(rawText, part, section);
      parsedQuestions = result.questions;
      if (!parsedPassages || parsedPassages.length === 0) {
        parsedPassages = result.passages;
      }
    }

    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new BadRequestException('Không tìm thấy câu hỏi hợp lệ trong dữ liệu để import.');
    }

    let createdPassageGroupId: Types.ObjectId | undefined = undefined;

    // Create PassageGroup and child Passages if passages exist
    if (Array.isArray(parsedPassages) && parsedPassages.length > 0) {
      const validPassages = parsedPassages.filter(
        (p: any) => p && (p.title || p.content || p.audioUrl),
      );

      if (validPassages.length > 0) {
        const highestGroup = await this.passageGroupModel
          .findOne({ examId: new Types.ObjectId(examId) })
          .sort({ order: -1 })
          .select('order')
          .lean()
          .exec();
        const nextGroupOrder = highestGroup ? (highestGroup.order || 0) + 1 : 1;

        const groupTitle =
          body.passageGroupTitle ||
          validPassages[0]?.title ||
          `Passage Group Part ${part} #${nextGroupOrder}`;

        const passageGroup = await this.passageGroupModel.create({
          examId: new Types.ObjectId(examId),
          section,
          part,
          title: groupTitle,
          order: nextGroupOrder,
        });
        createdPassageGroupId = passageGroup._id;

        for (let pIdx = 0; pIdx < validPassages.length; pIdx++) {
          const p = validPassages[pIdx];
          await this.passageModel.create({
            passageGroupId: passageGroup._id,
            type: p.type || 'TEXT',
            title: p.title || `Text ${pIdx + 1}`,
            content: p.content || '',
            audioUrl: p.audioUrl,
            order: p.order !== undefined ? p.order : pIdx + 1,
          });
        }
      }
    }

    const highest = await this.questionModel
      .findOne({ examId: new Types.ObjectId(examId) })
      .sort({ order: -1 })
      .select('order')
      .lean()
      .exec();
    let currentOrder = highest ? (highest.order || 0) : 0;

    const docsToInsert = parsedQuestions.map((q: any) => {
      currentOrder += 1;
      let matchedGroupId: Types.ObjectId | undefined = undefined;

      if (q.passageGroupId && Types.ObjectId.isValid(q.passageGroupId)) {
        matchedGroupId = new Types.ObjectId(q.passageGroupId);
      } else if (q.passageId && Types.ObjectId.isValid(q.passageId)) {
        matchedGroupId = new Types.ObjectId(q.passageId);
      } else if (createdPassageGroupId) {
        matchedGroupId = createdPassageGroupId;
      }

      return {
        examId: new Types.ObjectId(examId),
        passageGroupId: matchedGroupId,
        section: q.section || section,
        part: q.part ? Number(q.part) : part,
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer || 'A',
        explanation: q.explanation || '',
        order: q.order || currentOrder,
        isActive: true,
      };
    });

    const inserted = await this.questionModel.insertMany(docsToInsert);

    return {
      success: true,
      message: `Đã import thành công ${inserted.length} câu hỏi vào đề thi!`,
      importedCount: inserted.length,
      passageGroupId: createdPassageGroupId,
      data: inserted,
    };
  }
}
