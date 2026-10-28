/** End-to-end service queries executed by PostgreSQL, with owner HTTP reads dispatched locally. */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {nativePostgres,source}=require('./helpers/native-postgres.cjs');
const {SqlRecords}=source('postgres/records.ts'),{rows,sql}=source('postgres/sql.ts');
const {DomainOutboxService}=source('common/events/domain-outbox.service.ts');
const {readContentRows,readWordSample}=source('modules/vocabulary/content-reader.ts');
const {readLearningSnapshot,readLearnedCounts,readLearningFeed}=source('modules/learning/learning-reader.ts');
const {readAssessmentRows}=source('modules/assessment/assessment-reader.ts');
const {ExamsService}=source('modules/assessment/exams/exams.service.ts');
const {ExamGroupsService}=source('modules/assessment/exams/exam-groups.service.ts');
const {QuestionsService}=source('modules/assessment/questions/questions.service.ts');
const {AttemptsService}=source('modules/assessment/attempts/attempts.service.ts');
const {DictationService}=source('modules/dictation/dictation.service.ts');
const {SavedWordsService}=source('modules/learning/saved-words/saved-words.service.ts');
const {ReviewsService}=source('modules/learning/reviews/reviews.service.ts');
const {ProgressService}=source('modules/learning/progress/progress.service.ts');
const {SessionsService}=source('modules/learning/sessions/sessions.service.ts');
const {LearningActivityService}=source('modules/learning-activity/learning-activity.service.ts');
const {MiniGameResultService}=source('modules/minigame/services/minigame-result.service.ts');
const {MiniGameType}=source('modules/minigame/minigame.types.ts');
const {UsersService}=source('modules/users/users.service.ts');
const {ActivityLogsService}=source('modules/activity-logs/activity-logs.service.ts');
const {ArenaReadService}=source('modules/arena/arena-read.service.ts');
const {ArenaService}=source('modules/arena/arena.service.ts');
const {ArenaRoomService}=source('modules/arena/rooms/arena-room.service.ts');
const {ArenaSettingsService}=source('modules/arena/admin/arena-settings.service.ts');

(async()=>{
 const databases={};for(const domain of ['identity','content','assessment','learning','arena','notification','media-jobs'])databases[domain]=await nativePostgres([domain]);
 const test={close:()=>Promise.all(Object.values(databases).map(db=>db.close()))};
 let db=databases.identity.connection;
 const record=table=>new SqlRecords(db,table),i18n={t:async key=>key,translate:async key=>key},originalFetch=global.fetch,oldRole=process.env.SERVICE_ROLE;
 let outbox=new DomainOutboxService(db);const user=randomUUID(),other=randomUUID();
 const role=owner=>{process.env.SERVICE_ROLE=owner;db=databases[owner].connection;outbox=new DomainOutboxService(db);};
 process.env.INTERNAL_SERVICE_TOKEN='native-postgres-tests-internal-token';
 // Private service owner APIs receive typed requests; no document predicates cross this boundary.
 global.fetch=async(url,options={})=>{
   const pathname=new URL(url).pathname.replace(/^.*\/_internal\//,''),input=JSON.parse(options.body||'{}');let data;
   if(pathname==='content/sample-words')data=await readWordSample(databases.content.connection,input);
   else if(pathname.startsWith('content/'))data=await readContentRows(databases.content.connection,pathname.split('/')[1],input);
   else if(pathname==='learning/user-snapshot')data=await readLearningSnapshot(databases.learning.connection,input.userId);
   else if(pathname==='learning/learned-counts')data=await readLearnedCounts(databases.learning.connection,input.ids);
   else if(pathname==='learning/activity-feed')data=await readLearningFeed(databases.learning.connection,input);
   else if(pathname.startsWith('assessment/'))data=await readAssessmentRows(databases.assessment.connection,pathname.split('/')[1],input);
   else if(pathname==='mistakes/vocabulary-titles'){const words=await readContentRows(databases.content.connection,'words',{ids:input.wordIds,publishedOnly:true});data=Object.fromEntries(words.map(w=>[w._id,w.word]));}
   else throw Error('Unexpected owner request '+pathname);
   return {ok:true,json:async()=>({data})};
 };
 try{
   role('identity');
   const users=new UsersService(db,i18n,outbox);
   const created=await users.create({_id:user,email:'native@example.test',username:'Native',password:'a-secure-test-password',isVerified:true});
   const userId=String(created._id);
   assert.equal((await users.findByEmail('native@example.test'))._id,userId);
   await rows(db,sql`INSERT INTO identity_profiles(id,username) VALUES(${userId}::uuid,'Native'),(${other}::uuid,'Other')`);
   await users.update(userId,{username:'Changed'});assert.equal((await users.findById(userId)).username,'Changed');
   assert.equal((await rows(db,sql`SELECT COUNT(*)::int count FROM outbox_events WHERE aggregate_id=${userId}::uuid`))[0].count,2);

   role('content');
   const word=await record('words').insert({word:'apple',slug:'apple',level:'A1',isActive:true,parts:[{partOfSpeech:'noun',meanings:[{definition:'A fruit',translation:['qua tao']}]}]});
   const lesson=await record('lessons').insert({title:'Vocabulary',slug:'vocabulary',collectionId:randomUUID()});
   const lw=await record('lessonwords').insert({lessonId:lesson._id,wordId:word._id});
   // Publication is controlled by PostgreSQL's explicit publisher transaction.
   await db.query('BEGIN');await db.query("SET LOCAL vocalearn.publication_transition='1'");
   await rows(db,sql`UPDATE words SET publication_status='PUBLISHED' WHERE id=${word._id}::uuid`);
   await rows(db,sql`UPDATE lessons SET publication_status='PUBLISHED' WHERE id=${lesson._id}::uuid`);await db.query('COMMIT');

   const dictation=new DictationService(db,{}, {},{deleteFile:async()=>{}},{delete:async()=>{}},{get:()=>undefined},undefined,outbox);
   const topic=await dictation.createTopic({title:'Native topic'}),section=await dictation.createSection({topicId:topic._id,title:'Native section'});
   const dl=await dictation.create({title:'Native dictation',sourceText:'An apple.',topicId:topic._id,sectionId:section._id,level:'A1'});
   await record('dictationsegments').insert({lessonId:dl._id,order:0,text:'An apple.',source:'TTS',language:'en-US',startMs:0,endMs:1000,durationMs:1000});
   await db.query('BEGIN');await db.query("SET LOCAL vocalearn.publication_transition='1'");await rows(db,sql`UPDATE dictationlessons SET status='PUBLISHED',publication_status='PUBLISHED' WHERE id=${dl._id}::uuid`);await db.query('COMMIT');
   await dictation.recordReplay(userId,dl._id,0);await dictation.recordAttempt(userId,dl._id,0,true);await dictation.recordAttempt(userId,dl._id,0,true);
   const dp=await dictation.getProgress(userId,dl._id);assert.equal(dp.completed,true);assert.equal(dp.correctCount,1);assert.equal(dp.segmentProgress[0].replayCount,1);
   assert.equal((await dictation.progressOverview(userId)).totalStarted,1);
   assert.equal((await dictation.getAdminHierarchy())[0].sections[0].lessonCount,1);

   role('learning');
   const saved=new SavedWordsService(db),folder=await saved.createFolder(userId,{name:'Fruit'});
   const savedWord=await saved.saveWord(userId,{wordId:word._id,folderId:folder._id,note:'keep'});
   await saved.saveWord(userId,{wordId:word._id});assert.equal((await saved.findAll(userId,{})).data[0].note,'keep');
   await assert.rejects(saved.searchWords(other,folder._id,'apple'));
   await saved.deleteFolder(userId,folder._id);assert.equal((await record('usersavedwords').one(sql`id=${savedWord._id}::uuid`)).folderId,null);
   const activity=new LearningActivityService(db),notifications={log:async()=>{},reportError:()=>{}};
   const sessions=new SessionsService(db,i18n,notifications,activity);
   const session=await sessions.create(userId,{lessonId:lesson._id});
   await sessions.recordAction(userId,{sessionId:session._id,wordId:word._id,lessonWordId:lw._id,mode:'FLASHCARD',rating:'GOOD',isCorrect:true});
   const ended=await sessions.complete(userId,session._id);await sessions.complete(userId,session._id);assert.ok(ended.endedAt);
   const progress=new ProgressService(db);assert.equal((await progress.getLessonProgress(userId,lesson._id)).totalWords,1);await progress.getOverview(userId);await progress.getDashboardStats(userId);await progress.getActivity(userId);await progress.getTodayTasks(userId);await progress.getRecentActivities(userId);
   const mini=new MiniGameResultService(db,activity),game=Object.values(MiniGameType)[0];await mini.save(userId,{gameType:game,score:45});assert.equal((await mini.stats(userId,game)).bestScore,45);

   role('assessment');
   const exams=new ExamsService(db,i18n,outbox),groups=new ExamGroupsService(db),questions=new QuestionsService(db,{isManagedUrl:()=>false},{delete:async()=>{}});
   const eg=await groups.create({name:'SQL tests'}),exam=await exams.create({name:'Native exam',type:'TOEIC',groupId:eg._id});
   const q=await questions.create({examId:exam._id,section:'READING',part:5,content:'Choose A',options:[{key:'A',text:'Correct'},{key:'B',text:'Wrong'}],correctAnswer:'A'});
   await exams.findAll({});await groups.findAll({});assert.equal((await questions.findByExam(exam._id)).length,1);
   await db.query('BEGIN');await db.query("SET LOCAL vocalearn.publication_transition='1'");await rows(db,sql`UPDATE exams SET publication_status='PUBLISHED' WHERE id=${exam._id}::uuid`);await db.query('COMMIT');
   const attempts=new AttemptsService(db,undefined,outbox);assert.equal((await attempts.availableParts(exam._id))[0].totalQuestions,1);
   const attempt=await attempts.create(userId,{examId:exam._id,mode:'TEST',selectedParts:[5]});
   await attempts.saveAnswer(userId,attempt._id,{questionId:q._id,answer:'A'});await attempts.submit(userId,attempt._id);await attempts.submit(userId,attempt._id);
   const result=await attempts.findOne(userId,attempt._id);assert.equal(result.correctAnswers,1);assert.equal(result.accuracy,100);
   assert.equal((await rows(db,sql`SELECT COUNT(*)::int count FROM outbox_events WHERE payload->>'sourceKey'=${'toeic:'+attempt._id}`))[0].count,1);
   await assert.rejects(attempts.saveAnswer(userId,attempt._id,{questionId:q._id,answer:'B'}));await assert.rejects(attempts.findOne(other,attempt._id));
   assert.equal((await attempts.stats(userId)).totalCompleted,1);assert.equal((await attempts.adminList()).total,1);await attempts.adminFindOne(attempt._id);
   const practice=await attempts.create(userId,{examId:exam._id,mode:'PRACTICE',selectedParts:[5]});await attempts.saveAnswer(userId,practice._id,{questionId:q._id,answer:'B'});await attempts.checkAnswer(userId,practice._id,q._id);await assert.rejects(attempts.saveAnswer(userId,practice._id,{questionId:q._id,answer:'A'}));

   role('arena');
   await rows(db,sql`INSERT INTO identity_profiles(id,username) VALUES(${userId}::uuid,'Native'),(${other}::uuid,'Other')`);
   const read=new ArenaReadService(db),arena=new ArenaService(read,db);await arena.getOrCreateProfile(userId);await arena.getMyArenaOverview(userId);await read.getRecentMatches(userId,10);await read.getRankedStatistics(userId);
   const settings=new ArenaSettingsService(db);await settings.onModuleInit();const current=await settings.read();await settings.update({revision:current.revision,config:current.config});await assert.rejects(settings.update({revision:current.revision,config:current.config}));
   const rooms=new ArenaRoomService(db);const room=await rooms.createRoom(userId,{name:'SQL room',maxPlayers:3});await rooms.joinRoom(room.code,other);await assert.rejects(rooms.joinRoom(room.code,other));

   role('notification');
   const logs=new ActivityLogsService(db,i18n);await logs.log({userId,action:'LOGIN',category:'AUTH'});await logs.findAll({});await logs.getStats({});
   console.log('PASS: native Identity, Dictation, Learning, Saved words, Assessment, Arena, Activity SQL flows');
 }finally{global.fetch=originalFetch;if(oldRole===undefined)delete process.env.SERVICE_ROLE;else process.env.SERVICE_ROLE=oldRole;await test.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
