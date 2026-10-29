/** Run inside each owner container after API build. All fixtures roll back. */
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const requireApi = createRequire('/app/apps/api/package.json');
const { Pool } = requireApi('pg');
(async () => {
  const { MediaLibraryService, mediaUrl, addMedia } = await import('/app/apps/api/dist/modules/media-library/media-library.service.js');
  const pool = new Pool();
  const client = await pool.connect();
  const role = process.env.SERVICE_ROLE;
  let checks = 0;
  const check = (name, callback) => Promise.resolve().then(callback).then(() => { checks++; console.log('PASS '+role+' '+name); });
  await client.query('BEGIN');
  try {
    const service = new MediaLibraryService({ query: (...args) => client.query(...args) });
    const id = () => randomUUID();
    const insert = async (table, data) => {
      const keys = Object.keys(data);
      await client.query(`INSERT INTO ${table} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(data));
      return data.id;
    };
    await check('safe URL schemes and deduplicated references', () => {
      for(const value of ['javascript:alert(1)','data:image/svg+xml,x','//evil.test/x','/\\evil.test/x','https://user:secret@example.com/x']) assert.equal(mediaUrl(value),null);
      assert.equal(mediaUrl('/media/test.wav'),'/media/test.wav');
      const assets=[];
      addMedia(assets,'/media/a.wav','audio','first','one','one');
      addMedia(assets,'/media/a.wav','audio','second','two','two');
      assert.equal(assets.length,1);assert.equal(assets[0].usages.length,2);
    });
    const category=role==='content'?'vocab':role==='assessment'?'toeic':'games';
    const wrong=role==='content'?'toeic':'dictation';
    await check('owner boundary rejects another service category',()=>assert.rejects(service.list(wrong,{page:1,pageSize:10}),/Forbidden/));
    await check('unsupported resource kind is rejected',()=>assert.rejects(service.detail(category,id(),'unsupported'),/Unsupported/));
    if(role==='content') {
      const collection=await insert('collections',{id:id(),name:'QA '+id(),slug:id(),is_active:true});
      const lesson=await insert('lessons',{id:id(),collection_id:collection,title:'QA media scoped lesson',slug:id(),cover_url:'/media/cover.png',is_active:true});
      const otherLesson=await insert('lessons',{id:id(),collection_id:collection,title:'QA other lesson',slug:id(),is_active:true});
      const word=await insert('words',{id:id(),word:'QA-'+id(),slug:id(),level:'A1',image:'/media/word.png',audio:JSON.stringify({us:'/media/shared.wav',uk:(process.env.MEDIA_PUBLIC_BASE_URL||'http://localhost:5000/media')+'/shared.wav'}),is_active:true});
      const outside=await insert('words',{id:id(),word:'QA-'+id(),slug:id(),level:'A1',image:'/media/outside.png',is_active:true});
      const deleted=await insert('words',{id:id(),word:'QA-'+id(),slug:id(),level:'A1',image:'/media/deleted.png',is_deleted:true});
      for(const [l,w] of [[lesson,word],[otherLesson,outside],[lesson,deleted]])await insert('lessonwords',{id:id(),lesson_id:l,word_id:w});
      await check('lesson media is scoped, deleted words excluded, US/UK deduplicated',async()=>{
        const result=await service.detail('vocab',lesson,'lesson');
        assert.equal(result.assets.length,3);
        assert.equal(result.assets.find(a=>a.type==='audio').usages.length,2);
        assert(!JSON.stringify(result).includes('outside.png'));
        assert(!JSON.stringify(result).includes('deleted.png'));
      });
      await check('collection traverses actual lessons and word relationships',async()=>{
        assert((await service.detail('vocab',collection,'collection')).assets.some(a=>a.url.endsWith('/outside.png')));
        assert.equal((await service.detail('vocab',word,'word')).assets.length,2);
      });
      const dictation=await insert('dictationlessons',{id:id(),title:'QA dictation media',slug:id(),full_audio_url:'/media/dictation.wav',thumbnail_url:'/media/thumb.png',payload:JSON.stringify({thumbnailUrl:'https://example.invalid/obsolete.png'})});
      await insert('dictationsegments',{id:id(),lesson_id:dictation,order:0,text:'QA',audio_url:'/media/dictation.wav',start_ms:0,end_ms:1000,duration_ms:1000,source:'TTS',language:'en-US',speed:1,words:'[]'});
      await check('dictation full audio and segment usage are grouped without legacy payload',async()=>{
        const result=await service.detail('dictation',dictation);
        assert.equal(result.assets.length,2);
        assert.equal(result.assets.find(a=>a.type==='audio').usages.length,2);
        assert(!JSON.stringify(result).includes('obsolete'));
      });
      await client.query('UPDATE lessons SET is_deleted=true WHERE id=$1',[lesson]);
      await check('deleted parents cannot be opened',()=>assert.rejects(service.detail('vocab',lesson),/not found/));
    } else if(role==='assessment') {
      const exam=await insert('exams',{id:id(),name:'QA media exam',slug:id(),type:'TOEIC',duration_minutes:10,is_active:true});
      const other=await insert('exams',{id:id(),name:'QA other exam',slug:id(),type:'TOEIC',duration_minutes:10,is_active:true});
      for(const [e,url] of [[exam,'/media/shared.wav'],[other,'/media/other.wav']])await insert('questions',{id:id(),exam_id:e,section:'LISTENING',part:1,content:'QA',options:'[]',correct_answer:'A',order:1,audio_url:url,image_url:e===exam?'/media/question.png':null,is_active:true});
      const group=await insert('passagegroups',{id:id(),exam_id:exam,section:'LISTENING',part:3,title:'QA passage group',order:1});
      await insert('passages',{id:id(),passage_group_id:group,type:'TEXT',content:'QA',order:1,audio_url:'/media/shared.wav',image_url:'/media/passage.png'});
      await check('exam includes question and passage assets, excludes another exam',async()=>{
        const result=await service.detail('toeic',exam);
        assert.equal(result.assets.length,3);
        assert.equal(result.assets.find(a=>a.type==='audio').usages.length,2);
        assert(!JSON.stringify(result).includes('other.wav'));
        assert(result.assets.flatMap(a=>a.usages).some(u=>u.labelEn.includes('Question 1')));
      });
    } else if(role==='learning') {
      const game=await insert('gamedefinitions',{id:id(),code:'QA-'+id(),name:'QA media game',destination:'/games/qa',image_url:'/media/game.png',settings:JSON.stringify({backgroundMusicUrl:'/media/music.wav',correctSoundUrl:'/media/shared.wav',wrongSoundUrl:'/media/shared.wav',loseSoundUrl:'javascript:alert(1)',minWordCount:10})});
      await check('game extracts only configured image/audio and deduplicates effects',async()=>{
        const result=await service.detail('games',game);
        assert.equal(result.assets.length,3);
        assert.equal(result.assets.find(a=>a.url.endsWith('/shared.wav')).usages.length,2);
        assert(!JSON.stringify(result).includes('javascript:'));
        assert(!JSON.stringify(result).includes('minWordCount'));
      });
    }
    await check('SQL search treats injection-like input as text',async()=>{
      const result=await service.list(category,{search:"QA' OR TRUE --",page:1,pageSize:5});
      assert.equal(result.total,0);assert.equal(result.items.length,0);
    });
    await check('list returns bounded pages and explicit metadata only',async()=>{
      const result=await service.list(category,{page:1,pageSize:1});
      assert(result.items.length<=1);assert(result.total>=1);
      assert(!JSON.stringify(result.items).includes('payload'));
      assert(!JSON.stringify(result.items).includes('settings'));
    });
    console.log('TOTAL '+role+' '+checks+' checks');
  } finally { await client.query('ROLLBACK');client.release();await pool.end(); }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
