import { InjectPgConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { isUuid,newId } from '../../../postgres/ids.js';
import { SqlRecords,newSqlRow } from '../../../postgres/records.js';
import { rows,sql } from '../../../postgres/sql.js';

import { BadRequestException,Injectable,Logger,NotFoundException,Optional } from '@nestjs/common';


import { parseImportText,validateImportDraft } from '@repo/shared-types/assessment-import';
import { createHash } from 'node:crypto';
import { parseOffice } from 'officeparser';
import { AudioGenerationStatus } from '../../../common/media/generated-audio.row.js';
import { MediaStorageService } from '../../../common/media/media-storage.service.js';
import { ManagedMediaService } from '../../upload/managed-media.service.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { PdfAiLearningService } from './pdf-ai-learning.service.js';
import { PassageGroup } from './rows/passage-group.row.js';
import { Question } from './rows/question.row.js';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly inFlightCreates = new Set<string>();
  private readonly inFlightImports = new Set<string>();

  private async captureGroupEdit(id: string, before: any) {
    if (!this.learning) return undefined;
    try {
      const linked = await this.questionModel.select(sql`("passage_group_id" = ${String(id)})`, sql`ORDER BY "order" ASC NULLS FIRST`);
      const source = linked.find(q => this.learning!.sourceJob(q.importBatchId));
      if (!source) return undefined;
      const group = await this.passageGroupModel.one(sql`id=${id}::uuid`);
      const passages = await this.passageModel.select(sql`("passage_group_id" = ${String(id)})`, sql`ORDER BY "order" ASC NULLS FIRST`);
      return this.learning.enqueue({ kind: 'group', jobId: this.learning.sourceJob(source.importBatchId), examId: String(source.examId),
        number: source.sourceOrder ?? source.order, part: source.part, before, after: { ...group, passages }, reason: 'saved-passage-edit' });
    } catch (error) {
      this.logger.error('Could not capture passage correction', error);
      return { status: 'failed', message: 'Đề đã lưu nhưng chưa ghi được mẫu sửa bài đọc/lời thoại.' };
    }
  }

  private get questionModel(){return new SqlRecords(this.nativeDb,'questions');}
private get passageGroupModel(){return new SqlRecords(this.nativeDb,'passagegroups');}
private get passageModel(){return new SqlRecords(this.nativeDb,'passages');}
private get examModel(){return new SqlRecords(this.nativeDb,'exams');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly mediaUploadService: ManagedMediaService,
private readonly mediaStorage: MediaStorageService,
@Optional() private readonly learning?: PdfAiLearningService
  ) {}

  private validateQuestion(question:any){
    if(!isUuid(String(question.examId))||!['LISTENING','READING'].includes(question.section)||!Number.isInteger(Number(question.part))||question.part<1||question.part>7)throw new BadRequestException('Invalid question exam, section or part');
    if(!String(question.content??'').trim()&&!([6,7].includes(Number(question.part))&&/^https?:\/\//i.test(question.imageUrl??'')))throw new BadRequestException('Question content is required');
    if(!Array.isArray(question.options)||!question.options.length||question.options.some((option:any)=>!['A','B','C','D'].includes(option.key)||(![1,2].includes(Number(question.part))&&!String(option.text??'').trim()))||!['A','B','C','D'].includes(question.correctAnswer))throw new BadRequestException('Invalid question options or correct answer');
  }
  private async withPassageGroups(pending:Promise<any[]>){
    const questions=await pending;const groups=await this.passageGroupModel.select(sql`id=ANY(${questions.map(row=>row.passageGroupId).filter(Boolean)}::uuid[])`);const map=new Map(groups.map(row=>[String(row._id),row]));return questions.map(row=>({...row,passageGroupId:map.get(String(row.passageGroupId))??null}));
  }
  private async deleteLocalAudio(url?: string, storageKey?: string) {
    const key = storageKey || this.mediaStorage.storageKeyFromPublicUrl(url);
    if (!key) return;
    await this.mediaStorage.delete(key).catch((error) => {
      this.logger.warn(`Could not clean up local audio ${key}`, error);
    });
  }

  private async deleteUnusedImage(url?: string) {
    if (!url || !this.mediaUploadService.isManagedUrl(url)) return;
    try {
      const [question, passage] = await Promise.all([
        this.questionModel.one(sql`("image_url" = ${url})`),
        this.passageModel.one(sql`("image_url" = ${url})`),
      ]);
      if (!question && !passage) await this.mediaUploadService.deleteFile(url);
    } catch (error) {
      this.logger.warn('Could not clean up replaced passage image', error);
    }
  }

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"assessment-questions:"+createQuestionDto.examId},0))`);

    const { examId, passageGroupId, passageId, order, ...rest } = createQuestionDto;
    const effectivePassageGroupId = passageGroupId || passageId;

    let targetOrder = order;
    if (targetOrder === undefined || targetOrder === null) {
      const highest = await this.questionModel.one(sql`("exam_id" = ${String(examId)})`, sql`ORDER BY "order" DESC NULLS LAST`);
      targetOrder = highest ? (highest.order || 0) + 1 : 1;
    }

    const dedupeKey = `${examId}:${createQuestionDto.part}:${(createQuestionDto.content || '').trim()}:${targetOrder}`;
    if (this.inFlightCreates.has(dedupeKey)) {
      throw new BadRequestException('Yêu cầu tạo câu hỏi này đang được xử lý, vui lòng không gửi lặp lại.');
    }
    this.inFlightCreates.add(dedupeKey);

    try {
      const created = newSqlRow('questions',{
        ...rest,
        examId: String(examId),
        passageGroupId: effectivePassageGroupId ? String(effectivePassageGroupId) : undefined,
        order: targetOrder,
        isActive: createQuestionDto.isActive ?? true });

      this.validateQuestion(created);
      return await this.questionModel.insert(created);
    } finally {
      setTimeout(() => {
        this.inFlightCreates.delete(dedupeKey);
      }, 1500);
    }
  
    });
  }

  async findByExam(examId: string, part?: number): Promise<Question[]> {
    const questions=await this.withPassageGroups(this.questionModel.select(sql`exam_id=${examId}::uuid AND (${part??null}::int IS NULL OR part=${part??null})`,sql`ORDER BY "order",created_at,id`));

    return questions.map((q: any) => ({
      ...q,
      isActive: q.isActive ?? (q.status ? q.status === 'ACTIVE' : true),
      passageId: q.passageGroupId })) as Question[];
  }

  async findPassagesByExam(examId: string): Promise<any[]> {
    const validExamId = isUuid(examId) ? String(examId) : examId;
    const groups = await this.passageGroupModel.select(sql`("exam_id" = ${validExamId})`, sql`ORDER BY "order" ASC NULLS FIRST,"created_at" ASC NULLS FIRST`);

    const groupIds = groups.map((g) => g._id);
    const passages = await this.passageModel.select(sql`("passage_group_id"=ANY(${groupIds}::uuid[]))`, sql`ORDER BY "order" ASC NULLS FIRST,"created_at" ASC NULLS FIRST`);

    return groups.map((g) => {
      const childPassages = passages.filter(
        (p) => p.passageGroupId.toString() === g._id.toString(),
      );
      return {
        ...g,
        passages: childPassages,
        content: childPassages.map((cp) => cp.content).filter(Boolean).join('\n\n'),
        audioUrl: childPassages.find((cp) => cp.audioUrl)?.audioUrl,
        imageUrl: childPassages.find((cp) => cp.imageUrl)?.imageUrl };
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
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"assessment-questions:"+data.examId},0))`);

    for (const p of Array.isArray(data.passages) && data.passages.length ? data.passages : [data]) {
      this.validateReadingPassage(data.part, p);
    }
    const created = newSqlRow('passagegroups',{
      ...data,
      examId: String(data.examId) });
    const savedGroup = await this.passageGroupModel.insert(created);

    if (Array.isArray(data.passages) && data.passages.length > 0) {
      for (let i = 0; i < data.passages.length; i++) {
        const p = data.passages[i];
        await this.passageModel.insert({
          passageGroupId: savedGroup._id,
          type: p.type || 'TEXT',
          content: p.content,
          audioUrl: p.audioUrl,
          imageUrl: p.imageUrl,
          order: p.order !== undefined ? p.order : i + 1 });
      }
    } else if (data.content || data.audioUrl || data.imageUrl) {
      await this.passageModel.insert({
        passageGroupId: savedGroup._id,
        type: data.type || 'TEXT',
        content: data.content,
        audioUrl: data.audioUrl,
        imageUrl: data.imageUrl,
        order: 1 });
    }

    return savedGroup;
  
    });
  }

  async updatePassageGroup(id: string, data: any): Promise<PassageGroup> {
    if (!isUuid(id)) {
      throw new NotFoundException('PassageGroup not found');
    }
    const { content, audioUrl, imageUrl, passages, ...groupFields } = data;
    const existingGroup = await this.passageGroupModel.one(sql`id=${id}::uuid`);
    if (!existingGroup) throw new NotFoundException('PassageGroup not found');
    const previousPassages = await this.passageModel.select(sql`("passage_group_id" = ${String(id)})`);
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
          content: content ?? p.content, imageUrl: imageUrl ?? p.imageUrl } : {}) });
    }
    const updated = await this.passageGroupModel.patch(sql`id=${id}::uuid`,groupFields);
    if (!updated) {
      throw new NotFoundException('PassageGroup not found');
    }

    const groupId = String(id);

    if (Array.isArray(passages) && passages.length > 0) {
      for (const p of passages) {
        if (p._id && isUuid(p._id)) {
          await this.passageModel.patch(sql`id=${p._id}::uuid`,p);
        }
      }
    } else if (content !== undefined || audioUrl !== undefined || imageUrl !== undefined) {
      const existingChild = await this.passageModel.one(sql`("passage_group_id" = ${groupId})`, sql`ORDER BY "order" ASC NULLS FIRST`);
      if (existingChild) {
        if (content !== undefined) existingChild.content = content;
        if (audioUrl !== undefined) existingChild.audioUrl = audioUrl;
        if (imageUrl !== undefined) existingChild.imageUrl = imageUrl;
        await this.passageModel.upsert(existingChild);
      } else {
        await this.passageModel.insert({
          passageGroupId: groupId,
          type: data.type || 'TEXT',
          content: content || '',
          audioUrl,
          imageUrl,
          order: 1 });
      }
    }

    for (const passage of previousPassages) await this.deleteUnusedImage(passage.imageUrl);
    const learning = await this.captureGroupEdit(id, { ...existingGroup, passages: previousPassages });
    return { ...updated, learning } as PassageGroup;
  }

  async removePassageGroup(id: string): Promise<{ deleted: boolean; deletedQuestionsCount: number }> {
    if (!isUuid(id)) {
      throw new NotFoundException('PassageGroup not found');
    }
    const groupId = String(id);
    const passagesToDelete = await this.passageModel.select(sql`("passage_group_id" = ${groupId})`);

    await this.passageModel.remove(sql`("passage_group_id" = ${groupId})`);
    const deletedQuestions = await this.questionModel.remove(sql`("passage_group_id" = ${groupId})`);

    await this.passageGroupModel.remove(sql`id=${id}::uuid`).then(records=>records[0]??null);
    await Promise.all(passagesToDelete.map((passage: any) => this.deleteLocalAudio(passage.audioUrl, passage.audioMeta?.storageKey)));
    return { deleted: true, deletedQuestionsCount: deletedQuestions.length || 0 };
  }

  async createPassage(data: any): Promise<any> {
    if (data.passageGroupId) {
      const group = await this.passageGroupModel.one(sql`id=${data.passageGroupId}::uuid`);
      if (!group) throw new NotFoundException('PassageGroup not found');
      this.validateReadingPassage(group.part, data);
      const created = newSqlRow('passages',{
        ...data,
        passageGroupId: String(data.passageGroupId) });
      return this.passageModel.insert(created);
    }
    return this.createPassageGroup(data);
  }

  async updatePassage(id: string, data: any): Promise<any> {
    if (!isUuid(id)) {
      throw new NotFoundException('Passage not found');
    }
    const isPassage = await this.passageModel.one(sql`id=${id}::uuid`);
    if (isPassage) {
      const group = await this.passageGroupModel.one(sql`id=${isPassage.passageGroupId}::uuid`);
      const beforePassages = this.learning ? await this.passageModel.select(sql`("passage_group_id" = ${isPassage.passageGroupId})`, sql`ORDER BY "order" ASC NULLS FIRST`) : [];
      this.validateReadingPassage(group?.part, { ...isPassage, ...data });
      const { title, ...passageFields } = data;
      if (
        [3, 4].includes(Number(group?.part)) &&
        data.content !== undefined &&
        data.content !== isPassage.content &&
        isPassage.audioMeta?.status === AudioGenerationStatus.READY
      ) {
        (passageFields as Record<string, any>)['audioMeta.status'] = AudioGenerationStatus.STALE;
      }
      const updated = await this.passageModel.patch(sql`id=${id}::uuid`,passageFields);
      if (title && isPassage.passageGroupId) {
        await this.passageGroupModel.patch(sql`id=${isPassage.passageGroupId}::uuid`,{ title });
      }
      if (updated && data.imageUrl !== undefined && data.imageUrl !== isPassage.imageUrl) {
        await this.deleteUnusedImage(isPassage.imageUrl);
      }
      const learning = group ? await this.captureGroupEdit(String(group._id), { ...group, passages: beforePassages }) : undefined;
      return { ...updated, learning };
    }
    return this.updatePassageGroup(id, data);
  }

  async removePassage(id: string): Promise<{ deleted: boolean; deletedQuestionsCount: number }> {
    if (!isUuid(id)) {
      throw new NotFoundException('Passage not found');
    }
    const isPassage = await this.passageModel.one(sql`id=${id}::uuid`);
    if (isPassage) {
      await this.passageModel.remove(sql`id=${id}::uuid`).then(records=>records[0]??null);
      await this.deleteLocalAudio(isPassage.audioUrl, isPassage.audioMeta?.storageKey);
      return { deleted: true, deletedQuestionsCount: 0 };
    }
    return this.removePassageGroup(id);
  }

  async findOne(id: string): Promise<Question> {
    if (!isUuid(id)) {
      throw new NotFoundException('Question not found');
    }
    const question=(await this.withPassageGroups(this.questionModel.select(sql`id=${id}::uuid`)))[0];
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return {
      ...question,
      isActive: question.isActive ?? ((question as any).status ? (question as any).status === 'ACTIVE' : true),
      passageId: question.passageGroupId } as any;
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto): Promise<Question> {
    if (!isUuid(id)) {
      throw new NotFoundException('Question not found');
    }


    if ((updateQuestionDto as any).passageId && !(updateQuestionDto as any).passageGroupId) {
      (updateQuestionDto as any).passageGroupId = (updateQuestionDto as any).passageId;
    }

    const previous = await this.questionModel.one(sql`id=${id}::uuid`);
    const updatePayload: Record<string, any> = { ...updateQuestionDto };
    // Query validators need the effective Part when validating question script/options.
    if (previous) updatePayload.part = updateQuestionDto.part ?? previous.part;
    if (previous && [6, 7].includes(Number(updatePayload.part))) {
      updatePayload.content = updateQuestionDto.content ?? previous.content;
      updatePayload.imageUrl = updateQuestionDto.imageUrl ?? previous.imageUrl;
    }
    const audioInputsChanged = Boolean(
      previous && [1, 2].includes(Number(previous.part)) && (
        (updateQuestionDto.content !== undefined && updateQuestionDto.content !== previous.content) ||
        (updateQuestionDto.options !== undefined && JSON.stringify(updateQuestionDto.options) !== JSON.stringify(previous.options)) ||
        (updateQuestionDto.part !== undefined && Number(updateQuestionDto.part) !== Number(previous.part))
      )
    );
    if (audioInputsChanged && previous?.audioMeta?.status === AudioGenerationStatus.READY) {
      updatePayload.audioMeta = {...previous.audioMeta,status:AudioGenerationStatus.STALE};
    }
    this.validateQuestion({...previous,...updatePayload});
    const updated = await this.questionModel.patch(sql`id=${id}::uuid`,updatePayload);

    if (!updated) {
      throw new NotFoundException('Question not found');
    }

    if (updateQuestionDto.imageUrl !== undefined && previous?.imageUrl !== updateQuestionDto.imageUrl) {
      await this.deleteUnusedImage(previous?.imageUrl);
    }

    const jobId = this.learning?.sourceJob(previous?.importBatchId);
    if (previous && jobId) {
      const learning = await this.learning!.enqueue({ kind: 'question', jobId, examId: String(previous.examId), questionId: id,
        number: previous.sourceOrder ?? previous.order, before: previous, after: updated, reason: 'saved-question-edit' });
      return { ...updated, learning } as Question;
    }
    return updated as Question;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!isUuid(id)) {
      throw new NotFoundException('Question not found');
    }
    const question = await this.questionModel.remove(sql`id=${id}::uuid`).then(records=>records[0]??null);
    if (question) await this.deleteLocalAudio(question.audioUrl, question.audioMeta?.storageKey);
    return { deleted: true };
  }

  parseQuestionText(rawText: string, defaultPart = 1, defaultSection?: 'LISTENING' | 'READING') {
    return parseImportText(rawText, defaultPart, defaultSection);
  }

  private async validateImportContext(examId: string, part: number, section?: string) {
    if (!isUuid(examId)) throw new NotFoundException('Exam not found');
    if (!Number.isInteger(part) || part < 1 || part > 7) throw new BadRequestException('Part phải từ 1 đến 7.');
    const expectedSection = part >= 5 ? 'READING' : 'LISTENING';
    if (section && section !== expectedSection) throw new BadRequestException('Part không khớp với kỹ năng đã chọn.');
    if (this.examModel) {
      const exam = await this.examModel.one(sql`id=${examId}::uuid`);
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
    const preserveSourceOrder = body.preserveSourceOrder === true;
    if (body.preserveSourceOrder !== undefined && typeof body.preserveSourceOrder !== 'boolean') throw new BadRequestException('preserveSourceOrder phải là boolean.');
    if (preserveSourceOrder) {
      const ranges = [[1, 6], [7, 31], [32, 70], [71, 100], [101, 130], [131, 146], [147, 200]];
      const [first, last] = ranges[part - 1];
      if (questions.some((q: any) => q.order < first || q.order > last)) throw new BadRequestException(`Số câu Part ${part} phải từ ${first} đến ${last}.`);
    }
    if (batchId !== undefined && (typeof batchId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(batchId))) throw new BadRequestException('Mã lượt import không hợp lệ.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ part, groups, questions, ...(preserveSourceOrder ? { preserveSourceOrder: true } : {}) })).digest('hex');
    const importLockKey = preserveSourceOrder ? `${examId}:source-part:${part}` : batchId ? `${examId}:${batchId}` : `${examId}:${fingerprint}`;
    if (this.inFlightImports.has(importLockKey)) {
      throw new BadRequestException('Lượt import này đang được xử lý, vui lòng đợi trong giây lát và không bấm gửi lại.');
    }
    this.inFlightImports.add(importLockKey);
    try {
      return await withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"assessment-questions:"+examId},0))`);

      const findSavedBatch = async () => {
        if (!batchId) return null;
        const saved = await this.questionModel.select(sql`("exam_id" = ${String(examId)}) AND ("import_batch_id" = ${batchId})`, sql`ORDER BY "import_index" ASC NULLS FIRST`);
        if (!saved.length) return null;
        if (saved.length !== questions.length || saved.some((q) => q.importFingerprint !== fingerprint)) throw new BadRequestException('Lượt import đã tồn tại với dữ liệu khác hoặc chưa hoàn tất. Hãy tải lại đề để kiểm tra.');
        return { importedCount: saved.length, passageGroupsCount: new Set(saved.map((q) => q.passageGroupId?.toString()).filter(Boolean)).size, data: saved };
      };
      const savedBatch = await findSavedBatch();
      if (savedBatch) {
        const jobId = this.learning?.sourceJob(batchId);
        const learning = jobId ? await this.learning!.enqueue({ kind: 'part', jobId, examId, after: { part, groups, questions }, reason: 'saved-ai-import' }) : undefined;
        return { ...savedBatch, learning };
      }
      if (preserveSourceOrder && await this.questionModel.one(sql`("exam_id" = ${String(examId)}) AND ("order"=ANY(${questions.map((q: any) => q.order)}::double precision[]))`)) {
        throw new BadRequestException('Đề đã có số câu trong Part này. Không thể ghi đè; hãy kiểm tra nội dung đã lưu.');
      }
      // Validate every document before writing groups, including PostgreSQL repository field constraints.
      for (const q of questions) {
        this.validateQuestion({ ...q,examId,section,part });
      }
      const highest = await this.questionModel.one(sql`("exam_id" = ${String(examId)})`, sql`ORDER BY "order" DESC NULLS LAST`);
      const highestGroup = groups.length ? await this.passageGroupModel.one(sql`("exam_id" = ${String(examId)})`, sql`ORDER BY "order" DESC NULLS LAST`) : null;
      const groupMap = new Map<string, string>();
      const passageMap = new Map<string, string>();
      const createdGroupIds: string[] = [];
      const questionIds = questions.map(() => newId());
      {
        for (const [gi, g] of groups.entries()) {
          const groupId = newId();
          createdGroupIds.push(groupId);
          await this.passageGroupModel.insert({ _id: groupId, examId: String(examId), part, section, title: g.title || `Part ${part} - Bài tập ${gi + 1}`, order: (highestGroup?.order || 0) + gi + 1 });
          groupMap.set(g.id, groupId);
          for (const [pi, p] of g.passages.entries()) {
            await this.passageModel.insert({ passageGroupId: groupId, type: p.type, content: p.content.trim(), audioUrl: p.audioUrl?.trim(), imageUrl: p.imageUrl?.trim(), order: pi + 1 });
            passageMap.set(p.id, groupId);
          }
        }
        const docs = questions.map((q: any, i: number) => ({
          _id: questionIds[i], examId: String(examId), section, part,
          passageGroupId: groupMap.get(q.passageGroupTempId) || passageMap.get(q.passageTempId),
          content: q.content.trim(), options: q.options.map((o: any) => ({ key: o.key, text: o.text.trim() })), correctAnswer: q.correctAnswer,
          explanation: q.explanation?.trim() || '', imageUrl: q.imageUrl?.trim(), audioUrl: q.audioUrl?.trim(),
          order: preserveSourceOrder ? q.order : (highest?.order || 0) + i + 1, isActive: q.isActive ?? true,
          ...(batchId ? { importBatchId: batchId, importIndex: i, importFingerprint: fingerprint } : {}),
          ...(preserveSourceOrder ? { sourceOrder: q.order } : {}) }));
        const inserted=[];for(const doc of docs)inserted.push(await this.questionModel.insert(doc));
        const jobId = this.learning?.sourceJob(batchId);
        const learning = jobId ? await this.learning!.enqueue({ kind: 'part', jobId, examId, after: { part, groups, questions }, reason: 'saved-ai-import' }) : undefined;
        return { importedCount: inserted.length, passageGroupsCount: createdGroupIds.length, data: inserted, learning };
      }
    
      });
    } finally {
      this.inFlightImports.delete(importLockKey);
    }
  }
}
