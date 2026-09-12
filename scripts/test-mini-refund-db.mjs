import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const path = process.argv.find(a => a.startsWith('--pglite='))?.slice(9)
if (!path) throw Error('Supply --pglite=/external/test-only/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(path))
const db = new PGlite()
process.env.RESEND_API_KEY = 'test-only-no-network'
const sentEmails = []
let failEmail = false
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails')
  sentEmails.push({body: JSON.parse(options.body), headers: options.headers})
  return {ok: !failEmail, status: failEmail ? 503 : 200, json: async () => ({id: 'test-email'})}
}
const migration = n => fs.readFileSync(`server-utils/dal/migrations/${n}`, 'utf8')
try {
  await db.exec(`CREATE SEQUENCE member_id_seq;
    CREATE TABLE users (user_id varchar PRIMARY KEY, email text, username text, status text DEFAULT 'active', roles jsonb DEFAULT '{}',
      member_status text DEFAULT 'free', member_type text DEFAULT 'none', membership_level text DEFAULT 'free',
      member_cycle_start_at timestamptz, member_expire_at timestamptz, membership_expire_at timestamptz,
      member_since timestamptz, member_display_id int, updated_at timestamptz);
    CREATE TABLE payment_records (payment_id varchar PRIMARY KEY, user_id varchar REFERENCES users,
      provider text DEFAULT 'wechat_virtual', payment_method text DEFAULT 'wechat_virtual', app_id text DEFAULT 'app',
      openid text DEFAULT 'open', product_id text DEFAULT 'monthly', status text DEFAULT 'pending', currency text DEFAULT 'CNY',
      expected_amount_cents int DEFAULT 9900, paid_amount_cents int, provider_transaction_id text, provider_status text,
      metadata jsonb DEFAULT '{"virtualPayment":{"env":1,"planSnapshot":{"memberType":"starter","durationMonths":1}}}',
      paid_at timestamptz, callback_received_at timestamptz, updated_at timestamptz);
    CREATE TABLE membership_entitlement_segments (segment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id varchar REFERENCES users,
      source_type text, source_payment_id varchar UNIQUE, member_type text, duration_months smallint, duration_days smallint DEFAULT 0,
      starts_at timestamptz, ends_at timestamptz CHECK (ends_at > starts_at), activated_at timestamptz, superseded_at timestamptz,
      superseded_reason text, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
    CREATE TABLE member_service_entitlement_definitions (entitlement_key text PRIMARY KEY,enabled boolean DEFAULT true);
    INSERT INTO member_service_entitlement_definitions VALUES ('career_direction_diagnosis'),('bilingual_resume_optimization'),('custom_job_search_materials');`)
  const crm = migration('067_member_crm.sql')
  await db.exec(crm.slice(crm.indexOf('CREATE TABLE IF NOT EXISTS user_member_service_entitlements'),crm.indexOf('CREATE TABLE IF NOT EXISTS member_crm_profiles')))
  await db.exec(crm.slice(crm.indexOf('CREATE TABLE IF NOT EXISTS member_crm_service_records'),crm.indexOf('CREATE INDEX IF NOT EXISTS idx_member_crm_service_user')))
  const ledger = migration('064_membership_redemption_codes.sql')
  await db.exec(ledger.slice(ledger.indexOf('CREATE OR REPLACE FUNCTION enforce_membership_entitlement_no_overlap'),ledger.indexOf('CREATE OR REPLACE FUNCTION redeem_membership_code')))
  await db.exec(ledger.slice(ledger.indexOf('CREATE OR REPLACE FUNCTION reconcile_membership_entitlements')))
  await db.exec(migration('085_wechat_virtual_payment_refunds.sql'))
  await db.exec(migration('086_wechat_refund_consistency.sql'))
  const user = async id => { await db.query('INSERT INTO users (user_id) VALUES ($1)', [id]) }
  const order = async (id,u,half=false) => {
    await db.query('INSERT INTO payment_records (payment_id,user_id) VALUES ($1,$2)',[id,u])
    if(half) await db.query(`UPDATE payment_records SET metadata = '{"virtualPayment":{"env":1,"planSnapshot":{"memberType":"half_year","durationMonths":6}}}' WHERE payment_id=$1`,[id])
  }
  const pay = async id => (await db.query('SELECT complete_wechat_virtual_payment($1,$2,9900,$3::jsonb,\'app\') AS r', [id,`tx-${id}`,JSON.stringify({OpenId:'open',Env:1,GoodsInfo:{ProductId:'monthly'},WeChatPayInfo:{PaidTime:0}})])).rows[0].r
  const refund = async (id,r,amount=9900,ok=true,env=1,openid='open') => (await db.query(`SELECT apply_wechat_virtual_refund($1,$2,$3,$4,$5::jsonb,NOW() - INTERVAL '1 year') AS r`,[id,r,amount,ok,JSON.stringify({...(openid == null ? {} : {OpenId:openid}),...(env == null ? {} : {Env:env})})])).rows[0].r
  const state = async u => (await db.query('SELECT * FROM users WHERE user_id=$1',[u])).rows[0]
  const segments = async u => (await db.query('SELECT * FROM membership_entitlement_segments WHERE user_id=$1 ORDER BY starts_at,created_at',[u])).rows
  await user('single'); await order('a','single')
  assert.equal((await refund('a','ra')).code,'REFUND_PAYMENT_NOT_COMPLETED')
  assert.equal((await pay('a')).success,true); assert.equal((await state('single')).member_status,'active')
  assert.equal((await pay('a')).alreadyCompleted,true)
  assert.equal((await refund('a','bad',9900,true,0)).success,false)
  assert.equal((await refund('a','bad-openid',9900,true,1,'other')).success,false)
  assert.equal((await refund('a','failed',9900,false)).success,true)
  assert.equal((await state('single')).member_status,'active')
  assert.equal((await refund('a','ra',9900,true,null,null)).entitlementChanged,true)
  assert.equal((await state('single')).member_status,'free')
  assert.equal((await refund('a','ra')).alreadyProcessed,true)
  assert.equal((await refund('a','ra',1)).code,'REFUND_REPLAY_CONFLICT')
  assert.equal((await refund('a','ra',9900,false)).alreadyProcessed,true)
  assert.equal((await pay('a')).alreadyCompleted,true); assert.equal((await state('single')).member_status,'free')
  await user('queue'); for (const id of ['b','c','d']) { await order(id,'queue'); assert.equal((await pay(id)).success,true) }
  const before = await segments('queue')
  assert.equal(before.filter(s=>s.activated_at).length,1)
  assert.equal(before[1].starts_at.getTime(),before[0].ends_at.getTime())
  assert.equal((await refund('c','rc')).entitlementChanged,true)
  let remaining = (await segments('queue')).filter(s=>!s.superseded_at)
  assert.equal(remaining[1].starts_at.getTime(),remaining[0].ends_at.getTime())
  assert.equal((await state('queue')).member_expire_at.getTime(),before[0].ends_at.getTime())
  assert.equal((await refund('b','rb')).entitlementChanged,true)
  assert.equal((await state('queue')).member_status,'active')
  remaining = (await segments('queue')).filter(s=>!s.superseded_at)
  assert.equal(remaining.length,1); assert.ok(remaining[0].activated_at)
  await user('partial'); await order('e','partial'); await pay('e')
  assert.equal((await refund('e','re1',100)).requiresManualReview,true)
  assert.equal((await state('partial')).member_status,'active')
  assert.equal((await refund('e','re2',9800)).entitlementChanged,true)
  assert.equal((await state('partial')).member_status,'free')
  await user('half'); await order('h','half',true); await pay('h')
  const keys=['career_direction_diagnosis','bilingual_resume_optimization','custom_job_search_materials']
  const ensure = u=>db.query('SELECT ensure_mini_half_year_services($1,$2::text[])',[u,keys])
  await ensure('half')
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM user_member_service_entitlements WHERE metadata->>'sourcePaymentId'='h'")).rows[0].n,3)
  await db.exec("UPDATE user_member_service_entitlements SET status='requested' WHERE user_id='half' AND entitlement_key='career_direction_diagnosis'")
  assert.equal((await refund('h','rh')).requiresManualReview,true)
  assert.equal((await state('half')).member_status,'active')
  await user('unused'); await order('i','unused',true); await pay('i'); await ensure('unused')
  assert.equal((await refund('i','ri')).entitlementChanged,true); await ensure('unused')
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM user_member_service_entitlements WHERE user_id='unused' AND status='unavailable'")).rows[0].n,3)
  await order('j','unused',true); await pay('j'); await ensure('unused')
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM user_member_service_entitlements WHERE user_id='unused' AND status='available' AND metadata->>'sourcePaymentId'='j'")).rows[0].n,3)
  await user('legacy'); await order('l','legacy'); await db.exec("UPDATE payment_records SET status='completed' WHERE payment_id='l'")
  assert.equal((await refund('l','rl')).requiresManualReview,true)
  // Exercise the actual JavaScript payment/refund service against PostgreSQL too.
  await db.exec(`ALTER TABLE payment_records ADD COLUMN amount numeric DEFAULT 99, ADD COLUMN plan_id text DEFAULT 'club_starter_monthly', ADD COLUMN created_at timestamptz DEFAULT NOW();`)
  const { default: helper } = await import('../server-utils/dal/neon-helper.js')
  helper.query = async (sql,params) => (await db.query(sql,params)).rows
  const { continuousMembershipExpireAt } = await import('../lib/services/membership-redemption-code-service.js')
  const publicExpiry = async u => continuousMembershipExpireAt(await state(u), (await segments(u)).filter(s=>!s.activated_at && !s.superseded_at).map(s=>({memberType:s.member_type, startsAt:s.starts_at.toISOString(), expiresAt:s.ends_at.toISOString()})))
  const { wechatVirtualPaymentService: service } = await import('../lib/services/wechat-virtual-payment-service.js')
  process.env.WECHAT_MINI_APP_ID='app'
  await user('runtime');await order('rt','runtime')
  await db.exec("UPDATE users SET email='member@example.test',username='Test Member' WHERE user_id='runtime'")
  await db.exec("UPDATE payment_records SET product_id='club_starter_monthly' WHERE payment_id='rt'")
  const delivery={OutTradeNo:'rt',OpenId:'open',Env:1,GoodsInfo:{ProductId:'club_starter_monthly',Quantity:1,ActualPrice:9900},WeChatPayInfo:{TransactionId:'runtime-tx',PaidTime:0}}
  assert.equal((await service.completeOrder(delivery)).completed,true)
  assert.equal(sentEmails.length,1)
  assert.match(sentEmails[0].body.subject,/购买成功/)
  await service.completeOrder(delivery)
  assert.equal(sentEmails.length,1,'callback replay must not resend a delivered receipt')
  const notice={MchOrderId:'rt',WxRefundId:'runtime-refund',OpenId:'open',RefundFee:9900,RetCode:0}
  assert.equal((await service.applyRefund(notice)).entitlementChanged,true)
  assert.equal((await service.completeOrder(delivery)).alreadyCompleted,true)
  await assert.rejects(service.completeOrder({...delivery,GoodsInfo:{...delivery.GoodsInfo,ActualPrice:9901}}),e=>e.code==='VIRTUAL_PAYMENT_NOTIFICATION_CONFLICT')
  assert.equal((await state('runtime')).member_status,'free')
  // Real SQL ledger + public expiry + email retry: no external payment/email calls.
  await user('renewal'); await order('renew-first','renewal'); await pay('renew-first')
  await db.exec("UPDATE users SET email='renewal@example.test',username='Renewal' WHERE user_id='renewal'")
  const originalEnd=(await state('renewal')).member_expire_at
  await order('renew-second','renewal')
  await db.exec("UPDATE payment_records SET product_id='club_starter_monthly' WHERE payment_id='renew-second'")
  const renewalDelivery={...delivery,OutTradeNo:'renew-second',WeChatPayInfo:{TransactionId:'renew-tx',PaidTime:0}}
  failEmail=true
  await assert.rejects(service.completeOrder(renewalDelivery),/邮件发送失败/)
  const failedReceipt=sentEmails.at(-1)
  assert.match(failedReceipt.body.subject,/续费成功/)
  assert.match(failedReceipt.body.html,/顺延后到期时间/)
  assert.match(failedReceipt.body.html,/原到期时间/)
  failEmail=false
  await service.completeOrder(renewalDelivery)
  assert.deepEqual(sentEmails.at(-1),failedReceipt,'retry keeps receipt and idempotency key stable')
  const sentCount=sentEmails.length
  await service.completeOrder(renewalDelivery)
  assert.equal(sentEmails.length,sentCount)
  const renewalSegments=await segments('renewal')
  assert.equal(new Date(await publicExpiry('renewal')).getTime(),renewalSegments[1].ends_at.getTime())
  assert.ok(new Date(await publicExpiry('renewal')) > originalEnd)
  await refund('renew-second','renew-refund')
  assert.equal(new Date(await publicExpiry('renewal')).getTime(),originalEnd.getTime(),'refund removes only refunded renewal time')
  // Exercise the exact async helper used by the mini session/membership APIs.
  const configuredDescriptor=Object.getOwnPropertyDescriptor(helper,'isConfigured')
  Object.defineProperty(helper,'isConfigured',{configurable:true,value:true})
  const {getContinuousMembershipExpireAt}=await import('../lib/services/membership-redemption-code-service.js')
  for (const [u,type,months,start,end] of [
    ['month-end','starter',1,'2099-01-31T00:00:00Z','2099-02-28T00:00:00Z'],
    ['leap-end','starter',1,'2096-01-31T00:00:00Z','2096-02-29T00:00:00Z'],
    ['quarter-end','quarter',3,'2099-01-31T00:00:00Z','2099-04-30T00:00:00Z']
  ]) {
    await user(u)
    await db.query("UPDATE users SET member_status='active',member_type=$2,member_expire_at=$3::timestamptz WHERE user_id=$1",[u,type,start])
    await order(u+'-order',u)
    await db.query("UPDATE payment_records SET metadata=jsonb_set(metadata,'{virtualPayment,planSnapshot}',$2::jsonb) WHERE payment_id=$1",[u+'-order',JSON.stringify({memberType:type,durationMonths:months})])
    await pay(u+'-order')
    assert.equal(new Date(await getContinuousMembershipExpireAt(await state(u))).getTime(),Date.parse(end))
    await refund(u+'-order',u+'-refund')
    assert.equal(new Date(await getContinuousMembershipExpireAt(await state(u))).getTime(),Date.parse(start))
  }
  // The later lifecycle boundary must not send another activation message.
  await user('receipt-boundary'); await order('boundary-order','receipt-boundary'); await pay('boundary-order')
  await db.exec("UPDATE payment_records SET metadata=metadata || '{\"membershipPurchaseEmail\":{\"sentAt\":\"2099-01-01\"}}'::jsonb WHERE payment_id='boundary-order'")
  const {notifyMembershipActivated}=await import('../lib/services/membership-notification-service.js')
  assert.equal(await notifyMembershipActivated(await state('receipt-boundary')),false)
  Object.defineProperty(helper,'isConfigured',configuredDescriptor)
  for(const type of ['starter','quarter']) {
    const member={member_status:'active',member_type:type,member_expire_at:'2099-01-31T00:00:00Z'}
    const next={memberType:type,startsAt:member.member_expire_at,expiresAt:'2099-04-30T00:00:00Z'}
    assert.equal(continuousMembershipExpireAt(member,[next]),next.expiresAt)
    assert.equal(continuousMembershipExpireAt(member,[{...next,memberType:'half_year'}]),member.member_expire_at)
    assert.equal(continuousMembershipExpireAt(member,[{...next,startsAt:'2099-02-01T00:00:00Z'}]),member.member_expire_at)
  }
  await db.exec(`CREATE UNIQUE INDEX crm_service_unique ON member_crm_service_records(user_id, entitlement_key) WHERE archived_at IS NULL AND entitlement_key IS NOT NULL;
    CREATE TABLE member_crm_audit_log (id bigserial, target_user_id text, admin_user_id text, action text, entity_type text, entity_id text, changed_fields jsonb, metadata jsonb, created_at timestamptz);`)
  helper.getClient = () => ({
    query: (sql,params) => ({sql,params}),
    transaction: queries => db.transaction(async tx => {
      const result=[]; for(const q of queries) result.push((await tx.query(q.sql,q.params)).rows); return result
    })
  })
  const {claimMiniMemberService:claim,getMiniMemberServices:getServices} = await import('../lib/services/mini-member-service.js')
  // Real query references definition labels in production.
  await db.exec('ALTER TABLE member_service_entitlement_definitions ADD COLUMN name text, ADD COLUMN description text, ADD COLUMN sort_order int DEFAULT 0')
  const stale = await state('unused')
  assert.equal((await claim(stale,keys[0])).status,'requested')
  assert.equal((await refund('j','rj')).requiresManualReview,true)
  await assert.rejects(claim(stale,keys[1]))
  const services = await getServices(stale)
  assert.equal(services.entitlements.find(e=>e.key===keys[1]).status,'unavailable')

  await refund('j','later-failure',9900,false)
  const {paypalPaymentService:adminPayments} = await import('../lib/services/paypal-payment-service.js')
  const adminOrders = await adminPayments.listAdminOrders({status:'review_required'})
  assert.equal(adminOrders.orders.find(o=>o.paymentId==='j')?.refundRequestStatus,'review_required', 'later failed attempts cannot hide unresolved review')
  await db.exec(migration('086_wechat_refund_consistency.sql'))
  console.log('PASS PostgreSQL: payment activation/renewal, full/partial/failed refunds, callback ordering/replays/conflicts, environment isolation, queue compaction, service review/revocation/repurchase, legacy review, migration rerun. PGlite serializes transactions; no multi-connection contention claim.')
} finally { await db.close() }
