/** Force a specific read API to fail, then let Retry reach the real Docker backend. */
const { chromium }=require('../.tmp/ui-qa/node_modules/playwright-core');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const bytes=fs.readFileSync('.tmp/ui-qa/live-session.json');
const session=JSON.parse(bytes.toString(bytes[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,''));
const results=[];
const output='.tmp/ui-qa/recovery';
fs.mkdirSync(output,{recursive:true});
const routes=[
  ['web','/vi/dictation','/api/dictation/topics'],
  ['web','/vi/dictation/progress','/api/dictation/progress'],
  ['web','/en/dictation','/api/dictation/topics'],
  ['admin','/vi','/api/admin/dashboard/overview'],
  ['admin','/en','/api/admin/dashboard/overview'],
  ['admin','/vi/users','/api/admin/users'],
  ['admin','/vi/vocabulary/groups','/api/admin/vocabulary-groups'],
  ['admin','/vi/vocabulary/collections','/api/admin/collections'],
  ['admin','/vi/vocabulary/words','/api/admin/words'],
  ['admin','/vi/dictation','/api/admin/dictation'],
  ['admin','/vi/dictation/structure','/api/admin/dictation/hierarchy'],
];
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const [app,route,endpoint] of routes) {
      const item={app,route,endpoint};
      const context=await browser.newContext({viewport:route.startsWith('/en')?{width:390,height:844}:{width:1440,height:1000}});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      try {
        if(app==='admin')await context.addInitScript(({token,profile})=>{
          localStorage.setItem('adminAccessToken',token);localStorage.setItem('adminUser',JSON.stringify(profile));
          document.cookie='adminAccessToken='+token+'; path=/; SameSite=Lax';
        },session.admin);
        else {
          await page.goto('http://localhost:3000/vi/login');
          await page.locator('#username').fill(session.users[0].email);
          await page.locator('#password').fill(session.users[0].password);
          await page.locator('form button[type=submit]').click();
          await page.waitForURL('http://localhost:3000/vi');
        }
        const match=url=>url.pathname===endpoint;
        await page.route(match,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({statusCode:503,message:'QA injected read failure'})}));
        await page.goto('http://localhost:'+(app==='admin'?3001:3000)+route);
        const notice=page.getByRole('alert').filter({hasText:/Unable to load data|Không thể tải dữ liệu/});
        await notice.waitFor({timeout:20000});
        item.failureNotice=true;
        await page.unroute(match);
        const [response]=await Promise.all([
          page.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.status()===200,{timeout:20000}),
          notice.getByRole('button',{name:route.startsWith('/en')?'Retry':'Thử lại',exact:true}).click(),
        ]);
        await notice.waitFor({state:'hidden'});
        assert.equal(response.status(),200);
        assert.deepEqual(errors,[]);
        item.status='PASS';item.retryResponseStatus=200;
      } catch(error) {item.status='FAIL';item.failure=error.message;}
      item.screenshot=app+route.replaceAll('/','-')+'.png';
      await page.screenshot({path:output+'/'+item.screenshot,fullPage:true}).catch(()=>{});
      results.push(item);
      fs.writeFileSync(output+'/report.json',JSON.stringify({backend:'Injected 503 followed by actual live Docker API on Retry',results},null,2));
      console.log(item.status+' '+app+' '+route+(item.failure?': '+item.failure.slice(0,180):''));
      await context.close();
    }
  } finally {
    await browser.close();
    for(const user of session.users)await fetch('http://localhost:5000/api/admin/users/'+user.profile._id,{method:'DELETE',headers:{authorization:'Bearer '+session.admin.token}});
  }
  process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
