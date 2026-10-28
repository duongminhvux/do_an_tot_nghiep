import type { PgConnection } from '../../../postgres/connection.js';
import { first,rows,sql,type Sql } from '../../../postgres/sql.js';

const source=(where:Sql)=>sql`WITH source AS (
  SELECT *,status IN ('FINISHED','COMPLETED') AS done,
    COALESCE(correct_answers,total_correct,0)::float8 AS correct,
    CASE WHEN total_questions>0 THEN COALESCE(correct_answers,total_correct,0)*100.0/total_questions ELSE 0 END AS raw_accuracy
  FROM attempts WHERE ${where})`;

export async function attemptOverview(db:PgConnection,where:Sql){
  return first(db,sql`${source(where)} SELECT COUNT(*)::int "totalAttempts",COUNT(*) FILTER(WHERE done)::int "totalCompleted",
    COUNT(*) FILTER(WHERE status='IN_PROGRESS')::int "inProgress",COUNT(*) FILTER(WHERE mode='TEST')::int "testAttempts",
    COUNT(*) FILTER(WHERE mode='PRACTICE')::int "practiceAttempts",
    COALESCE(SUM(total_questions) FILTER(WHERE done),0)::float8 "totalQuestions",
    COALESCE(SUM(answered_questions) FILTER(WHERE done),0)::float8 "totalAnswered",
    COALESCE(SUM(correct) FILTER(WHERE done),0)::float8 "totalCorrect",
    COALESCE(SUM(duration_spent) FILTER(WHERE done),0)::float8 "totalDuration",
    AVG(raw_accuracy) FILTER(WHERE done)::float8 "avgAccuracy" FROM source`);
}
export async function attemptStatistics(db:PgConnection,where:Sql,timezone:string){
  const [overview,parts,timeline,distribution]=await Promise.all([
    attemptOverview(db,where),
    rows(db,sql`${source(where)} SELECT (p->>'part')::int "_id",COUNT(*)::int attempts,
      SUM((p->>'total')::float8)::float8 total,SUM((p->>'answered')::float8)::float8 answered,SUM((p->>'correct')::float8)::float8 correct
      FROM source CROSS JOIN LATERAL jsonb_array_elements(COALESCE(part_results,'[]')) p WHERE done GROUP BY 1 ORDER BY 1`),
    rows(db,sql`${source(where)} SELECT to_char(created_at AT TIME ZONE ${timezone},'YYYY-MM-DD') "_id",COUNT(*)::int attempts,
      COUNT(*) FILTER(WHERE done)::int completed,COALESCE(SUM(duration_spent) FILTER(WHERE done),0)::float8 duration,
      AVG(raw_accuracy) FILTER(WHERE done)::float8 accuracy,
      AVG((listening_result->>'accuracy')::float8) FILTER(WHERE done AND (listening_result->>'total')::float8>0)::float8 "listeningAccuracy",
      AVG((reading_result->>'accuracy')::float8) FILTER(WHERE done AND (reading_result->>'total')::float8>0)::float8 "readingAccuracy"
      FROM source GROUP BY 1 ORDER BY 1`),
    rows(db,sql`${source(where)} SELECT CASE WHEN raw_accuracy>=90 THEN 'excellent' WHEN raw_accuracy>=75 THEN 'good' WHEN raw_accuracy>=60 THEN 'fair' WHEN raw_accuracy>=45 THEN 'average' ELSE 'low' END "_id",COUNT(*)::int count FROM source WHERE done GROUP BY 1`),
  ]);
  return [{overview:[overview],parts,timeline,distribution}];
}
