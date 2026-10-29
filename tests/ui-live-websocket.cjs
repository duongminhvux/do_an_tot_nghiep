/** Real-browser/real-backend QA. Requires ignored .tmp/ui-qa/live-session.json
 * from ui-live-bootstrap.cjs. Only QA users/rooms are mutated. No API mocking.
 */
const { chromium } = require('../.tmp/ui-qa/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const bytes = fs.readFileSync('.tmp/ui-qa/live-session.json');
const session = JSON.parse(bytes.toString(bytes[0]===255 ? 'utf16le':'utf8').replace(/^\uFEFF/,''));
const out = path.resolve(process.env.QA_LIVE_OUTPUT || '.tmp/ui-qa/live');
fs.mkdirSync(out,{recursive:true});
const records=[], errors=[], httpErrors=[];
let browser, admin, pages=[], contexts=[];
const qaWords=[];
const qaTerms=[];
let qaLesson,qaCollection;
let qaRankedMatch;
const web=process.env.WEB_LIVE_URL || 'http://localhost:3000';
const adminUrl=process.env.ADMIN_LIVE_URL || 'http://localhost:3001';
const api=process.env.API_LIVE_URL || 'http://localhost:5000/api';
function report() {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ date:'2026-10-29', backend:'Live Docker gateway, owner services, PostgreSQL/Redis; no API mocks', results:records, browserErrors:errors, apiErrors:httpErrors },null,2));
}
async function step(name, fn, page) {
  const item={name};
  try { await fn(); item.status='PASS'; }
  catch(error) { item.status='FAIL';item.failure=error.message; throw error; }
  finally {
    if(page) {
      item.route=new URL(page.url()).pathname;
      item.body=(await page.locator('body').innerText().catch(()=>'' )).slice(-1000);
      item.screenshot=name.replace(/[^a-z0-9-]/gi,'-')+'.png';
      await page.screenshot({path:path.join(out,item.screenshot),fullPage:true}).catch(()=>{});
    }
    records.push(item);report();console.log(item.status+' '+name+(item.failure?': '+item.failure.slice(0,200):''));
  }
}
async function waitFor(check, description, timeout=20000) {
  const start=Date.now();
  while(Date.now()-start<timeout) { if(await check())return;await new Promise(r=>setTimeout(r,100)); }
  throw new Error('Timed out: '+description);
}
async function makePage(name,mobile=false) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},reducedMotion:'reduce'});
  contexts.push(context);
  // Retain only the transport for controlled connection interruption and setup ACKs.
  // The app still creates/authenticates the socket and handles all incoming events.
  await context.addInitScript(() => {
    const Base=window.WebSocket;
    window.__qaSockets=[];
    window.WebSocket=class extends Base { constructor(...args){super(...args);window.__qaSockets.push(this);} };
  });
  const page=await context.newPage();
  page.qa={name,events:[],socketCount:0};
  page.on('pageerror',error=>errors.push({page:name,message:error.message}));
  page.on('response',response=>{
    if(response.url().startsWith(api)&&response.status()>=400) httpErrors.push({page:name,status:response.status(),path:new URL(response.url()).pathname});
  });
  page.on('websocket',socket=>{
    page.qa.socketCount++;
    socket.on('framereceived',event=>{
      const raw=String(event.payload);
      const start=raw.indexOf('[');
      if(raw.startsWith('42/arena,')&&start>=0) {
        try{ const data=JSON.parse(raw.slice(start));if(typeof data[0]==='string')page.qa.events.push(data[0]);}catch{}
      }
    });
  });
  pages.push(page);return page;
}
async function login(page,index) {
  const user=session.users[index];
  await page.goto(web+'/vi/login');
  await page.locator('#username').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(web+'/vi',{timeout:20000});
  await waitFor(()=>page.qa.events.includes('arena:authenticated'),'authenticated WebSocket');
}
async function setupEvent(page,event,payload) {
  return page.evaluate(({event,payload})=>new Promise((resolve,reject)=>{
    const socket=window.__qaSockets.findLast(s=>s.readyState===1&&s.url.includes('/socket.io/'));
    if(!socket)return reject(new Error('No connected app transport'));
    const ack=990000+(window.__qaAck=(window.__qaAck||0)+1);
    const prefix='43/arena,'+ack;
    const timer=setTimeout(()=>{socket.removeEventListener('message',handle);reject(new Error('ACK timeout '+event));},12000);
    function handle(message) {
      if(!String(message.data).startsWith(prefix+'['))return;
      clearTimeout(timer);socket.removeEventListener('message',handle);
      const response=JSON.parse(String(message.data).slice(prefix.length))[0];
      if(response?.success===false)reject(new Error(response.message));else resolve(response?.data??response);
    }
    socket.addEventListener('message',handle);
    socket.send('42/arena,'+ack+JSON.stringify([event,payload]));
  }),{event,payload});
}
async function visit(page,url,heading) {
  const response=await page.goto(url,{waitUntil:'networkidle'});
  assert(response.status()<400,'HTTP route failed');
  if(heading)await page.getByRole('heading',{name:heading}).first().waitFor();
  assert(!/Application error:|Đang kiểm tra thông tin đăng nhập/.test(await page.locator('body').innerText()));
}
async function roomInfo() {
  return setupEvent(pages[0],'friend-room:current',{});
}
async function adminRequest(route,options={}) {
  const response=await fetch(api+route,{...options,headers:{authorization:'Bearer '+session.admin.token,'content-type':'application/json'}});
  const body=await response.json();
  if(!response.ok)throw new Error('QA content API '+route+' '+response.status+' '+JSON.stringify(body).slice(0,300));
  return body.data;
}
async function seedGameWords() {
  qaCollection=await adminRequest('/admin/collections',{method:'POST',body:JSON.stringify({name:'UI QA '+session.run,isActive:true})});
  qaLesson=await adminRequest('/admin/lessons',{method:'POST',body:JSON.stringify({title:'UI QA '+session.run,collectionId:qaCollection._id,isActive:true})});
  for(let index=0;index<10;index++) {
    let word;
    do { word='q'+Array.from(require('node:crypto').randomBytes(3),n=>String.fromCharCode(97+n%26)).join('')+'q'; } while(qaTerms.includes(word));
    qaTerms.push(word);
    const existing=await adminRequest('/admin/words?search='+word+'&limit=100');
    if(existing.data.some(row=>row.word===word))throw new Error('QA fixture would collide with existing word '+word);
    const raw=await adminRequest('/admin/words',{method:'POST',body:JSON.stringify({word,level:'A1',isActive:true,parts:[{partOfSpeech:'noun',meanings:[{definition:'UI QA '+session.run+' '+word,translation:['UI QA meaning '+word]}]}]})});
    const created=raw?._id?raw:raw.data;
    qaWords.push(created._id);
    await adminRequest('/admin/lessons/'+qaLesson._id+'/words',{method:'POST',body:JSON.stringify({wordIds:[created._id]})});
    await adminRequest('/admin/words/'+created._id+'/validate',{method:'POST'});
    await adminRequest('/admin/words/'+created._id+'/publish',{method:'POST'});
  }
}
async function createGameRoom(host,guests,mode,multiplayer=false) {
  await visit(host,web+'/vi/arena');
  const card=host.locator('article').filter({has:host.getByRole('heading',{name:multiplayer?'Phòng đấu':'Đấu bạn bè 1vs1',exact:true})});
  await card.getByRole('button',{name:'Tạo phòng',exact:true}).click();
  await host.waitForURL('**/arena/'+(multiplayer?'group':'friend')+'/room/*');
  const room=await roomInfo();
  if(mode!=='CLASSIC') {
    await host.getByRole('button',{name:new RegExp('^'+(mode==='WORD_GUESS'?'Word Guess':'Word Chain'))}).click();
    await host.getByRole('button',{name:'LƯU CÀI ĐẶT MỚI',exact:true}).click();
    await host.getByRole('button',{name:'CÀI ĐẶT ĐÃ LƯU',exact:true}).waitFor();
  }
  for(const guest of guests) {
    await visit(guest,web+'/vi/arena/'+(multiplayer?'group':'friend')+'/room/'+room.code);
    await guest.getByRole('button',{name:'SẴN SÀNG CHIẾN',exact:true}).click();
  }
  await waitFor(()=>host.getByRole('button',{name:'BẮT ĐẦU TRẬN ĐẤU',exact:true}).isEnabled(),'ready to start');
  await host.getByRole('button',{name:'BẮT ĐẦU TRẬN ĐẤU',exact:true}).click();
  for(const page of [host,...guests])await page.waitForURL(/\/arena\/friend\/[0-9a-f-]{36}$/,{timeout:20000});
  return {...room,matchId:host.url().split('/').at(-1)};
}
async function leaveGame(host,room,guests) {
  await setupEvent(host,'friend:leave',{matchId:room.matchId});
  for(const guest of guests)await setupEvent(guest,'friend:leave',{matchId:room.matchId}).catch(()=>{});
  for(const page of [host,...guests]) {
    const current=await setupEvent(page,'friend-room:current',{}).catch(()=>null);
    if(current)await setupEvent(page,'friend-room:leave',{roomId:current.roomId}).catch(()=>{});
    await page.goto(web+'/vi/arena');
    const confirm=page.getByRole('button',{name:'Đã hiểu',exact:true});
    if(await confirm.isVisible())await confirm.click();
  }
}
async function gameSuite(host,guest,third) {
  await step('create-and-publish-ten-isolated-qa-words',seedGameWords);
  let room;
  await step('word-guess-room-settings-and-start-ui',async()=>{
    room=await createGameRoom(host,[guest],'WORD_GUESS');
    await host.getByRole('textbox',{name:'Từ gồm 5 chữ cái',exact:true}).waitFor();
  },host);
  await step('word-guess-private-answer-and-opponent-update',async()=>{
    await host.getByRole('textbox',{name:'Từ gồm 5 chữ cái',exact:true}).fill(qaTerms[0]);
    await host.getByRole('button',{name:'Gửi đáp án',exact:true}).click();
    await waitFor(()=>host.qa.events.includes('word-guess:update'),'guess update');
    await waitFor(()=>guest.qa.events.includes('word-guess:update'),'opponent progress update');
    const state=await setupEvent(host,'word-guess:state',{matchId:room.matchId});
    assert.equal(state.attempts.length,1);
    assert.equal((await setupEvent(guest,'word-guess:state',{matchId:room.matchId})).attempts.length,0);
  },host);
  await step('word-guess-reload-restores-live-state',async()=>{
    await host.reload({waitUntil:'networkidle'});
    await waitFor(()=>host.qa.events.filter(x=>x==='arena:authenticated').length>=2,'reload reconnect');
    assert.equal((await setupEvent(host,'word-guess:state',{matchId:room.matchId})).attempts.length,1);
    await leaveGame(host,room,[guest]);
  },host);
  await step('word-chain-room-starts-and-accepts-first-turn',async()=>{
    room=await createGameRoom(host,[guest],'WORD_CHAIN');
    const input=host.getByRole('textbox',{name:'Nhập từ tiếng Anh',exact:true});
    await waitFor(()=>input.isEnabled(),'host turn');
    await input.fill(qaTerms[1]);
    await input.press('Enter');
    await guest.getByText(qaTerms[1],{exact:true}).first().waitFor();
    await waitFor(()=>guest.getByRole('textbox',{name:'Nhập từ tiếng Anh',exact:true}).isEnabled(),'guest turn');
    await guest.getByRole('textbox',{name:'Nhập từ tiếng Anh',exact:true}).fill(qaTerms[2]);
    await guest.getByRole('textbox',{name:'Nhập từ tiếng Anh',exact:true}).press('Enter');
    await host.getByText(qaTerms[2],{exact:true}).first().waitFor();
    await leaveGame(host,room,[guest]);
  },guest);
  await step('classic-room-start-and-question-delivery',async()=>{
    room=await createGameRoom(host,[guest],'CLASSIC');
    await waitFor(()=>host.qa.events.includes('match:question'),'host question',25000);
    await waitFor(()=>guest.qa.events.includes('match:question'),'guest question');
    assert(!(await host.locator('body').innerText()).includes('Not enough active vocabulary'));
    await leaveGame(host,room,[guest]);
  },host);
  await step('multiplayer-room-three-live-members-and-start',async()=>{
    room=await createGameRoom(host,[guest,third],'WORD_GUESS',true);
    assert.equal((await setupEvent(host,'friend:join',{matchId:room.matchId})).players.length,3);
    for(const page of [host,guest,third])await page.getByRole('textbox',{name:'Từ gồm 5 chữ cái',exact:true}).waitFor();
    await leaveGame(host,room,[guest,third]);
  },third);
  await step('ranked-queue-ui-join-and-cancel',async()=>{
    await visit(host,web+'/vi/arena');
    await host.getByRole('button',{name:'Tìm trận ngay',exact:true}).click();
    await host.getByRole('button',{name:'Đang tìm đối thủ...',exact:true}).waitFor();
    await host.getByRole('button',{name:'Hủy tìm trận',exact:true}).click();
  },host);
  await step('game-ui-no-uncaught-browser-errors',async()=>assert.deepEqual(errors,[]));
}
async function rankedSuite(host,guest) {
  await step('ranked-qa-vocabulary-ready',seedGameWords);
  await step('ranked-two-users-match-and-enter-live-game',async()=>{
    for(const page of [host,guest])await visit(page,web+'/vi/arena');
    await host.getByRole('button',{name:'Tìm trận ngay',exact:true}).click();
    await guest.getByRole('button',{name:'Tìm trận ngay',exact:true}).click();
    for(const page of [host,guest])await page.waitForURL(/\/arena\/rank\/[0-9a-f-]{36}$/,{timeout:25000});
    assert.equal(host.url(),guest.url());
    qaRankedMatch=host.url().split('/').at(-1);
    await waitFor(()=>host.locator('#ranked-answer').isEnabled(),'ranked playing',25000);
    assert(host.qa.events.includes('ranked:match-found'));
    assert(guest.qa.events.includes('ranked:match-found'));
  },host);
  await step('ranked-answer-from-ui-receives-private-result',async()=>{
    const before=host.qa.events.filter(e=>e==='match:answer-result').length;
    await host.locator('#ranked-answer').fill(qaTerms[0]);
    await host.getByRole('button',{name:'Gửi đáp án',exact:true}).click();
    await waitFor(()=>host.qa.events.filter(e=>e==='match:answer-result').length>before,'ranked answer result');
  },host);
  await step('ranked-loss-of-connection-pauses-and-resynchronizes',async()=>{
    const before=host.qa.events.filter(e=>e==='arena:match-sync').length;
    await host.context().setOffline(true);
    await host.evaluate(()=>window.__qaSockets.forEach(s=>s.close()));
    await host.getByRole('heading',{name:'Đang khôi phục trận đấu',exact:true}).waitFor();
    assert(await host.locator('#ranked-answer').isDisabled());
    await host.context().setOffline(false);
    await waitFor(()=>host.qa.events.filter(e=>e==='arena:match-sync').length>before,'authoritative match sync',25000);
    await waitFor(()=>host.locator('#ranked-answer').isEnabled(),'ranked resumes',25000);
  },host);
  await step('ranked-forfeit-ui-and-opponent-finish-event',async()=>{
    await host.getByRole('button',{name:'Đấu trường',exact:true}).click();
    await host.getByRole('dialog').getByRole('button',{name:'Xác nhận thoát',exact:true}).click();
    await waitFor(()=>guest.qa.events.includes('match:finished'),'opponent finish event');
    await guest.getByText(/Chiến thắng|VICTORY|Bạn đã thắng/i).first().waitFor();
    qaRankedMatch=null;
  },guest);
  await step('ranked-no-uncaught-browser-errors',async()=>assert.deepEqual(errors,[]));
}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const host=await makePage('host');
    const guest=await makePage('guest');
    const third=await makePage('third-mobile',true);
    await step('host-real-login-and-websocket',()=>login(host,0),host);
    await step('guest-real-login-and-websocket',()=>login(guest,1),guest);
    await step('mobile-real-login-and-websocket',()=>login(third,2),third);
    if(['games','ranked'].includes(process.env.QA_LIVE_MODE)) {
      if(process.env.QA_LIVE_MODE==='games')await gameSuite(host,guest,third);
      else await rankedSuite(host,guest);
      records.push({name:'socket-event-coverage',status:'INFO',pages:pages.map(p=>({name:p.qa.name,connections:p.qa.socketCount,events:[...new Set(p.qa.events)]}))});
      report();return;
    }
    admin=await makePage('admin');
    await admin.context().addInitScript(({token,profile})=>{
      localStorage.setItem('adminAccessToken',token);localStorage.setItem('adminUser',JSON.stringify(profile));
      document.cookie='adminAccessToken='+token+'; path=/; SameSite=Lax';
    },session.admin);
    for(const route of ['/dictation','/dictation/progress']) await step('user-live'+route.replaceAll('/','-'),()=>visit(host,web+'/vi'+route),host);
    for(const route of ['','/users','/vocabulary/groups','/vocabulary/collections','/vocabulary/words','/dictation','/dictation/structure','/arena','/arena/players','/arena/matches','/arena/rooms']) {
      await step('admin-live'+(route||'-home').replaceAll('/','-'),()=>visit(admin,adminUrl+'/vi'+route),admin);
    }
    await step('create-friendly-room-from-ui',async()=>{
      await visit(host,web+'/vi/arena');
      const card=host.locator('article').filter({has:host.getByRole('heading',{name:'Đấu bạn bè 1vs1',exact:true})});
      await card.getByRole('button',{name:'Tạo phòng',exact:true}).click();
      await host.waitForURL('**/arena/friend/room/*');
      await host.getByRole('button',{name:'Rời phòng',exact:true}).waitFor();
    },host);
    let room=await roomInfo();
    assert(room?.hostId===session.users[0].profile._id,'Room belongs to QA host');
    await step('guest-joins-room-live-broadcast',async()=>{
      await visit(guest,web+'/vi/arena/friend/room/'+room.code);
      await guest.getByRole('button',{name:'SẴN SÀNG CHIẾN',exact:true}).waitFor();
      await host.getByText(session.users[1].profile.username,{exact:true}).first().waitFor();
      assert(host.qa.events.includes('friend-room:update'));
    },host);
    await step('guest-ready-enables-host-start',async()=>{
      await guest.getByRole('button',{name:'SẴN SÀNG CHIẾN',exact:true}).click();
      await waitFor(()=>host.getByRole('button',{name:'BẮT ĐẦU TRẬN ĐẤU',exact:true}).isEnabled(),'host start enabled');
    },host);
    await step('offline-disables-controls-and-reconnect-restores-room',async()=>{
      const before=guest.qa.events.filter(e=>e==='arena:authenticated').length;
      await guest.context().setOffline(true);
      await guest.evaluate(()=>window.__qaSockets.forEach(s=>s.close()));
      await guest.getByText(/Đang kết nối lại tới máy chủ Đấu trường/).waitFor();
      assert(await guest.getByRole('button',{name:/SẴN SÀNG/}).isDisabled());
      await guest.context().setOffline(false);
      await waitFor(()=>guest.qa.events.filter(e=>e==='arena:authenticated').length>before,'socket reauthenticated',25000);
      await guest.getByText(/Đang kết nối lại tới máy chủ Đấu trường/).waitFor({state:'hidden'});
      assert.equal((await setupEvent(guest,'friend-room:current',{})).players.length,2);
    },guest);
    await step('guest-leaves-host-updates-without-reload',async()=>{
      await guest.getByRole('button',{name:'Rời phòng',exact:true}).click();
      await guest.waitForURL(web+'/vi/arena');
      await waitFor(async()=> (await roomInfo()).players.length===1,'server removes guest');
      await host.getByText(session.users[1].profile.username,{exact:true}).waitFor({state:'hidden'});
    },host);
    await step('invite-received-and-declined-on-mobile',async()=>{
      await setupEvent(host,'friend:invite',{friendId:session.users[2].profile._id,mode:room.mode,roomId:room.roomId});
      await third.getByRole('button',{name:/Từ chối/i}).waitFor();
      await third.getByRole('button',{name:/Từ chối/i}).click();
      await waitFor(()=>host.qa.events.includes('friend:invite-declined'),'decline delivered to host');
    },third);
    await step('invite-accepted-routes-mobile-to-room',async()=>{
      await setupEvent(host,'friend:invite',{friendId:session.users[2].profile._id,mode:room.mode,roomId:room.roomId});
      await third.getByRole('button',{name:/Chấp nhận/i}).click();
      await third.waitForURL('**/arena/friend/room/'+room.code);
      await host.getByText(session.users[2].profile.username,{exact:true}).first().waitFor();
    },third);
    await step('admin-ui-closes-qa-room-broadcasts-to-both-users',async()=>{
      await visit(admin,adminUrl+'/vi/arena/rooms/'+room.roomId);
      await admin.getByRole('button',{name:'Đóng phòng',exact:true}).click();
      await admin.getByRole('dialog').locator('textarea').fill('UI QA '+session.run+' room close');
      await admin.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click();
      for(const page of [host,third]) {
        await page.getByRole('dialog').getByText(/quản trị viên/i).waitFor();
        await page.getByRole('button',{name:'Đã hiểu',exact:true}).click();
        await page.waitForURL(web+'/vi/arena');
      }
    },admin);
    await step('no-uncaught-errors-on-live-pages',async()=>assert.deepEqual(errors,[]));
    records.push({name:'socket-event-coverage',status:'INFO',pages:pages.map(p=>({name:p.qa.name,connections:p.qa.socketCount,events:[...new Set(p.qa.events)]}))});
    report();
  } finally {
    // Always close only rooms/matches owned by the new QA accounts.
    for(const page of pages.filter(p=>p.qa.name!=='admin')) {
      await page.context().setOffline(false).catch(()=>{});
      if(qaRankedMatch)await setupEvent(page,'match:leave',{matchId:qaRankedMatch}).catch(()=>{});
      try {
        const room=await setupEvent(page,'friend-room:current',{});
        if(room)await setupEvent(page,'friend-room:leave',{roomId:room.roomId});
      } catch{}
    }
    await browser.close();
    for(const wordId of qaWords) {
      await adminRequest('/admin/words/'+wordId+'/unpublish',{method:'POST'}).catch(()=>{});
      await adminRequest('/admin/words/'+wordId,{method:'DELETE'}).catch(error=>console.error(error.message));
    }
    if(qaLesson)await adminRequest('/admin/lessons/'+qaLesson._id,{method:'DELETE'}).catch(error=>console.error(error.message));
    if(qaCollection)await adminRequest('/admin/collections/'+qaCollection._id,{method:'DELETE'}).catch(error=>console.error(error.message));
    for(const u of session.users) {
      const response=await fetch(api+'/admin/users/'+u.profile._id,{method:'DELETE',headers:{authorization:'Bearer '+session.admin.token}});
      if(!response.ok)console.error('QA user cleanup failed '+response.status);
    }
  }
  console.log(JSON.stringify({checks:records.filter(r=>r.status!=='INFO').length,failed:records.filter(r=>r.status==='FAIL').length,output:out}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
