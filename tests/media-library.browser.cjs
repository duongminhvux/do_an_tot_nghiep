/** Real Docker HTTP + Chrome checks. Creates only clearly marked QA content, then removes it. */
const { chromium } = require('../.tmp/ui-qa/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const bytes = fs.readFileSync('.tmp/ui-qa/media-session.json');
const session = JSON.parse(bytes.toString(bytes[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,''));
const api='http://localhost:5000/api';
const base='http://localhost:3001';
const output='.tmp/ui-qa/media';
fs.mkdirSync(output,{recursive:true});
const results=[],errors=[],lessons=[],uploads=[];
let collection,word,browser;
const run='QA Media '+session.run;
async function request(route,options={},token=session.admin.token) {
  const headers={authorization:'Bearer '+token,...(options.body instanceof FormData?{}:{'content-type':'application/json'})};
  const response=await fetch(api+route,{...options,headers});
  if(!response.ok)throw new Error(route+' HTTP '+response.status+' '+(await response.text()).slice(0,180));
  return (await response.json()).data;
}
async function check(name,fn,page) {
  const row={name};
  try { await fn(); row.status='PASS'; }
  catch(error){row.status='FAIL';row.failure=error.message;throw error;}
  finally {
    if(page) {
      row.route=new URL(page.url()).pathname+new URL(page.url()).search;
      row.overflow=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth})).catch(()=>null);
      if(row.overflow&&row.overflow.width>row.overflow.viewport+2&&row.status==='PASS'){row.status='FAIL';row.failure='Horizontal page overflow';}
      row.screenshot=name+'.png';
      await page.screenshot({path:output+'/'+row.screenshot,fullPage:true}).catch(()=>{});
    }
    results.push(row);
    fs.writeFileSync(output+'/report.json',JSON.stringify({backend:'Live Docker APIs and S3 through Gateway; only failure recovery uses intentional 503 injection',results,browserErrors:errors},null,2));
    console.log(row.status+' '+name+(row.failure?': '+row.failure.slice(0,200):''));
  }
}
async function waitFor(fn,label){for(let n=0;n<150;n++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout '+label);}
(async()=>{
  try {
    await check('admin-only-endpoints-and-query-validation',async()=>{
      const login=await fetch(api+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:session.users[0].email,username:session.users[0].email,password:session.users[0].password})});
      const userToken=(await login.json()).data.accessToken;
      for(const category of ['dictation','vocab','toeic','games']) {
        assert.equal((await fetch(api+'/admin/media-library/'+category+'/items')).status,401);
        assert.equal((await fetch(api+'/admin/media-library/'+category+'/items',{headers:{authorization:'Bearer '+userToken}})).status,403);
        const list=await request('/admin/media-library/'+category+'/items?pageSize=5');
        assert(list.items.length<=5);assert.equal(typeof list.total,'number');
      }
      for(const query of ['page=-1','page=1.5','pageSize=1000','kind=unknown'])assert.equal((await fetch(api+'/admin/media-library/vocab/items?'+query,{headers:{authorization:'Bearer '+session.admin.token}})).status,400);
      assert.equal((await fetch(api+'/admin/media-library/vocab/items/not-a-uuid',{headers:{authorization:'Bearer '+session.admin.token}})).status,400);
    });
    await check('temporary-linked-media-fixtures',async()=>{
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
      const wav=Buffer.alloc(44+16000*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
      for(const [name,buffer,type] of [['qa.png',png,'image/png'],['qa.wav',wav,'audio/wav']]) {
        const data=new FormData();data.append('file',new Blob([buffer],{type}),name);
        const result=await request('/upload',{method:'POST',body:data});uploads.push(result?.url?result:result.data);
      }
      collection=await request('/admin/collections',{method:'POST',body:JSON.stringify({name:run,coverUrl:uploads[0].url})});
      for(let n=1;n<=12;n++)lessons.push(await request('/admin/lessons',{method:'POST',body:JSON.stringify({collectionId:collection._id,title:run+' Lesson '+String(n).padStart(2,'0'),coverUrl:n===1?uploads[0].url:''})}));
      const raw=await request('/admin/words',{method:'POST',body:JSON.stringify({word:'qa-media-'+session.run,level:'A1',image:uploads[0].url,audio:{us:uploads[1].url,uk:uploads[1].url},parts:[]})});
      word=raw?._id?raw:raw.data;
      await request('/admin/lessons/'+lessons[0]._id+'/words',{method:'POST',body:JSON.stringify({wordIds:[word._id]})});
      const detail=await request('/admin/media-library/vocab/items/'+lessons[0]._id+'?kind=lesson');
      assert.equal(detail.assets.length,2);assert.equal(detail.assets.find(a=>a.type==='image').usages.length,2);assert.equal(detail.assets.find(a=>a.type==='audio').usages.length,2);
    });
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    async function pageFor(mobile=false){
      const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});
      await ctx.addInitScript(({token,profile})=>{localStorage.setItem('adminAccessToken',token);localStorage.setItem('adminUser',JSON.stringify(profile));document.cookie='adminAccessToken='+token+'; path=/; SameSite=Lax';},session.admin);
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));return page;
    }
    const page=await pageFor();
    await check('root-folders-and-four-live-categories',async()=>{
      await page.goto(base+'/vi/media');
      for(const category of ['dictation','games','vocab','toeic']) {
        await page.locator(`a[href="/vi/media?category=${category}"]`).waitFor();
        const list=await request('/admin/media-library/'+category+'/items');
        if(list.items[0])await request('/admin/media-library/'+category+'/items/'+list.items[0].id);
      }
      await page.locator('a[href="/vi/media?category=vocab"]').click();
      await page.getByRole('button',{name:'Bài học',exact:true}).waitFor();
    },page);
    await check('server-pagination-search-back-navigation',async()=>{
      await page.getByLabel('Tìm nội dung',{exact:true}).fill(run);
      await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
      await page.getByRole('button',{name:new RegExp(run+' Lesson 01')}).waitFor();
      assert.equal(await page.getByRole('button',{name:new RegExp(run+' Lesson 11')}).count(),0);
      await page.getByRole('button',{name:'Next page',exact:true}).click();
      await page.getByRole('button',{name:new RegExp(run+' Lesson 11')}).waitFor();
      await page.getByRole('button',{name:new RegExp(run+' Lesson 12')}).click();
      await page.getByText('Nội dung này chưa sử dụng media thuộc loại đã chọn.',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Về danh sách',exact:true}).click();
      assert.equal(new URL(page.url()).searchParams.get('page'),'2');
      await page.getByRole('button',{name:new RegExp(run+' Lesson 11')}).waitFor();
      await page.getByRole('button',{name:'First page',exact:true}).click();
      await page.getByRole('button',{name:new RegExp(run+' Lesson 01')}).click();
      await page.locator('audio').waitFor();
    },page);
    await check('real-image-preview-and-audio-playback',async()=>{
      await waitFor(()=>page.locator('img').evaluateAll(images=>images.some(img=>img.complete&&img.naturalWidth>0)),'decoded PNG');
      const playback=await page.locator('audio').evaluate(async audio=>{await audio.play();const result={duration:audio.duration,paused:audio.paused,readyState:audio.readyState};audio.pause();return result;});
      assert(playback.duration>0);assert.equal(playback.paused,false);assert(playback.readyState>=2);
      assert.equal(await page.getByRole('link',{name:'Mở file',exact:true}).count(),2);
      await page.getByRole('button',{name:'Sao chép link',exact:true}).first().click();
      assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('/media/'));
    },page);
    await check('type-filter-and-usage-deduplication',async()=>{
      await page.getByRole('button',{name:'Ảnh (1)',exact:true}).click();
      await page.locator('audio').waitFor({state:'hidden'});
      assert.equal(await page.locator('audio').count(),0);
      await page.getByRole('button',{name:'Âm thanh (1)',exact:true}).click();
      await page.locator('audio').waitFor();assert.equal(await page.locator('article img').count(),0);
    },page);
    await check('collection-and-dictionary-subtopics',async()=>{
      await page.goto(base+'/vi/media?category=vocab&kind=collection&q='+encodeURIComponent(run));
      await page.getByRole('button',{name:new RegExp(run)}).filter({has:page.getByRole('heading',{name:run,exact:true})}).click();
      await page.locator('audio').waitFor();
      await page.goto(base+'/vi/media?category=vocab&kind=word&q='+encodeURIComponent('qa-media-'+session.run));
      await page.getByRole('button',{name:new RegExp('qa-media-'+session.run)}).click();
      await page.locator('audio').waitFor();
    },page);
    const mobile=await pageFor(true);
    await check('mobile-english-media-preview',async()=>{
      await mobile.goto(base+'/en/media?category=vocab&kind=lesson&id='+lessons[0]._id);
      await mobile.getByRole('heading',{name:'Media library',exact:true}).waitFor();
      await mobile.locator('audio').waitFor();
      await mobile.getByRole('button',{name:'Images (1)',exact:true}).click();
      await mobile.locator('audio').waitFor({state:'hidden'});
      await mobile.getByRole('link',{name:'Open file',exact:true}).waitFor();
    },mobile);
    await check('read-failure-notice-and-retry-to-live-backend',async()=>{
      const matches=url=>url.pathname==='/api/admin/media-library/vocab/items';
      await page.route(matches,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA unavailable'})}));
      await page.goto(base+'/vi/media?category=vocab');
      const notice=page.getByRole('alert').filter({hasText:'Không thể tải dữ liệu.'});
      await notice.waitFor({timeout:20000});
      await page.unroute(matches);
      await Promise.all([
        page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/media-library/vocab/items'&&r.status()===200),
        notice.getByRole('button',{name:'Thử lại',exact:true}).click(),
      ]);
      await notice.waitFor({state:'hidden'});
      assert(!new URL(page.url()).pathname.endsWith('/login'));
    },page);
    await check('no-uncaught-browser-errors',()=>assert.deepEqual(errors,[]));
  } finally {
    if(browser)await browser.close();
    for(const lesson of lessons)await request('/admin/lessons/'+lesson._id,{method:'DELETE'}).catch(e=>console.error(e.message));
    if(word)await request('/admin/words/'+word._id,{method:'DELETE'}).catch(e=>console.error(e.message));
    if(collection)await request('/admin/collections/'+collection._id,{method:'DELETE'}).catch(e=>console.error(e.message));
    for(const upload of uploads)await request('/upload/delete',{method:'POST',body:JSON.stringify({public_id:upload.public_id})}).catch(e=>console.error(e.message));
    for(const user of session.users)await request('/admin/users/'+user.profile._id,{method:'DELETE'}).catch(e=>console.error(e.message));
  }
  console.log(JSON.stringify({checks:results.length,failed:results.filter(r=>r.status==='FAIL').length,output}));
  if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
