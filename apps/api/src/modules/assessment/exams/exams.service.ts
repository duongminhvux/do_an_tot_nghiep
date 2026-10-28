import {learnerExamVisibility} from './exam-visibility.js';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { SqlRecords,newSqlRow } from '../../../postgres/records.js';
import { identifier,rows,sql } from '../../../postgres/sql.js';

import {
BadRequestException,
ConflictException,
Injectable,
NotFoundException,
Optional
} from '@nestjs/common';


import { I18nContext,I18nService } from 'nestjs-i18n';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { createConnection,withPgTransaction } from '../../../postgres/connection.js';
import { withAttemptCounts } from '../attempts/exam-attempt-counts.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { QueryExamDto } from './dto/query-exam.dto.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { GROUP_EXAM_SORT,nextGroupOrder } from './group-order.js';
import { Exam } from './rows/exam.row.js';

@Injectable()
export class ExamsService {
  private orderQueue: Promise<unknown> = Promise.resolve();

  private ordered<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.orderQueue.then(()=>withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended('assessment-exam-order',0))`);return work();}));
    this.orderQueue = pending.catch(() => undefined);
    return pending;
  }

  private async normalizeOrders(moveId?: string, position?: number) {
    const rows = await this.examModel.select(sql`("is_deleted" IS DISTINCT FROM ${true})`, sql`ORDER BY "order" ASC NULLS FIRST,"created_at" DESC NULLS LAST,"id" ASC NULLS FIRST`);
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
    for(const [index,row]of rows.entries())if(row.order!==index+1)await this.examModel.patch(sql`id=${row._id}::uuid AND is_deleted IS NOT TRUE`,{order:index+1});
    return rows.map((row, index) => ({
      id: String(row._id),
      order: index + 1 }));
  }
  private get examModel(){return new SqlRecords(this.nativeDb,'exams');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly i18n: I18nService,
@Optional() private readonly domainOutbox?: DomainOutboxService
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
    const existing=await this.examModel.one(sql`lower(name)=lower(${trimmedName}) AND is_deleted IS NOT TRUE`);

    if (existing) {
      throw new ConflictException(
        await this.i18n.t('exam.EXAM_ALREADY_EXISTS', { lang }),
      );
    }

    const rawSlug = createExamDto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'exam';
    let slug = baseSlug;
    let counter = 1;
    while (await this.examModel.one(sql`("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = createExamDto.order;
    if (order === undefined || order === null || order <= 0) {
      const highest = await this.examModel.one(sql`("is_deleted" IS DISTINCT FROM ${true})`, sql`ORDER BY "order" DESC NULLS LAST`);
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
      createExamDto.groupId && isUuid(createExamDto.groupId)
        ? String(createExamDto.groupId)
        : null;

    const createdExam = newSqlRow('exams',{
      ...createExamDto,
      name: trimmedName,
      slug,
      durationMinutes,
      totalQuestions,
      isActive,
      order,
      groupId,
      groupOrder: groupId ? await nextGroupOrder(this.examModel, groupId) : 0 });

    if (!this.domainOutbox) throw new Error('Transactional outbox not configured');
    const saved = await this.domainOutbox.withTransaction(async (session) => {
      const created=await new SqlRecords(createConnection(session.client as any),'exams').insert(createdExam);
      await this.domainOutbox!.enqueue('assessment.exam.created.v1', String(created._id), {
        examId: String(created._id), type: created.type,
      }, session);
      return created;
    });

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
    const term=q||search||'';
    const noGroup=['null','none','unassigned'].includes(groupId??'');
    const filter=sql`${learnerExamVisibility()} AND is_deleted IS NOT TRUE AND (${term}='' OR position(lower(${term}) in lower(name||' '||COALESCE(slug,'')||' '||COALESCE(description,'')))>0)
      AND (${query.publicationStatus??null}::text IS NULL OR publication_status=${query.publicationStatus??null})
      AND (${type??null}::text IS NULL OR type=${type??null})
      AND (${isActive??null}::boolean IS NULL OR COALESCE(is_active,payload->>'status' IS NULL OR payload->>'status'='ACTIVE')=${isActive??null}::boolean)
      AND (NOT ${noGroup} OR group_id IS NULL)
      AND (${isUuid(groupId??'')?groupId:null}::uuid IS NULL OR group_id=${isUuid(groupId??'')?groupId:null}::uuid)`;
    const columns:Record<string,string>={name:'name',totalQuestions:'total_questions',durationMinutes:'duration_minutes',order:'order',isActive:'is_active'};
    const sorting=query.sortBy&&columns[query.sortBy]?sql`${identifier(columns[query.sortBy])} ${query.sortOrder==='desc'?sql`DESC`:sql`ASC`},id ASC`:isUuid(groupId??'')?GROUP_EXAM_SORT:sql`"order",created_at DESC,id`;
    const [data,total]=await Promise.all([this.examModel.select(filter,sql`ORDER BY ${sorting} LIMIT ${limit} OFFSET ${(page-1)*limit}`),this.examModel.count(filter)]);
    const groups=await new SqlRecords(this.nativeDb,'examgroups').select(sql`id=ANY(${data.map(row=>row.groupId).filter(Boolean)}::uuid[])`);const map=new Map(groups.map(row=>[row._id,{_id:row._id,name:row.name,slug:row.slug}]));
    for(const exam of data)exam.groupId=map.get(exam.groupId)??null;
    return {
      data: await withAttemptCounts(
        this.nativeDb,
        data.map((exam) => ({
          ...exam,
          isActive: exam.isActive ?? ('status' in exam ? exam.status === 'ACTIVE' : true) })),
      ),
      total,
      page,
      limit };
  }

  async findOne(idOrSlug: string): Promise<Exam> {
    const lang = this.getLang();
    const exam=await this.examModel.one(sql`${learnerExamVisibility()} AND is_deleted IS NOT TRUE AND ${isUuid(idOrSlug)?sql`id=${idOrSlug}::uuid`:sql`slug=${idOrSlug}`}`);

    if (!exam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const legacyStatus = (exam as any).status;
    const [result] = await withAttemptCounts(this.nativeDb, [exam]);
    return {
      ...result,
      isActive:
        exam.isActive ?? (legacyStatus ? legacyStatus === 'ACTIVE' : true) } as Exam;
  }

  async update(id: string, updateExamDto: UpdateExamDto): Promise<Exam> {
    return this.ordered(() => this.updateOrdered(id, updateExamDto));
  }

  private async updateOrdered(
    id: string,
    updateExamDto: UpdateExamDto,
  ): Promise<Exam> {
    const lang = this.getLang();
    if (!isUuid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const { groupId, order, ...restDto } = updateExamDto;
    const updateData: Record<string, any> = { ...restDto };

    if (updateExamDto.name) {
      const trimmedName = updateExamDto.name.trim();
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing=await this.examModel.one(sql`lower(name)=lower(${trimmedName}) AND id<>${id}::uuid AND is_deleted IS NOT TRUE`);

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
          await this.examModel.one(sql`("id" IS DISTINCT FROM ${id}) AND ("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;
      }
    }

    if (updateExamDto.groupId !== undefined) {
      updateData.groupId =
        updateExamDto.groupId && isUuid(updateExamDto.groupId)
          ? (String(updateExamDto.groupId) as any)
          : null;
      // Moving to another group appends the exam at the end of that group.
      if (!updateData.groupId) updateData.groupOrder = 0;
      else if (
        !(await this.examModel.one(sql`("id" = ${id}) AND ("group_id" = ${updateData.groupId})`))
      )
        updateData.groupOrder = await nextGroupOrder(
          this.examModel,
          updateData.groupId,
        );
    }

    const updatedExam=await this.examModel.patch(sql`id=${id}::uuid AND is_deleted IS NOT TRUE`,updateData);

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

    const updated = await this.examModel.patch(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`,{ isActive: nextActive });

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
    if (!isUuid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const exam = await this.examModel.one(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    if (!exam) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const deletedExam = await this.examModel.patch(sql`id=${id}::uuid`,{
          isDeleted: true });

    await this.normalizeOrders();
    return deletedExam!;
  }

  async restore(id: string): Promise<Exam> {
    return this.ordered(() => this.restoreOrdered(id));
  }

  private async restoreOrdered(id: string): Promise<Exam> {
    const lang = this.getLang();
    if (!isUuid(id)) {
      throw new NotFoundException(
        await this.i18n.t('exam.EXAM_NOT_FOUND', { lang }),
      );
    }

    const restored = await this.examModel.patch(sql`("id" = ${id})`,{ isDeleted: false });

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
      const rows = await this.examModel.select(sql`("is_deleted" IS DISTINCT FROM ${true})`);
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
      for(const item of items)await this.examModel.patch(sql`id=${item.id}::uuid AND is_deleted IS NOT TRUE`,{order:item.order});
    });
  }
}
