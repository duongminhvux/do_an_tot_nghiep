import type { PgConnection } from '../../../postgres/connection.js';
import { rows,sql } from '../../../postgres/sql.js';
export async function withAttemptCounts<T extends {_id:unknown}>(db:PgConnection,exams:T[]){
  if(!exams.length)return [] as (T & {totalAttempts:number;completedAttempts:number})[];
  const counts=await rows(db,sql`SELECT exam_id,COUNT(*)::int total,COUNT(*) FILTER(WHERE status IN ('FINISHED','COMPLETED'))::int completed FROM attempts WHERE exam_id=ANY(${exams.map(exam=>String(exam._id))}::uuid[]) GROUP BY exam_id`);
  const map=new Map(counts.map(row=>[String(row.exam_id),row]));
  return exams.map(exam=>({...exam,totalAttempts:Number(map.get(String(exam._id))?.total??0),completedAttempts:Number(map.get(String(exam._id))?.completed??0)}));
}
