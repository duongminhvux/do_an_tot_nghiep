import {learnerExamVisibility} from './exam-visibility.js';
import { InjectPgConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { SqlRecords,newSqlRow } from '../../../postgres/records.js';
import { rows,sql } from '../../../postgres/sql.js';

import {
BadRequestException,
ConflictException,
Injectable,
NotFoundException
} from '@nestjs/common';


import { withAttemptCounts } from '../attempts/exam-attempt-counts.js';
import { CreateExamGroupDto } from './dto/create-exam-group.dto.js';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto.js';
import { GROUP_EXAM_SORT,nextGroupOrder } from './group-order.js';
import { ExamGroup } from './rows/exam-group.row.js';

@Injectable()
export class ExamGroupsService {
  private async withGroupAttemptCounts<T extends { _id: unknown }>(
    groups: T[],
  ) {
    if (!groups.length) return groups;
    const exams = await this.examModel.select(sql`${learnerExamVisibility()} AND ("group_id"=ANY(${groups.map((group) => String(String(group._id)))}::uuid[])) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    const counted = await withAttemptCounts(this.nativeDb, exams);
    return groups.map((group) => ({
      ...group,
      totalAttempts: counted
        .filter((exam) => String(exam.groupId) === String(group._id))
        .reduce((sum, exam) => sum + exam.totalAttempts, 0) }));
  }
  private get examGroupModel(){return new SqlRecords(this.nativeDb,'examgroups');}
private get examModel(){return new SqlRecords(this.nativeDb,'exams');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,
  ) {}
  /** One safe summary per exam, independent of the size of a learner's history. */
  async getProgress(idOrSlug:string,userId:string){
    const group=await this.examGroupModel.one(sql`is_deleted IS NOT TRUE AND is_active IS NOT FALSE AND ${isUuid(idOrSlug)?sql`id=${idOrSlug}::uuid`:sql`slug=${idOrSlug}`}`);
    if(!group)throw new NotFoundException('Exam group not found');
    return rows(this.nativeDb,sql`SELECT DISTINCT ON (a.exam_id)
      a.id AS "_id",a.exam_id AS "examId",a.status,a.total_questions AS "totalQuestions",
      COALESCE(a.correct_answers,a.total_correct,0) AS "correctAnswers",
      CASE WHEN jsonb_typeof(a.answers)='object' THEN (SELECT count(*)::int FROM jsonb_object_keys(a.answers)) ELSE COALESCE(a.answered_questions,0) END AS "answeredQuestions"
      FROM public.attempts a JOIN public.exams e ON e.id=a.exam_id
      WHERE e.group_id=${group._id}::uuid AND e.type='TOEIC' AND e.is_deleted IS NOT TRUE AND e.is_active IS NOT FALSE AND e.publication_status='PUBLISHED'
        AND a.user_id=${userId}::uuid AND a.status IN ('IN_PROGRESS','FINISHED','COMPLETED')
      ORDER BY a.exam_id,a.created_at DESC,a.id DESC`);
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

  async create(dto: CreateExamGroupDto): Promise<ExamGroup> {
    const trimmedName = dto.name.trim();
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const existing=await this.examGroupModel.one(sql`lower(name)=lower(${trimmedName}) AND is_deleted IS NOT TRUE`);

    if (existing) {
      throw new ConflictException('Exam group with this name already exists');
    }

    const rawSlug = dto.slug?.trim() || trimmedName;
    const baseSlug = this.generateSlug(rawSlug) || 'exam-group';
    let slug = baseSlug;
    let counter = 1;
    while (
      await this.examGroupModel.one(sql`("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = dto.order;
    if (order === undefined || order === null || order < 0) {
      const count = await this.examGroupModel.count(sql`("is_deleted" IS DISTINCT FROM ${true})`);
      order = count + 1;
    }

    const created = newSqlRow('examgroups',{
      ...dto,
      name: trimmedName,
      slug,
      order,
      isActive: dto.isActive ?? true,
      isDeleted: false });

    return this.examGroupModel.insert(created);
  }

  async findAll(
    query: QueryExamGroupDto,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const { search, q, isActive, page = 1, limit = 20 } = query;
    const term=q||search||'';
    const filter=sql`is_deleted IS NOT TRUE AND (${term}='' OR position(lower(${term}) in lower(name||' '||COALESCE(slug,'')||' '||COALESCE(description,'')))>0) AND (${isActive??null}::boolean IS NULL OR is_active=${isActive??null}::boolean)`;
    const [data,total]=await Promise.all([this.examGroupModel.select(filter,sql`ORDER BY "order",created_at DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`),this.examGroupModel.count(filter)]);
    const counts=await rows(this.nativeDb,sql`SELECT group_id,COUNT(*)::int count FROM exams WHERE ${learnerExamVisibility()} AND group_id=ANY(${data.map(row=>row._id)}::uuid[]) AND is_deleted IS NOT TRUE GROUP BY group_id`);const map=new Map(counts.map(row=>[row.group_id,row.count]));for(const group of data)group.examCount=map.get(group._id)??0;
    return {
      data: await this.withGroupAttemptCounts(data),
      total,
      page,
      limit };
  }

  async findOne(idOrSlug: string): Promise<any> {
    const group=await this.examGroupModel.one(sql`is_deleted IS NOT TRUE AND ${isUuid(idOrSlug)?sql`id=${idOrSlug}::uuid`:sql`slug=${idOrSlug}`}`);
    if (!group) {
      throw new NotFoundException('Exam group not found');
    }

    const examCount = await this.examModel.count(sql`${learnerExamVisibility()} AND ("group_id" = ${group._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);

    const [countedGroup] = await this.withGroupAttemptCounts([group]);
    return {
      ...countedGroup,
      examCount };
  }

  async update(id: string, dto: UpdateExamGroupDto): Promise<ExamGroup> {
    if (!isUuid(id)) {
      throw new NotFoundException('Exam group not found');
    }

    const currentGroup = await this.examGroupModel.one(sql`("id" = ${String(id)}) AND ("is_deleted" IS DISTINCT FROM ${true})`);

    if (!currentGroup) {
      throw new NotFoundException('Exam group not found');
    }

    const updateData: Partial<ExamGroup> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== currentGroup.name.toLowerCase()) {
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing=await this.examGroupModel.one(sql`id<>${id}::uuid AND lower(name)=lower(${trimmedName}) AND is_deleted IS NOT TRUE`);

        if (existing) {
          throw new ConflictException(
            'Exam group with this name already exists',
          );
        }
      }
      updateData.name = trimmedName;

      if (dto.slug) {
        const rawSlug = dto.slug.trim();
        const baseSlug = this.generateSlug(rawSlug) || 'exam-group';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.examGroupModel.one(sql`("id" IS DISTINCT FROM ${String(id)}) AND ("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;
      } else if (
        trimmedName.toLowerCase() !== currentGroup.name.toLowerCase()
      ) {
        const baseSlug = this.generateSlug(trimmedName) || 'exam-group';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.examGroupModel.one(sql`("id" IS DISTINCT FROM ${String(id)}) AND ("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)
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
        await this.examGroupModel.one(sql`("id" IS DISTINCT FROM ${String(id)}) AND ("slug" = ${slug}) AND ("is_deleted" IS DISTINCT FROM ${true})`)
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

    const updated = await this.examGroupModel.patch(sql`("id" = ${String(id)}) AND ("is_deleted" IS DISTINCT FROM ${true})`,updateData);

    if (!updated) {
      throw new NotFoundException('Exam group not found');
    }

    return updated;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<ExamGroup> {
    const group = await this.findOne(id);
    const nextActive = isActive ?? !group.isActive;

    const updated = await this.examGroupModel.patch(sql`id=${id}::uuid`,{ isActive: nextActive });

    if (!updated) {
      throw new NotFoundException('Exam group not found');
    }

    return updated;
  }

  async remove(id: string): Promise<ExamGroup> {
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended('assessment-exam-order',0))`);

    if (!isUuid(id)) {
      throw new NotFoundException('Exam group not found');
    }

    const group = await this.examGroupModel.patch(sql`("id" = ${id}) AND ("is_deleted" IS DISTINCT FROM ${true})`,{ isDeleted: true });

    if (!group) {
      throw new NotFoundException('Exam group not found');
    }

    // Unset groupId from associated exams
    await this.examModel.patch(sql`("group_id" = ${String(id)})`,{ groupId: null, groupOrder: 0 });

    return group;
  
    });
  }

  async getExams(groupIdOrSlug: string, query?: any): Promise<any[]> {
    let groupPgId: string;
    if (isUuid(groupIdOrSlug)) {
      groupPgId = String(groupIdOrSlug);
    } else {
      const group = await this.examGroupModel.one(sql`("slug" = ${groupIdOrSlug}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
      if (!group) {
        throw new NotFoundException('Exam group not found');
      }
      groupPgId = group._id as string;
    }

    const exams=await this.examModel.select(sql`${learnerExamVisibility()} AND group_id=${groupPgId}::uuid AND is_deleted IS NOT TRUE`,sql`ORDER BY ${GROUP_EXAM_SORT}`);
    return withAttemptCounts(this.nativeDb, exams);
  }

  async addExams(
    groupId: string,
    examIds: string[],
  ): Promise<{ updatedCount: number }> {
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended('assessment-exam-order',0))`);

    await this.findOne(groupId);
    if (!examIds || !examIds.length) {
      return { updatedCount: 0 };
    }

    const uuids = examIds
      .filter((id) => isUuid(id))
      .map((id) => String(id));

    const group = String(groupId);
    // Newly added exams go to the end of the group, in the order given.
    const incoming = await this.examModel.select(sql`${learnerExamVisibility()} AND ("id"=ANY(${uuids}::uuid[])) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("group_id" IS DISTINCT FROM ${group})`);
    const ids = uuids.filter((id) =>
      incoming.some((exam) => String(exam._id) === String(id)),
    );
    if (!ids.length) return { updatedCount: 0 };
    const start = await nextGroupOrder(this.examModel, group);
    let updatedCount=0;for(const [index,id]of ids.entries()){const row=await this.examModel.patch(sql`id=${id}::uuid`,{groupId:group,groupOrder:start+index});if(row)updatedCount++;}return {updatedCount};
  
    });
  }

  async reorderExams(groupId: string, examIds: string[]) {
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended('assessment-exam-order',0))`);

    const group = await this.findOne(groupId);
    const current = await this.examModel.select(sql`${learnerExamVisibility()} AND ("group_id" = ${group._id}) AND ("is_deleted" IS DISTINCT FROM ${true})`);
    const currentIds = new Set(current.map((exam) => String(exam._id)));
    if (
      examIds.length !== currentIds.size ||
      new Set(examIds).size !== examIds.length ||
      examIds.some((id) => !currentIds.has(id))
    )
      throw new BadRequestException(
        'examIds must list every exam of the group exactly once',
      );
    for(const [index,id]of examIds.entries())await this.examModel.patch(sql`id=${id}::uuid AND group_id=${group._id}::uuid`,{groupOrder:index+1});
    return this.getExams(groupId);
  
    });
  }

  async removeExam(
    groupId: string,
    examId: string,
  ): Promise<{ success: boolean }> {
    return withPgTransaction(this.nativeDb,async()=>{await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended('assessment-exam-order',0))`);

    await this.findOne(groupId);
    if (!isUuid(examId)) {
      throw new NotFoundException('Exam not found');
    }

    await this.examModel.patch(sql`("id" = ${String(examId)}) AND ("group_id" = ${String(groupId)})`,{ groupId: null, groupOrder: 0 });

    return { success: true };
  
    });
  }
}
