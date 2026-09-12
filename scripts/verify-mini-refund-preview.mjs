import fs from 'node:fs'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import {neon} from '@neondatabase/serverless'
const file=process.argv.find(a=>a.startsWith('--env-file='))?.slice(11)
const env=file?dotenv.parse(fs.readFileSync(file)):process.env
if(env.VERCEL_ENV!=='preview'||!env.DATABASE_URL)throw Error('Preview only')
const sql=neon(env.DATABASE_URL)
const id=crypto.randomUUID()
// Every fixture write is rolled back by a caught subtransaction exception; never calls WeChat.
try {
 await sql.query(`DO $$
 DECLARE r jsonb;
 BEGIN
  BEGIN
   INSERT INTO users(user_id,email,username,auth_provider,status,member_status,member_type,membership_level)
    VALUES ('${id}','${id}@refund-test.invalid','Refund regression fixture','mini_smoke','active','free','none','free');
   INSERT INTO payment_records(payment_id,user_id,amount,currency,payment_method,status,provider,app_id,openid,product_id,expected_amount_cents,plan_id,metadata)
    VALUES ('${id}','${id}',99,'CNY','wechat_virtual','pending','wechat_virtual','test-app','test-open','monthly',9900,'club_starter_monthly',
     '{"virtualPayment":{"env":1,"planSnapshot":{"memberType":"starter","durationMonths":1}}}');
   r := complete_wechat_virtual_payment('${id}','${id}',9900,'{"Env":1,"OpenId":"test-open","GoodsInfo":{"ProductId":"monthly"}}','test-app');
   IF r->>'success' <> 'true' OR NOT EXISTS (SELECT 1 FROM users WHERE user_id='${id}' AND member_status='active') THEN
     RAISE EXCEPTION 'Payment fixture activation failed'; END IF;
   r := apply_wechat_virtual_refund('${id}','${id}',9900,true,'{"Env":1,"OpenId":"test-open"}',NOW());
   IF r->>'entitlementChanged' <> 'true' OR NOT EXISTS (SELECT 1 FROM users WHERE user_id='${id}' AND member_status='free') THEN
     RAISE EXCEPTION 'Refund fixture revocation failed'; END IF;
   r := apply_wechat_virtual_refund('${id}','${id}',9900,true,'{"Env":1,"OpenId":"test-open"}',NOW());
   IF r->>'alreadyProcessed' <> 'true' THEN RAISE EXCEPTION 'Refund fixture replay failed'; END IF;
   RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='fixture rollback';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
 END $$`)
 const rows=await sql.query('SELECT COUNT(*)::int AS n FROM users WHERE user_id=$1',[id])
 if(rows[0].n!==0)throw Error('Fixture cleanup failed')
 console.log('PASS Preview actual schema: payment activation, refund revocation, replay idempotence; fixture subtransaction rolled back.')
} catch(error) {console.error('Preview refund verification failed:',error.code||'unknown',error.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1}
