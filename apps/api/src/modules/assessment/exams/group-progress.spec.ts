import {beforeEach,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {ExamGroupsService} from './exam-groups.service.js';
const suite=databaseSuite('assessment');
describe('Group progress projection (isolated PostgreSQL memory)',()=>{
  let group:string,exam:string,otherExam:string,draft:string,user:string;
  beforeEach(async()=>{
    group=randomUUID();exam=randomUUID();otherExam=randomUUID();draft=randomUUID();user=randomUUID();
    await suite.db.query(`INSERT INTO examgroups(id,name,slug,is_active) VALUES($1,'Progress group','progress-group',true)`,[group]);
    await suite.db.query(`SELECT set_config('vocalearn.publication_transition','1',false)`);
    try{for(const id of [exam,otherExam,draft])await suite.db.query(`INSERT INTO exams(id,group_id,name,slug,type,is_active,publication_status) VALUES($1,$2,$3,$3,'TOEIC',true,$4)`,[id,group,id,id===draft?'DRAFT':'PUBLISHED']);}
    finally{await suite.db.query(`SELECT set_config('vocalearn.publication_transition','',false)`);}
  });
  it('finds old per-exam progress beyond 200 unrelated attempts without exposing answers or another user',async()=>{
    await suite.db.query(`INSERT INTO attempts(user_id,exam_id,status,started_at,created_at,total_questions,answers) VALUES($1,$2,'FINISHED',now()-interval '10 days',now()-interval '10 days',10,'{"q1":"A","q2":"B"}')`,[user,exam]);
    await suite.db.query(`INSERT INTO attempts(user_id,exam_id,status,started_at,total_questions) SELECT $1,$2,'ABANDONED',now(),10 FROM generate_series(1,205)`,[user,otherExam]);
    for(const [person,target]of [[randomUUID(),exam],[user,draft]])await suite.db.query(`INSERT INTO attempts(user_id,exam_id,status,started_at,total_questions) VALUES($1,$2,'FINISHED',now(),10)`,[person,target]);
    const progress=await new ExamGroupsService(suite.db).getProgress('progress-group',user);
    expect(progress).toHaveLength(1);expect(progress[0]).toMatchObject({examId:exam,status:'FINISHED',totalQuestions:10,answeredQuestions:2});
    expect(progress[0]).not.toHaveProperty('answers');expect(progress[0]).not.toHaveProperty('questionSnapshot');
  });
  it('returns the latest non-abandoned attempt and hides inactive groups/exams',async()=>{
    await suite.db.query(`INSERT INTO attempts(user_id,exam_id,status,started_at,created_at,total_questions,answers) VALUES($1,$2,'COMPLETED',now(),now()-interval '1 day',10,'{}'),($1,$2,'IN_PROGRESS',now(),now()-interval '1 hour',10,'{"q1":"A"}'),($1,$2,'ABANDONED',now(),now(),10,'{}')`,[user,exam]);
    const service=new ExamGroupsService(suite.db);
    expect((await service.getProgress(group,user))[0]).toMatchObject({status:'IN_PROGRESS',answeredQuestions:1,totalQuestions:10});
    await suite.db.query('UPDATE exams SET is_active=false WHERE id=$1',[exam]);
    expect(await service.getProgress(group,user)).toEqual([]);
    await suite.db.query('UPDATE examgroups SET is_active=false WHERE id=$1',[group]);
    await expect(service.getProgress(group,user)).rejects.toMatchObject({status:404});
  });
});
