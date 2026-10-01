import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parseOffice } from 'officeparser';
import { Question, QuestionDocument } from './schemas/question.schema.js';
import { Passage, PassageDocument } from './schemas/passage.schema.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(Passage.name)
    private readonly passageModel: Model<PassageDocument>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const { examId, passageId, order, status, ...rest } = createQuestionDto;

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
      passageId: passageId ? new Types.ObjectId(passageId) : undefined,
      order: targetOrder,
      status: resolvedStatus,
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
      .populate('passageId')
      .lean()
      .exec();

    return questions.map((q: any) => ({
      ...q,
      status: q.status || (q.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
      isActive: q.status ? q.status === 'ACTIVE' : q.isActive !== false,
      passageTitle: q.passageTitle || q.passageId?.title || undefined,
    })) as Question[];
  }

  async findPassagesByExam(examId: string): Promise<Passage[]> {
    return this.passageModel
      .find({ examId: Types.ObjectId.isValid(examId) ? new Types.ObjectId(examId) : examId })
      .sort({ order: 1 })
      .lean()
      .exec();
  }

  async createPassage(data: any): Promise<Passage> {
    const created = new this.passageModel({
      ...data,
      examId: new Types.ObjectId(data.examId),
    });
    return created.save();
  }

  async findOne(id: string): Promise<Question> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Question not found');
    }
    const question = await this.questionModel.findById(id).populate('passageId').lean().exec();
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question as Question;
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
      title?: string;
      content?: string;
      audioUrl?: string;
      imageUrl?: string;
    }> = [];
    const questions: any[] = [];

    let currentPassage: {
      tempId: string;
      title?: string;
      content?: string;
      audioUrl?: string;
      imageUrl?: string;
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

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const line = raw.trim();
      if (!line) continue;

      // 1. Check Passage start
      const passageMatch = line.match(
        /^(?:\[PASSAGE\]|passage|đoạn văn|doan van|đoạn hội thoại|bài đọc|bài nghe|bài nói)(?:\s+\d+)?[:\s\-]*(.*)$/i,
      );
      if (passageMatch) {
        finalizeCurrent();
        inPassage = true;
        inExplanation = false;
        const inlineTitle = passageMatch[1]?.trim();
        const passageIndex = passages.length + 1;
        currentPassage = {
          tempId: `passage-${passageIndex}`,
          title: inlineTitle || `Đoạn văn ${passageIndex}`,
          content: '',
          audioUrl: undefined,
          imageUrl: undefined,
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
          if (/^(?:title|tiêu đề|tieu de):/i.test(line)) {
            currentPassage.title = line.replace(/^(?:title|tiêu đề|tieu de):\s*/i, '').trim();
          } else if (/^(?:audio|âm thanh|am thanh|\[audio\]):/i.test(line)) {
            currentPassage.audioUrl = line.replace(/^(?:audio|âm thanh|am thanh|\[audio\]):\s*/i, '').trim();
          } else if (/^(?:image|ảnh|hình ảnh|hinh anh|\[image\]):/i.test(line)) {
            currentPassage.imageUrl = line.replace(/^(?:image|ảnh|hình ảnh|hinh anh|\[image\]):\s*/i, '').trim();
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

      // 3. Check Image & Audio
      const imgMatch = line.match(/^(?:\[IMAGE\]|image|ảnh|hình ảnh|hinh anh)[:\s]+(.*)$/i);
      if (imgMatch && imgMatch[1]) {
        currentQ.imageUrl = imgMatch[1].trim();
        continue;
      }

      const audioMatch = line.match(/^(?:\[AUDIO\]|audio|âm thanh|file nghe)[:\s]+(.*)$/i);
      if (audioMatch && audioMatch[1]) {
        currentQ.audioUrl = audioMatch[1].trim();
        continue;
      }

      // 4. Check Options: A. / B. / C. / D. or A) or (A)
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

      // 5. Check Answer: Answer: B, Đáp án: B, Key: B, [ANSWER]: B
      const ansMatch = line.match(
        /^(?:answer|đáp án|dap an|key|\[ANSWER\])[:\s\-]+(?:\()?([A-D])(?:\))?/i,
      );
      if (ansMatch && ansMatch[1]) {
        currentQ.correctAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        inExplanation = false;
        continue;
      }

      // 6. Check Explanation: Explanation: ... or Giải thích: ...
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

      // 7. Multi-line continuation
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

    const passageMap = new Map<string, Types.ObjectId>();
    let singleCreatedPassageId: Types.ObjectId | undefined = undefined;

    if (Array.isArray(parsedPassages) && parsedPassages.length > 0) {
      const highestPassage = await this.passageModel
        .findOne({ examId: new Types.ObjectId(examId) })
        .sort({ order: -1 })
        .select('order')
        .lean()
        .exec();
      let nextPassageOrder = highestPassage ? (highestPassage.order || 0) + 1 : 1;

      for (let pIdx = 0; pIdx < parsedPassages.length; pIdx++) {
        const p = parsedPassages[pIdx];
        if (!p || (!p.title && !p.content && !p.audioUrl && !p.imageUrl)) continue;

        const passageDoc = await this.passageModel.create({
          examId: new Types.ObjectId(examId),
          title: p.title || `Passage Part ${part} #${pIdx + 1}`,
          content: p.content || '',
          audioUrl: p.audioUrl,
          imageUrl: p.imageUrl,
          section,
          order: nextPassageOrder++,
        });

        if (p.tempId) {
          passageMap.set(p.tempId, passageDoc._id);
        }
        passageMap.set(String(pIdx), passageDoc._id);
        if (!singleCreatedPassageId) {
          singleCreatedPassageId = passageDoc._id;
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
      let matchedPassageId: Types.ObjectId | undefined = undefined;

      if (q.passageId && Types.ObjectId.isValid(q.passageId)) {
        matchedPassageId = new Types.ObjectId(q.passageId);
      } else if (q.passageTempId && passageMap.has(q.passageTempId)) {
        matchedPassageId = passageMap.get(q.passageTempId);
      } else if (passageMap.size === 1) {
        matchedPassageId = singleCreatedPassageId;
      }

      return {
        examId: new Types.ObjectId(examId),
        passageId: matchedPassageId,
        passageTitle: q.passageTitle || parsedPassages?.[0]?.title,
        section: q.section || section,
        part: q.part ? Number(q.part) : part,
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer || 'A',
        explanation: q.explanation || '',
        audioUrl: q.audioUrl,
        imageUrl: q.imageUrl,
        order: q.order || currentOrder,
        status: 'ACTIVE',
        isActive: true,
      };
    });

    const inserted = await this.questionModel.insertMany(docsToInsert);

    return {
      success: true,
      message: `Đã import thành công ${inserted.length} câu hỏi vào đề thi!`,
      importedCount: inserted.length,
      passageCount: passageMap.size,
      data: inserted,
    };
  }
}
