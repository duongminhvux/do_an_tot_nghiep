import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { serviceRole } from '../../postgres/ownership.js';
import { identifier,joinSql,literal,rowData,rows,sql,type Sql } from '../../postgres/sql.js';
export type AssessmentKind = 'exams' | 'examgroups' | 'questions' | 'passages' | 'passagegroups' | 'attempts';
export type AssessmentRead = { ids?: string[]; examIds?: string[]; passageGroupIds?: string[]; groupIds?: string[];
  userId?: string; slug?: string; parts?:number[]; orderBy?:'order'; publishedOnly?: boolean; includeDeleted?: boolean; limit?: number; offset?: number };
const tables: Record<AssessmentKind, readonly string[]> = {
  exams: ['id','group_id'], examgroups: ['id'], questions: ['id','exam_id','passage_group_id'],
  passages: ['id','passage_group_id'], passagegroups: ['id','exam_id'], attempts: ['id','exam_id'],
};
export async function readAssessmentRows(db: PgConnection, kind: AssessmentKind, input: AssessmentRead) {
  if (!Object.hasOwn(tables,kind) || !input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid assessment projection');
  const conditions:Sql[]=[literal('TRUE')];
  for (const [key,column] of [['ids','id'],['examIds','exam_id'],['passageGroupIds','passage_group_id'],['groupIds','group_id']] as const) {
    const value=input[key]; if(value!==undefined){
      if(!tables[kind].includes(column)||!Array.isArray(value)||value.length>2000||value.some(id=>!isUuid(id)))throw new BadRequestException('Invalid projection IDs');
      conditions.push(sql`${identifier(column)}=ANY(${value}::uuid[])`);
    }
  }
  if(kind==='attempts') {if(!isUuid(input.userId))throw new BadRequestException('Attempt projection requires user');conditions.push(sql`user_id=${input.userId}::uuid`);}
  if(input.parts!==undefined){if(!['questions','passagegroups'].includes(kind)||!Array.isArray(input.parts)||input.parts.some(part=>!Number.isInteger(part)||part<1||part>7))throw new BadRequestException('Invalid parts');conditions.push(sql`part=ANY(${input.parts}::integer[])`);}
  if(['exams','examgroups'].includes(kind)&&!input.includeDeleted)conditions.push(literal('is_deleted IS NOT TRUE'));
  if(kind==='exams'&&input.publishedOnly)conditions.push(literal("publication_status='PUBLISHED' AND is_deleted IS NOT TRUE AND is_active IS NOT FALSE"));
  if(input.slug!==undefined){if(!['exams','examgroups'].includes(kind)||typeof input.slug!=='string')throw new BadRequestException('Invalid slug');conditions.push(sql`slug=${input.slug}`);}
  const limit=input.limit??500,offset=input.offset??0;
  if(!Number.isSafeInteger(limit)||limit<1||limit>2000||!Number.isSafeInteger(offset)||offset<0)throw new BadRequestException('Invalid projection page');
  const order=input.orderBy==='order'&&['questions','passages','passagegroups','exams','examgroups'].includes(kind)?literal('"order" NULLS LAST,id'):literal('id');
  return (await rows(db,sql`SELECT * FROM public.${identifier(kind)} WHERE ${joinSql(conditions,' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`)).map(row=>rowData<any>(row));
}
export function assessmentRows(db:PgConnection,kind:AssessmentKind,input:AssessmentRead){
  return serviceRole()==='assessment'?readAssessmentRows(db,kind,input):ownerRequest<any[]>('assessment',`assessment/${kind}`,input);
}
