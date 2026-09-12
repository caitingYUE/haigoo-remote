import assert from 'node:assert/strict'
import handler, {messageSignature, relaySignature} from './api/wechat-virtual-payment-notify.js'
import {wechatVirtualPaymentService as service} from './lib/services/wechat-virtual-payment-service.js'
import neonHelper from './server-utils/dal/neon-helper.js'
process.env.WECHAT_MESSAGE_TOKEN='test-token'
process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET='test-secret'
process.env.WECHAT_VIRTUAL_PAYMENT_SANDBOX_CALLBACK_ORIGIN='https://preview.example.test'
const previousFetch=globalThis.fetch
const originalEnvironment=service.getRefundEnvironment
const original=service.applyRefund
const originalQuery=neonHelper.query
let forwarded=0, applied=0
const body={Event:'xpay_refund_notify',Env:1,MchOrderId:'test',WxRefundId:'refund',OpenId:'open',RefundFee:9900,RetCode:0}
const invoke=async (notification,relay=false,valid=true)=>{
 const timestamp=String(Date.now()),nonce='n'
 const req={method:'POST',body:notification,query:relay?{}:{timestamp,nonce,signature:valid?messageSignature('test-token',timestamp,nonce):'bad'},headers:relay?{
  'x-haigoo-payment-relay-timestamp':timestamp,'x-haigoo-payment-relay-signature':relaySignature('test-secret',timestamp,notification)
 }: {}}
 const res={status(n){this.statusCode=n;return this},json(payload){this.payload=payload;return this}}
 await handler(req,res);return res
}
try{
 service.applyRefund=async ()=>{applied++;return {success:true}}
 service.getRefundEnvironment=async()=>1
 globalThis.fetch=async (url,options)=>{assert.equal(url,'https://preview.example.test/api/wechat-virtual-payment-notify');assert.deepEqual(JSON.parse(options.body),body);forwarded++;return {ok:true,json:async()=>({ErrCode:0})}}
 process.env.VERCEL_ENV='production'
 assert.equal((await invoke(body)).statusCode,200);assert.equal(forwarded,1);assert.equal(applied,0)
 assert.equal((await invoke(body,true)).statusCode,400)
 process.env.VERCEL_ENV='preview'
 assert.equal((await invoke(body,true)).statusCode,200);assert.equal(applied,1)
 assert.equal((await invoke({...body,Env:0})).statusCode,400)
 assert.equal((await invoke({...body,Env:null})).statusCode,200)
 assert.equal((await invoke(body,false,false)).statusCode,401)
 service.getRefundEnvironment=async()=>null
 process.env.VERCEL_ENV='production'
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'https://preview.example.test/api/wechat-virtual-payment-notify')
  assert.equal(JSON.parse(options.body).Env,undefined)
  forwarded++
  return {ok:true,json:async()=>({ErrCode:0})}
 }
 assert.equal((await invoke({...body,Env:undefined})).statusCode,200)
 service.getRefundEnvironment=originalEnvironment
 process.env.VERCEL_ENV='preview'
 service.applyRefund=async()=>{throw Error('test db failure')}
 assert.equal((await invoke(body,true)).statusCode,500)
 assert.equal((await invoke({...body,Event:'xpay_complaint_notify'})).statusCode,200)
 process.env.VERCEL_ENV='production'
 globalThis.fetch=async()=>({ok:true,json:async()=>({})})
 assert.equal((await invoke(body)).statusCode,500,'relay must not acknowledge an invalid response')
 service.applyRefund=original
 for(const patch of [{OpenId:undefined},{RetCode:null},{RetCode:''},{RetCode:'bad'},{Env:2},{RefundFee:undefined},{RefundFee:-1},{RefundFee:1.2}]){
  await assert.rejects(service.applyRefund({...body,...patch}),e=>e.code==='INVALID_VIRTUAL_PAYMENT_REFUND_NOTIFICATION')
 }
 let orderMetadata={virtualPayment:{env:1}}
 neonHelper.query=async (sql,params)=>sql.includes('FROM payment_records')?[{
  payment_id:'test',payment_method:'wechat_virtual',app_id:'test-app',openid:'open',currency:'CNY',
  metadata:orderMetadata
 }]:[{result:{success:true,entitlementChanged:true,notification:JSON.parse(params[4])}}]
 process.env.WECHAT_MINI_APP_ID='test-app'
 const withoutEnvironment=await service.applyRefund({...body,Env:undefined})
 assert.equal(withoutEnvironment.success,true)
 assert.equal(withoutEnvironment.notification.OpenId,'open')
 assert.equal(withoutEnvironment.notification.Env,1)
 orderMetadata={}
 assert.equal(await service.getRefundEnvironment(body),null)
 await assert.rejects(service.applyRefund(body),e=>e.code==='VIRTUAL_PAYMENT_REFUND_ORDER_ENVIRONMENT_MISSING')
 orderMetadata={virtualPayment:{env:1}}
 const failedWithZeroAmount=await service.applyRefund({...body,RetCode:1,RefundFee:0,WxRefundId:'failed-zero-amount'})
 assert.equal(failedWithZeroAmount.success,true)
 assert.equal(failedWithZeroAmount.notification.RefundFee,0)
 console.log('PASS refund callback: authenticated routing, Preview isolation, relay loop/invalid response, retry on failure, complaint no-op, malformed fields')
} finally {globalThis.fetch=previousFetch;service.applyRefund=original;service.getRefundEnvironment=originalEnvironment;neonHelper.query=originalQuery}
