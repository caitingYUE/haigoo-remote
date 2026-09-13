import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'

// Real migration, triggers, SQL, and JS worker; every WeChat request is mocked.
// No environment file is loaded and there is no connection to an external database.
const pglite = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9)
assert.ok(pglite, 'Provide --pglite=/isolated/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(pglite))
function functions(file, names) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  return ast.statements.filter(n => ts.isFunctionDeclaration(n) && (!names || names.includes(n.name?.text)))
    .map(n => n.getText(ast).replace(/^export\s+(default\s+)?/,'')).join('\n')
}
const prepareCode = functions('lib/services/mini-company-match-service.js',['unique','prepareCompanyUpdateEvents'])
const workerCode = functions('lib/services/mini-wechat-reminder-service.js').replace("const { prepareCompanyUpdateEvents } = await import('./mini-company-match-service.js')",'')
const migration = fs.readFileSync('server-utils/dal/migrations/089_mini_wechat_reminder_delivery.sql','utf8')
const db = new PGlite()
const q = async (sql, params=[]) => (await db.query(sql,params)).rows
const results = []
await db.exec(`
CREATE TABLE users(user_id text PRIMARY KEY,status text DEFAULT 'active',member_status text DEFAULT 'none',member_type text DEFAULT 'none',member_cycle_start_at timestamptz,member_expire_at timestamptz);
CREATE TABLE trusted_companies(company_id text PRIMARY KEY,status text DEFAULT 'active',hiring_email text,name text,industry text);
CREATE TABLE jobs(job_id text PRIMARY KEY,title text,description text,location text,region text,job_type text,category text,company_id text,company text,status text DEFAULT 'active',is_approved boolean DEFAULT true,member_only boolean DEFAULT false,url text,source_type text,created_at timestamptz DEFAULT now());
CREATE TABLE mini_wechat_identities(user_id text,app_id text,openid text,linked_at timestamptz DEFAULT now());
CREATE TABLE mini_company_follows(user_id text,company_id text,status text DEFAULT 'active',in_app_enabled boolean DEFAULT true,wechat_enabled boolean DEFAULT true,wechat_template_status text DEFAULT 'accepted',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE career_watch_profiles(user_id text,status text DEFAULT 'active',in_app_enabled boolean DEFAULT true,wechat_enabled boolean DEFAULT true,wechat_template_status text DEFAULT 'accepted',role_families jsonb DEFAULT '["engineering"]',source_mode text DEFAULT 'resume',custom_role_terms jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE mini_company_update_events(event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id text,event_type text,event_hash text UNIQUE,role_families jsonb DEFAULT '[]',has_public_opportunity boolean DEFAULT false,source_job_id text,occurred_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE mini_company_update_inbox(inbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text,event_id uuid,notification_status text DEFAULT 'pending',notified_at timestamptz,created_at timestamptz DEFAULT now(),UNIQUE(user_id,event_id));
`)
await db.exec(migration)
await db.exec(migration) // repeat deployment must not damage new work
async function reset(n=1) {
  await db.exec('TRUNCATE mini_company_update_inbox,mini_company_update_events,mini_company_follows,career_watch_profiles,mini_wechat_identities,users,jobs,trusted_companies,mini_reminder_worker_lease')
  await q("INSERT INTO trusted_companies(company_id,name) VALUES('company-a','测试招聘企业')")
  await q("INSERT INTO users(user_id) SELECT 'user-'||n FROM generate_series(0,$1::int-1) n",[n])
  await q("INSERT INTO mini_wechat_identities(user_id,app_id,openid) SELECT user_id,'audit-app','fake-'||user_id FROM users")
  await q("INSERT INTO mini_company_follows(user_id,company_id) SELECT user_id,'company-a' FROM users")
}
async function job({id='job-a',approved=true,status='active',memberOnly=false,source='admin',url='https://example.invalid/job/a'}={}) {
  await q(`INSERT INTO jobs(job_id,title,description,location,job_type,category,company_id,company,is_approved,status,member_only,source_type,url)
    VALUES($1,'后端开发','开发服务','远程','全职','engineering','company-a','测试招聘企业',$2,$3,$4,$5,$6)`,[id,approved,status,memberOnly,source,url])
}
function runtime({sendCodes=[],tokenDown=false,rejectInbox=false,onSend=null,enabled=true}={}) {
  const requests=[]
  const state={tokenDown,rejectInbox,sendCodes:[...sendCodes]}
  const context=vm.createContext({crypto,Date,Set,Map,Intl,AbortSignal,Math,console:{info(){},warn(){},error(){}},
    process:{env:{WECHAT_MINI_APP_ID:'audit-app',WECHAT_MINI_APP_SECRET:'fake',WECHAT_MINI_COMPANY_UPDATE_TEMPLATE_ID:'audit-template',MINI_WECHAT_REMINDERS_ENABLED:String(enabled),VERCEL_ENV:'production'}},
    EVENTS_TABLE:'mini_company_update_events',FOLLOWS_TABLE:'mini_company_follows',INBOX_TABLE:'mini_company_update_inbox',
    wechatAccessTokenCache:{token:'',expiresAt:0},wechatTemplateFieldsCache:new Map(),
    extractStructuredResume:()=>({roleFamilies:['engineering']}),roleFamiliesForText:()=>['engineering'],
    neonHelper:{query:async(sql,p)=>{
      if(state.rejectInbox && sql.includes('WITH event AS')) { state.rejectInbox=false; throw new Error('inbox unavailable') }
      return q(sql,p)
    }},
    fetch:async(url,init)=>{
      if(url.endsWith('/stable_token')) { if(state.tokenDown) throw new Error('token down'); return {ok:true,json:async()=>({access_token:'fake',expires_in:7200})} }
      if(url.includes('/gettemplate?')) return {ok:true,json:async()=>({data:[{priTmplId:'audit-template',content:'招聘企业名称:{{thing2.DATA}}\n职位名称:{{thing1.DATA}}\n工作地点:{{thing6.DATA}}\n工作类型:{{thing7.DATA}}\n更新时间:{{time4.DATA}}'}]})}
      assert.ok(url.includes('/message/subscribe/send?'))
      requests.push(JSON.parse(init.body));if(onSend) await onSend()
      const code=state.sendCodes.shift()??0
      if(code==='timeout') throw new Error('timeout')
      return {ok:true,json:async()=>code==='missing'?{}:{errcode:code,msgid:code===0?'fake-msg-id':undefined}}
    }
  })
  const f=vm.runInContext(`${prepareCode}\n${workerCode}\n;({runWechatReminderDelivery,prepareCompanyUpdateEvents})`,context)
  return {...f,state,requests}
}
async function test(name,fn) { await reset(); await fn(); results.push(name); console.log('PASS',name) }
const pending=async()=>q('SELECT * FROM mini_company_update_inbox ORDER BY created_at,inbox_id')
try {
await test('所有写入入口：首次公开、后审核、重新开放；重复编辑、下架、会员及镜像不触发',async()=>{
  await job({approved:false});assert.equal((await q('SELECT * FROM mini_company_update_events')).length,0)
  await q("UPDATE jobs SET is_approved=true WHERE job_id='job-a'")
  await q("UPDATE jobs SET title='后端开发新版' WHERE job_id='job-a'")
  assert.equal((await q('SELECT * FROM mini_company_update_events')).length,1)
  await q("UPDATE jobs SET status='inactive' WHERE job_id='job-a'")
  await q("UPDATE jobs SET status='active' WHERE job_id='job-a'")
  await job({id:'mirror',source:'mini_catalog_projection'});await job({id:'vip',memberOnly:true})
  assert.equal((await q('SELECT * FROM mini_company_update_events')).length,2)
  await db.exec('BEGIN');await job({id:'rolled-back'});await db.exec('ROLLBACK')
  assert.equal((await q('SELECT * FROM mini_company_update_events')).length,2)
  await db.exec(migration)
  assert.equal((await q('SELECT * FROM mini_company_update_events WHERE prepared_at IS NULL')).length,2)
})
await test('企业申请邮箱补全和企业重新激活也触发',async()=>{
  await job({url:''});assert.equal((await q('SELECT * FROM mini_company_update_events')).length,0)
  await q("UPDATE trusted_companies SET hiring_email='jobs@example.invalid'")
  await q("UPDATE trusted_companies SET status='inactive'");await q("UPDATE trusted_companies SET status='active'")
  assert.equal((await q('SELECT * FROM mini_company_update_events')).length,2)
})
await test('正常发送字段与跳转正确；重复运行/第二次上新不重复消费一次授权',async()=>{
  await job();const r=runtime();await r.runWechatReminderDelivery();await r.runWechatReminderDelivery()
  await job({id:'job-b'});await r.runWechatReminderDelivery()
  assert.equal(r.requests.length,1)
  const msg=r.requests[0];assert.equal(msg.touser,'fake-user-0');assert.equal(msg.data.thing2.value,'测试招聘企业')
  assert.equal(msg.data.thing1.value,'后端开发');assert.equal(msg.data.thing7.value,'全职')
  assert.equal(msg.page,'pages/company-detail/index?id=company-a');assert.equal(msg.miniprogram_state,'formal')
  assert.equal((await pending()).filter(i=>i.notification_status==='sent').length,1)
})
await test('重复关注/资料保存不会取消已有待发授权',async()=>{
  await job();const r=runtime();await r.prepareCompanyUpdateEvents()
  await q("UPDATE mini_company_follows SET status='active',wechat_enabled=wechat_enabled,wechat_template_status=wechat_template_status,updated_at=NOW()")
  await r.runWechatReminderDelivery();assert.equal(r.requests.length,1)
})
await test('凭证临时失败保留待发，恢复后自动补发',async()=>{
  await job();const r=runtime({tokenDown:true});await assert.rejects(r.runWechatReminderDelivery())
  assert.equal((await pending())[0].notification_status,'pending');r.state.tokenDown=false
  await r.runWechatReminderDelivery();assert.equal(r.requests.length,1);assert.equal((await pending())[0].notification_status,'sent')
})
await test('收件箱失败后事件保持未准备，重试原子补建并发出',async()=>{
  await job();const r=runtime()
  await db.exec(`CREATE FUNCTION audit_fail_inbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inbox unavailable'; END $$;
    CREATE TRIGGER audit_fail BEFORE INSERT ON mini_company_update_inbox FOR EACH ROW EXECUTE FUNCTION audit_fail_inbox()`)
  await assert.rejects(r.runWechatReminderDelivery())
  assert.equal((await q('SELECT prepared_at FROM mini_company_update_events'))[0].prepared_at,null)
  await db.exec('DROP TRIGGER audit_fail ON mini_company_update_inbox; DROP FUNCTION audit_fail_inbox()')
  await r.runWechatReminderDelivery();assert.equal(r.requests.length,1)
})
await test('第101人可跨轮续发；成功记录不会重复发送',async()=>{
  await reset(101);await job();const r=runtime();await r.runWechatReminderDelivery({maxMessages:100});assert.equal(r.requests.length,100)
  await r.runWechatReminderDelivery();assert.equal(r.requests.length,101)
  assert.equal(new Set(r.requests.map(x=>x.touser)).size,101)
})
await test('43101清除失效状态；发送期间新增授权不会被旧结果清除',async()=>{
  await job();const r=runtime({sendCodes:[43101]});await r.runWechatReminderDelivery()
  assert.equal((await q('SELECT wechat_enabled FROM mini_company_follows'))[0].wechat_enabled,false)
  await reset();await job();const r2=runtime({sendCodes:[43101],onSend:()=>q("UPDATE mini_company_follows SET wechat_enabled=true,wechat_template_status='accepted',authorization_id=gen_random_uuid()")})
  await r2.runWechatReminderDelivery();assert.equal((await q('SELECT wechat_enabled FROM mini_company_follows'))[0].wechat_enabled,true)
})
await test('成功发送不能抹掉同时新取得的授权',async()=>{
  await job();const r=runtime({onSend:()=>q("UPDATE mini_company_follows SET wechat_enabled=true,wechat_template_status='accepted',authorization_id=gen_random_uuid()")})
  await r.runWechatReminderDelivery();assert.equal((await q('SELECT wechat_enabled FROM mini_company_follows'))[0].wechat_enabled,true)
})
await test('明确临时错误按退避重试，最多5次后停止',async()=>{
  await job();const r=runtime({sendCodes:[-1,-1,-1,-1,-1]});await r.runWechatReminderDelivery();await r.runWechatReminderDelivery()
  assert.equal(r.requests.length,1)
  for(let i=0;i<4;i++){await q("UPDATE mini_company_update_inbox SET next_attempt_at=NOW()-INTERVAL '1 second'");await r.runWechatReminderDelivery()}
  assert.equal(r.requests.length,5);assert.equal((await pending())[0].notification_status,'failed')
})
await test('明确临时错误恢复后成功；无效token会重新获取',async()=>{
  await job();const r=runtime({sendCodes:[40001,0]});await r.runWechatReminderDelivery()
  await q("UPDATE mini_company_update_inbox SET next_attempt_at=NOW()-INTERVAL '1 second'");await r.runWechatReminderDelivery()
  assert.equal((await pending())[0].notification_status,'sent');assert.equal(r.requests.length,2)
})
await test('发送超时/响应缺字段记为unknown，不盲目重发',async()=>{
  for(const code of ['timeout','missing']){await reset();await job();const r=runtime({sendCodes:[code]})
    await r.runWechatReminderDelivery();await r.runWechatReminderDelivery()
    assert.equal(r.requests.length,1);assert.equal((await pending())[0].notification_status,'unknown')}
})
await test('同数据库重叠消费者不重复领取，进程中断的processing保守恢复',async()=>{
  await job();let busy;const r=runtime({onSend:async()=>{busy=await runtime().runWechatReminderDelivery()}})
  await r.runWechatReminderDelivery();assert.equal(busy.skipped,'worker_busy');assert.equal(r.requests.length,1)
  await reset();await job();const r2=runtime();await r2.prepareCompanyUpdateEvents()
  const token=crypto.randomUUID();await q("INSERT INTO mini_reminder_worker_lease VALUES('wechat',$1,NOW()+INTERVAL '330 seconds')",[token])
  await q("SELECT mini_claim_reminder($1,'audit-app')",[token]);await q('DELETE FROM mini_reminder_worker_lease')
  await r2.runWechatReminderDelivery();assert.equal(r2.requests.length,0);assert.equal((await pending())[0].notification_status,'unknown')
})
await test('发送前关闭/取关/解绑/注销/岗位下架/身份变更均不发送',async()=>{
  const changes=["UPDATE mini_company_follows SET wechat_enabled=false","UPDATE mini_company_follows SET status='inactive'","DELETE FROM mini_wechat_identities","UPDATE mini_wechat_identities SET linked_at=NOW()+INTERVAL '1 second'","UPDATE users SET status='deleted'","UPDATE jobs SET status='inactive'","UPDATE mini_wechat_identities SET app_id='other-app'"]
  for(const sql of changes){await reset();await job();const r=runtime();await r.prepareCompanyUpdateEvents();await q(sql)
    await r.runWechatReminderDelivery();assert.equal(r.requests.length,0,sql)}
})
await test('晚关注/晚授权不补发旧事件，未来上新正常触发',async()=>{
  await q('DELETE FROM mini_company_follows');await job()
  await q("UPDATE mini_company_update_events SET occurred_at=NOW()-INTERVAL '1 second'")
  await q("INSERT INTO mini_company_follows(user_id,company_id) VALUES('user-0','company-a')")
  const r=runtime();await r.runWechatReminderDelivery();assert.equal(r.requests.length,0)
  await job({id:'future'});await r.runWechatReminderDelivery();assert.equal(r.requests.length,1)
})
await test('会员方向匹配与到期边界，企业关注+方向同人只发一次',async()=>{
  await reset(3);await q('UPDATE mini_company_follows SET wechat_enabled=false')
  await q("INSERT INTO career_watch_profiles(user_id) SELECT user_id FROM users")
  await q("UPDATE users SET member_status='active',member_type='year',member_expire_at=NOW()+INTERVAL '1 day' WHERE user_id IN ('user-0','user-1')")
  await job();const r=runtime();await r.prepareCompanyUpdateEvents()
  await q("UPDATE users SET member_expire_at=NOW()-INTERVAL '1 day' WHERE user_id='user-1'")
  await r.runWechatReminderDelivery();assert.deepEqual(r.requests.map(x=>x.touser),['fake-user-0'])
  await reset();await q("INSERT INTO career_watch_profiles(user_id) VALUES('user-0')")
  await q("UPDATE users SET member_status='active',member_type='year'");await job();const r2=runtime()
  await r2.runWechatReminderDelivery();assert.equal(r2.requests.length,1)
})
await test('发送开关默认关闭，无secret或伪造cron标头不能启动发送',async()=>{
  await job();const r=runtime({enabled:false});await r.runWechatReminderDelivery();assert.equal(r.requests.length,0)
  const handlerCode=functions('lib/cron-handlers/mini-wechat-reminders.js')
  let calls=0
  const c=vm.createContext({crypto,Buffer,process:{env:{CRON_SECRET:'test-secret'}},console,runWechatReminderDelivery:async()=>{calls++;return {skipped:'disabled'}}})
  const handler=vm.runInContext(`${handlerCode};miniWechatRemindersHandler`,c)
  const res={status(code){this.code=code;return this},json(body){this.body=body;return this}}
  await handler({method:'GET',headers:{'x-vercel-cron':'1'}},res);assert.equal(res.code,401);assert.equal(calls,0)
  await handler({method:'GET',headers:{authorization:'Bearer test-secret'}},res);assert.equal(res.code,200);assert.equal(calls,1)
})
fs.mkdirSync('docs/qa/2026-09-13-wechat-reminders',{recursive:true})
fs.writeFileSync('docs/qa/2026-09-13-wechat-reminders/repair-regressions.json',JSON.stringify({at:new Date().toISOString(),passed:results,realMessagesSent:0,productionDataModified:false},null,2)+'\n')
console.log(`All ${results.length} reminder regression scenarios passed`)
} finally {await db.close()}
