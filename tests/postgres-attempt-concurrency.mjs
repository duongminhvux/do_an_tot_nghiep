/** Real concurrent connections; cleanup deletes only the fixture IDs created below. */
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
require('reflect-metadata');
const {Pool}=require('pg');
const {makePgModel}=await import('../apps/api/dist/postgres/compat.js');
const {AttemptsService}=await import('../apps/api/dist/modules/assessment/attempts/attempts.service.js');
assert.equal(process.env.SERVICE_ROLE,'assessment');
const pool=new Pool({max:6}),exams=makePgModel('Exam',pool),questions=makePgModel('Question',pool),attempts=makePgModel('Attempt',pool);
const service=new AttemptsService(attempts,exams,questions,makePgModel('Passage',pool));
const examId=randomUUID(),userId=randomUUID(),questionIds=[randomUUID(),randomUUID()],attemptIds=[];
try {
  await exams.create({_id:examId,name:`concurrency-${examId}`,slug:`concurrency-${examId}`,type:'TOEIC',isActive:true});
  for(const id of questionIds)await questions.create({_id:id,examId,section:'READING',part:5,content:'Concurrent fixture',options:[{key:'A',text:'First'},{key:'B',text:'Second'}],correctAnswer:'A',isActive:true});
  const fresh=async()=>{const created=await service.create(userId,{examId,mode:'TEST',selectedParts:[5]});attemptIds.push(created._id);return created._id;};
  const id=await fresh();
  await Promise.all(questionIds.map(questionId=>service.saveAnswer(userId,id,{questionId,answer:'A'})));
  assert.equal(Object.keys((await service.findOne(userId,id)).answers).length,2,'Concurrent answers must both persist');
  const submitted=await service.submit(userId,id);
  assert.equal(submitted.correctAnswers,2);
  const duplicateId=await fresh();
  const duplicates=await Promise.allSettled(['A','B'].map(answer=>service.saveAnswer(userId,duplicateId,{questionId:questionIds[0],answer})));
  assert.equal(duplicates.filter(result=>result.status==='fulfilled').length,1,'Only one first answer may win');
  assert.match(duplicates.find(result=>result.status==='rejected').reason.message,/already been answered/);
  const raceId=await fresh();
  await Promise.allSettled([service.saveAnswer(userId,raceId,{questionId:questionIds[0],answer:'A'}),service.submit(userId,raceId)]);
  const final=await service.findOne(userId,raceId);
  assert.equal(final.status,'FINISHED');
  assert.equal(final.correctAnswers,Object.keys(final.answers).length,'Grading must include exactly the answers that won before submission');
  console.log('PostgreSQL concurrency: answers preserved, duplicate answer refused, submission race consistent');
} finally {
  await pool.query('DELETE FROM attempts WHERE id=ANY($1::uuid[])',[attemptIds]);
  await pool.query('DELETE FROM questions WHERE id=ANY($1::uuid[])',[questionIds]);
  await pool.query('DELETE FROM exams WHERE id=$1',[examId]);
  await pool.end();
}
