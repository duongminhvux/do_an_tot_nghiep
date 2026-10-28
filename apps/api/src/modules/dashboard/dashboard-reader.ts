import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { serviceRole } from '../../postgres/ownership.js';
import { SqlRecords } from '../../postgres/records.js';
import { first,rows,sql } from '../../postgres/sql.js';
export type DashboardPeriod={start:string;end:string;previousStart:string};
export async function readDashboard(db:PgConnection,owner:string,input:DashboardPeriod):Promise<Record<string,any>>{
  const start=new Date(input?.start),end=new Date(input?.end),previous=new Date(input?.previousStart);
  if(![start,end,previous].every(date=>Number.isFinite(+date))||+start<+previous||+end<+start||+end-+previous>183*86400000)throw new BadRequestException('Invalid dashboard period');
  if(owner==='identity'){
    const [counts,userTimeline,newUsers]=await Promise.all([
      first(db,sql`SELECT COUNT(*)::int "totalUsers",COUNT(*) FILTER(WHERE created_at<${start})::int "previousUsers" FROM users WHERE is_deleted IS NOT TRUE`),
      rows(db,sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') "_id",COUNT(*)::int count FROM users WHERE is_deleted IS NOT TRUE AND created_at>=${start} AND created_at<${end} GROUP BY 1 ORDER BY 1`),
      rows(db,sql`SELECT id AS "_id",username,email,created_at AS "createdAt" FROM users WHERE is_deleted IS NOT TRUE ORDER BY created_at DESC,id LIMIT 5`),
    ]);return {...counts,userTimeline,newUsers};
  }
  if(owner==='assessment'){
    const [exams,attempts,scoreResult,previousScoreResult,attemptTimeline,examTypes,popularExams]=await Promise.all([
      first(db,sql`SELECT COUNT(*)::int "totalExams",COUNT(*) FILTER(WHERE is_active IS TRUE)::int "activeExams" FROM exams WHERE is_deleted IS NOT TRUE AND type='TOEIC'`),
      first(db,sql`SELECT COUNT(*) FILTER(WHERE created_at>=${start} AND created_at<${end})::int "totalAttempts",COUNT(*) FILTER(WHERE created_at>=${previous} AND created_at<${start})::int "previousAttempts" FROM attempts WHERE status IN ('FINISHED','COMPLETED')`),
      rows(db,sql`SELECT AVG(score)::float8 value FROM attempts WHERE created_at>=${start} AND created_at<${end} AND status IN ('FINISHED','COMPLETED')`),
      rows(db,sql`SELECT AVG(score)::float8 value FROM attempts WHERE created_at>=${previous} AND created_at<${start} AND status IN ('FINISHED','COMPLETED')`),
      rows(db,sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') "_id",COUNT(*)::int count FROM attempts WHERE created_at>=${start} AND created_at<${end} AND status IN ('FINISHED','COMPLETED') GROUP BY 1 ORDER BY 1`),
      rows(db,sql`SELECT type "_id",COUNT(*)::int count FROM exams WHERE is_deleted IS NOT TRUE GROUP BY type ORDER BY count DESC`),
      rows(db,sql`SELECT e.id,e.name,COUNT(*)::int attempts FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.status IN ('FINISHED','COMPLETED') AND e.type='TOEIC' AND e.is_deleted IS NOT TRUE GROUP BY e.id,e.name ORDER BY attempts DESC,e.id LIMIT 5`),
    ]);return {...exams,...attempts,scoreResult,previousScoreResult,attemptTimeline,examTypes,popularExams};
  }
  if(owner==='notification')return {recentActivity:await new SqlRecords(db,'activitylogs').select(sql`TRUE`,sql`ORDER BY created_at DESC,id LIMIT 5`)};
  throw new BadRequestException('Unknown dashboard owner');
}
export function dashboardData(db:PgConnection,owner:'identity'|'assessment'|'notification',input:DashboardPeriod){
  return serviceRole()===owner?readDashboard(db,owner,input):ownerRequest<Record<string,any>>(owner,`dashboard/${owner}`,input);
}
