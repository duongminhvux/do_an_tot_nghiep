/** Browser IAM acceptance with real Identity/PostgreSQL. Never points at production. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {fork}=require('node:child_process');
const {chromium}=require('../.tmp/iam-ui-test/node_modules/playwright-core');
const frontend='http://127.0.0.1:56902',backend='http://127.0.0.1:56901/api',results=[];
const output=path.resolve('.tmp/iam-ui-test/results');fs.mkdirSync(output,{recursive:true});
const waitFor=async(check,message)=>{const until=Date.now()+15000;while(Date.now()<until){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error(message);};
let child,browser,requestId=0;const pending=new Map();
const command=(action,extra={})=>new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});child.send({action,...extra,requestId:id});});
const step=async(name,work)=>{await work();results.push({name,pass:true});console.log('PASS:',name);};
const confirm=async page=>page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Confirm access change',exact:true})}).getByRole('button',{name:'Confirm',exact:true}).click();
(async()=>{
 assert(Number.isInteger(Number(process.env.ADMIN_IAM_TEST_PORT))&&Number(process.env.ADMIN_IAM_TEST_PORT)>1024&&Number(process.env.ADMIN_IAM_TEST_PORT)!==5432,'Explicit isolated test port required');assert(process.env.ADMIN_IAM_TEST_PASSWORD);assert(process.env.ADMIN_IAM_PYTHONPATH);
 child=fork(path.resolve('tests/admin-iam-browser-host.cjs'),[],{cwd:path.resolve('.'),env:process.env,stdio:['ignore','pipe','pipe','ipc']});
 let ready=false,hostErrors='';child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>{hostErrors+=String(chunk);});
 child.on('message',message=>{if(message.ready)ready=true;else if(message.requestId){const handler=pending.get(message.requestId);if(handler){pending.delete(message.requestId);message.error?handler.reject(Error(message.error)):handler.resolve(message.result);}}});
 await waitFor(()=>ready,'Backend test host did not start: '+hostErrors);
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 const errors=[];
 const makeContext=async options=>{const value=await browser.newContext(options);value.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));return value;};
 const context=await makeContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
 await step('Super Admin signs in through the actual form and backend profile',async()=>{
  await page.goto(frontend+'/en/login');await page.getByLabel('Username or Email').fill('super');await page.getByLabel('Password',{exact:true}).fill('phase3-fixture-password');
  await page.getByRole('button',{name:'Sign In as Admin',exact:true}).click();await page.waitForURL(frontend+'/en');await page.goto(frontend+'/en/iam/admins');await page.getByRole('heading',{name:'Administrator accounts',exact:true}).waitFor();
 });
 await step('create/update ordinary role and persist/reload permission matrix',async()=>{
  await page.goto(frontend+'/en/iam/roles');await page.getByRole('button',{name:'Create role',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Role code',{exact:true}).fill('IAM_QA');await dialog.getByLabel('Role name',{exact:true}).fill('Reviewer QA');await dialog.getByLabel('Description',{exact:true}).fill('Browser acceptance role');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('heading',{name:'Reviewer QA',exact:true}).waitFor();
  assert.equal(await page.locator('label').filter({has:page.locator('code')}).count(),70);
  await page.getByRole('checkbox',{name:/users\.read/}).check();await page.getByRole('checkbox',{name:/vocabulary\.read/}).check();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await confirm(page);await page.getByText('Changes saved',{exact:true}).waitFor();
  await page.reload();await page.getByRole('checkbox',{name:/users\.read/}).waitFor();assert(await page.getByRole('checkbox',{name:/users\.read/}).isChecked());
  await page.getByRole('button',{name:'Edit role',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Role name',{exact:true}).fill('Reviewer Updated');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('heading',{name:'Reviewer Updated',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'roles-desktop.png'),fullPage:false});
 });
 await step('system role remains read only and unsaved changes require confirmation',async()=>{
  await page.getByRole('checkbox',{name:/users\.create/}).check();
  await page.locator('aside').getByRole('button').filter({hasText:'SUPER_ADMIN'}).click();await page.getByRole('heading',{name:'Discard unsaved changes?',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByText('Protected system role',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Edit role',exact:true}).count(),0);assert(await page.getByRole('checkbox',{name:/users\.read/}).isDisabled());
 });
 await step('dialogs support Escape and return focus to the initiating control',async()=>{
  await page.goto(frontend+'/en/iam/admins');await page.getByRole('button',{name:'Invite administrator',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await waitFor(async()=>await page.getByRole('dialog').count()===0,'Dialog did not close');assert(await page.getByRole('button',{name:'Invite administrator',exact:true}).evaluate(el=>el===document.activeElement));
 });
 await step('create pending administrator with a role and truthful QUEUED feedback',async()=>{
  await page.goto(frontend+'/en/iam/admins');await page.getByRole('button',{name:'Invite administrator',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Email',{exact:true}).fill('browserpending@example.test');await dialog.getByLabel('Username',{exact:true}).fill('browserpending');await dialog.getByRole('checkbox',{name:'Reviewer Updated',exact:true}).check();await dialog.getByRole('button',{name:'Invite administrator',exact:true}).click();
  await dialog.getByText('Email queued · sending not yet confirmed',{exact:true}).waitFor();assert.equal((await command('account',{email:'browserpending@example.test'})).status,'PENDING_ACTIVATION');assert.equal(await dialog.locator('input[type=password]').count(),0);
  await dialog.getByRole('button',{name:'Close',exact:true}).last().click();await page.screenshot({path:path.join(output,'admins-desktop.png'),fullPage:false});
 });
 const searchAdmin=async name=>{await page.getByLabel('Search email or username',{exact:true}).fill(name);await page.getByRole('button',{name:'Search',exact:true}).click();await waitFor(async()=>await page.getByRole('row').filter({hasText:name+'@example.test'}).count()===1,'Admin search result missing');};
 const openAdmin=async name=>{await searchAdmin(name);await page.getByRole('row').filter({hasText:name+'@example.test'}).getByRole('button',{name:/View details/}).click();await page.getByRole('dialog').waitFor();};
 await step('assign/revoke roles, edit profile, suspend and unlock through dialogs',async()=>{
  await openAdmin('editor');let dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'Reviewer Updated',exact:true}).check();await dialog.getByRole('button',{name:'Apply roles',exact:true}).click();await confirm(page);await dialog.getByText('Changes saved',{exact:true}).waitFor();
  await dialog.getByRole('checkbox',{name:'Reviewer Updated',exact:true}).uncheck();await dialog.getByRole('checkbox',{name:'Ordinary',exact:true}).uncheck();await dialog.getByRole('button',{name:'Apply roles',exact:true}).click();await confirm(page);await waitFor(async()=>await dialog.getByRole('button',{name:'Apply roles',exact:true}).isDisabled(),'Roles not persisted');
  await dialog.getByLabel('Username',{exact:true}).fill('editor-updated');await dialog.getByRole('button',{name:'Save profile',exact:true}).click();await confirm(page);await dialog.getByRole('heading',{name:'editor-updated',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Suspend',exact:true}).click();await confirm(page);await dialog.getByText('Suspended',{exact:true}).waitFor();assert.equal((await command('account',{email:'editor@example.test'})).status,'SUSPENDED');
  await dialog.getByRole('button',{name:'Unlock',exact:true}).click();await confirm(page);await dialog.getByText('Active',{exact:true}).waitFor();assert.equal((await command('account',{email:'editor@example.test'})).status,'ACTIVE');await dialog.getByRole('button',{name:'Close',exact:true}).last().click();
 });
 await step('filter and paginate actual PostgreSQL records',async()=>{
  await page.getByLabel('Search email or username',{exact:true}).fill('');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('Status',{exact:true}).selectOption('PENDING_ACTIVATION');await waitFor(async()=>await page.getByRole('button',{name:'Next',exact:true}).isEnabled(),'Pagination fixture missing');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText(/Page 2/).waitFor();await page.getByRole('button',{name:'Previous',exact:true}).click();await page.getByLabel('Status',{exact:true}).selectOption('');
 });
 await step('reinvite handles server cooldown 429 and a fresh invitation succeeds',async()=>{
  await openAdmin('browserpending');let dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Resend activation link',exact:true}).click();await confirm(page);
  await dialog.getByText('Please wait 60 seconds before requesting another invitation.',{exact:true}).waitFor();assert(await dialog.getByRole('button',{name:/Available in/}).isDisabled());await dialog.getByRole('button',{name:'Close',exact:true}).last().click();
  await command('age',{email:'browserpending@example.test'});await page.reload();await openAdmin('browserpending');dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Resend activation link',exact:true}).click();await confirm(page);await dialog.getByText('Email queued · sending not yet confirmed',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).last().click();
 });
 await step('Vietnamese/mobile screens retain labels, controls and bounded layout',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(frontend+'/vi/iam/roles');await page.getByRole('heading',{name:'Vai trò & phân quyền',exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'roles-mobile-vi.png'),fullPage:false});
  await page.goto(frontend+'/vi/iam/admins');await page.getByRole('heading',{name:'Tài khoản quản trị',exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'admins-mobile-vi.png'),fullPage:false});
 });
 let activatedToken;
 await step('activation form uses a real delivered token, removes fragment, keeps token out of storage and follows backend login URL',async()=>{
  const {token}=await command('deliver',{email:'browserpending@example.test'});activatedToken=token;
  const publicContext=await makeContext({viewport:{width:390,height:844}}),activation=await publicContext.newPage();let publicAuth=false;
  activation.on('request',req=>{if(req.url().includes('/api/admin/activation/'))publicAuth ||= !!req.headers().authorization;});
  await publicContext.route('https://admin.example.test/login',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Backend login redirect target</h1>'}));
  await publicContext.addCookies([{name:'NEXT_LOCALE',value:'en',url:frontend}]);await activation.goto(frontend+'/activate#token='+encodeURIComponent(token));await activation.getByLabel('New password',{exact:true}).waitFor();assert(!(await activation.url()).includes('#'));
  await activation.getByRole('button',{name:'Switch to English',exact:true}).waitFor();
  await activation.getByRole('button').filter({hasText:'VI'}).click();await activation.waitForURL('**/vi/activate');await activation.locator('#activation-password').waitFor();
  await activation.getByRole('button',{name:'Switch to English',exact:true}).click();await activation.waitForURL('**/en/activate');await activation.getByLabel('New password',{exact:true}).waitFor();
  assert(await activation.evaluate(raw=>!JSON.stringify({...localStorage,...sessionStorage}).includes(raw),token));assert.equal(publicAuth,false);
  await activation.getByLabel('New password',{exact:true}).fill('Browser-Admin-Password123!');await activation.getByLabel('Confirm password',{exact:true}).fill('Different-Password123!');await activation.getByRole('button',{name:'Activate account',exact:true}).click();await activation.getByText('Use a password that meets the requirements and matches the confirmation.',{exact:true}).waitFor();
  await activation.screenshot({path:path.join(output,'activation-mobile.png'),fullPage:false});
  await activation.getByLabel('Confirm password',{exact:true}).fill('Browser-Admin-Password123!');await activation.getByRole('button',{name:'Activate account',exact:true}).click();await activation.waitForURL('https://admin.example.test/login');assert.equal((await command('account',{email:'browserpending@example.test'})).status,'ACTIVE');
  await publicContext.close();
 });
 await step('used/invalid activation links stay public with contact guidance even while logged in',async()=>{
  await page.goto(frontend+'/en/activate#token='+encodeURIComponent(activatedToken));await page.getByRole('heading',{name:'This activation link is unavailable',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Resend activation link',exact:true}).count(),0);
 });
 const loginData=async(username,password)=>{const response=await context.request.post(backend+'/admin/auth/login',{data:{username,password}});assert.equal(response.status(),201);return (await response.json()).data;};
 const seed=async(ctx,login)=>{await ctx.addInitScript(value=>{if(location.origin!==value.origin)return;localStorage.setItem('adminAccessToken',value.accessToken);localStorage.setItem('adminRefreshToken',value.refreshToken);localStorage.setItem('adminUser',JSON.stringify(value.profile));document.cookie=`adminAccessToken=${value.accessToken}; path=/; SameSite=Lax`;},{...login,origin:frontend});};
 await step('ordinary admin sees no IAM controls, forged frontend rights fail and direct IAM API returns 403',async()=>{
  const login=await loginData('editor-updated','phase3-fixture-password'),ordinary=await makeContext();await seed(ordinary,{...login,profile:{...login.profile,isSuperAdmin:true,permissions:['admins.read','admins.create','roles.read','roles.manage']}});const denied=await ordinary.newPage();await denied.goto(frontend+'/en/iam/admins');await denied.getByRole('heading',{name:'Access denied',exact:true}).waitFor();assert.equal(await denied.getByRole('button',{name:'Invite administrator',exact:true}).count(),0);
  assert.equal((await context.request.get(backend+'/admin/admins',{headers:{Authorization:'Bearer '+login.accessToken}})).status(),403);await ordinary.close();
 });
 await step('expired access token refreshes once and refetches authoritative profile',async()=>{
  const login=await loginData('super','phase3-fixture-password'),expired=await command('expiredAccess'),fresh=await makeContext();await seed(fresh,{...login,accessToken:expired.accessToken});const refreshed=await fresh.newPage();let refreshCount=0;refreshed.on('request',req=>{if(req.url().endsWith('/admin/auth/refresh-token'))refreshCount++;});await refreshed.goto(frontend+'/en/iam/admins');await refreshed.getByRole('heading',{name:'Administrator accounts',exact:true}).waitFor();assert.equal(refreshCount,1);await fresh.close();
 });
 await step('403 renders an error without a refresh loop or accidental logout',async()=>{
  const login=await loginData('super','phase3-fixture-password'),fault=await makeContext();await seed(fault,login);await fault.route('**/api/admin/roles',route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"Forbidden"}'}));const denied=await fault.newPage();let refreshCount=0;denied.on('request',req=>{if(req.url().endsWith('/admin/auth/refresh-token'))refreshCount++;});await denied.goto(frontend+'/en/iam/roles');await denied.getByRole('alert').filter({hasText:'Access denied'}).waitFor();assert.equal(refreshCount,0);assert((await denied.url()).endsWith('/en/iam/roles'));await fault.close();
 });
 await step('real role-permission revocation invalidates access and refresh and returns the UI to login',async()=>{
  const login=await loginData('browserpending','Browser-Admin-Password123!'),superLogin=await loginData('super','phase3-fixture-password');
  const roles=await context.request.get(backend+'/admin/roles',{headers:{Authorization:'Bearer '+superLogin.accessToken}});const role=(await roles.json()).data.find(item=>item.code==='IAM_QA');
  assert.equal((await context.request.put(backend+'/admin/roles/'+role.id+'/permissions',{headers:{Authorization:'Bearer '+superLogin.accessToken},data:{permissionCodes:[]}})).status(),200);
  const revoked=await makeContext();await seed(revoked,login);const revokedPage=await revoked.newPage();await revokedPage.goto(frontend+'/en/iam/admins');await revokedPage.waitForURL('**/en/login');await revoked.close();
 });
 await step('concurrent 401 responses retry each queued request once and end at login',async()=>{
  const login=await loginData('super','phase3-fixture-password'),fault=await makeContext();await seed(fault,login);const counts={roles:0,admins:0,refresh:0};await fault.route(/\/api\/admin\/(roles|admins)(?:\?|$)/,route=>{const key=new URL(route.request().url()).pathname.endsWith('/roles')?'roles':'admins';counts[key]++;return route.fulfill({status:401,contentType:'application/json',body:'{"message":"Revoked"}'});});
  const expired=await fault.newPage();expired.on('request',req=>{if(req.url().endsWith('/admin/auth/refresh-token'))counts.refresh++;});await expired.goto(frontend+'/en/iam/admins');await expired.waitForURL('**/en/login');assert(counts.roles<=4&&counts.admins<=4&&counts.refresh<=2,'Refresh requests must be bounded '+JSON.stringify(counts));await fault.close();
 });
 await step('learner auth still issues USER tokens independently',async()=>{
  const login=await context.request.post(backend+'/auth/login',{data:{email:'learner@example.test',password:'phase3-fixture-password'}});assert.equal(login.status(),201);const token=(await login.json()).data.accessToken;assert.equal(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role,'USER');
 });
 assert.equal(errors.length,0,'Unexpected browser runtime errors: '+errors.join('; '));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log('BROWSER PASS:',results.length,'scenarios');
 await context.close();
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(child&&child.connected){await command('stop').catch(()=>{});}});
