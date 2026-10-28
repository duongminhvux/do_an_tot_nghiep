import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { serviceRole } from '../../postgres/ownership.js';
import { SqlRecords } from '../../postgres/records.js';
import { first,rows,sql } from '../../postgres/sql.js';
export type LearningSnapshot={words:any[];progress:any[];sessions:any[];reviews:any[];daily:any[];summary:Record<string,number>};
export async function readLearningSnapshot(db:PgConnection,userId:string):Promise<LearningSnapshot>{
  if(!isUuid(userId))throw new BadRequestException('Invalid user');const where=sql`user_id=${userId}::uuid`;
  const [words,progress,sessions,reviews,daily,summary]=await Promise.all([
    new SqlRecords(db,'userlessonwords').select(where,sql`ORDER BY learned_at DESC,created_at DESC,id`),
    new SqlRecords(db,'userlessonprogresses').select(where,sql`ORDER BY updated_at DESC,id`),
    new SqlRecords(db,'learningsessions').select(where,sql`ORDER BY started_at DESC,id`),
    new SqlRecords(db,'userwordreviews').select(where),new SqlRecords(db,'userdailyactivities').select(where,sql`ORDER BY date DESC,id`),
    first(db,sql`SELECT
      (SELECT COUNT(*)::integer FROM public.userlessonwords WHERE ${where}) AS learned,
      (SELECT COUNT(*)::integer FROM public.userwordreviews WHERE ${where}) AS reviewed,
      (SELECT COALESCE(SUM(review_count),0) FROM public.userwordreviews WHERE ${where}) AS "reviewCount",
      (SELECT COALESCE(SUM(study_minutes),0) FROM public.userdailyactivities WHERE ${where}) AS "dailyMinutes",
      (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at-started_at))/60),0) FROM public.learningsessions WHERE ${where} AND ended_at IS NOT NULL AND started_at IS NOT NULL) AS "sessionMinutes"`),
  ]);return {words,progress,sessions,reviews,daily,summary:summary??{}};
}
export function learningSnapshot(db:PgConnection,userId:string){return serviceRole()==='learning'?readLearningSnapshot(db,userId):ownerRequest<LearningSnapshot>('learning','learning/user-snapshot',{userId});}
export async function readLearnedCounts(db:PgConnection,ids:string[]){
  if(!Array.isArray(ids)||ids.length>2000||ids.some(id=>!isUuid(id)))throw new BadRequestException('Invalid user IDs');
  return rows(db,sql`SELECT user_id AS "_id",COUNT(*)::integer AS count FROM public.userlessonwords WHERE user_id=ANY(${ids}::uuid[]) GROUP BY user_id`);
}
export function learnedCounts(db:PgConnection,ids:string[]){return serviceRole()==='learning'?readLearnedCounts(db,ids):ownerRequest<any[]>('learning','learning/learned-counts',{ids});}
export type ActivityFeedRead={userId:string;module?:string;type?:string;disabled?:boolean;from?:string;to?:string;search?:string;matchedTypes?:string[];limit:number};
export async function readLearningFeed(db:PgConnection,input:ActivityFeedRead){
  if(!input||!isUuid(input.userId)||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>100000)throw new BadRequestException('Invalid activity feed');
  const from=input.from?new Date(input.from):null,to=input.to?new Date(input.to):null;
  const where=sql`user_id=${input.userId}::uuid AND NOT ${!!input.disabled}::boolean
    AND (${input.module??null}::text IS NULL OR module=${input.module??null}) AND (${input.type??null}::text IS NULL OR type=${input.type??null})
    AND (${from}::timestamptz IS NULL OR occurred_at>=${from}) AND (${to}::timestamptz IS NULL OR occurred_at<=${to})
    AND (${input.search||null}::text IS NULL OR title ILIKE '%'||${input.search||null}||'%' OR type ILIKE '%'||${input.search||null}||'%'
      OR metadata->>'gameType' ILIKE '%'||${input.search||null}||'%' OR type=ANY(${input.matchedTypes??[]}::text[]))`;
  const [items,count]=await Promise.all([new SqlRecords(db,'learning_activities').select(where,sql`ORDER BY occurred_at DESC,id DESC LIMIT ${input.limit}`),
    first(db,sql`SELECT COUNT(*)::integer AS count FROM public.learning_activities WHERE ${where}`)]);
  return {items,total:Number(count?.count??0)};
}
export function learningFeed(db:PgConnection,input:ActivityFeedRead){return serviceRole()==='learning'?readLearningFeed(db,input):ownerRequest<{items:any[];total:number}>('learning','learning/activity-feed',input);}
