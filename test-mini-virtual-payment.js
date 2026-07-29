import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

process.env.WECHAT_MESSAGE_TOKEN = 'test-message-token'
process.env.WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON = JSON.stringify({
  club_starter_monthly: 'club_starter',
  club_half_year: 'club_member',
  club_annual: 'club_partner'
})

const {
  EXPECTED_PLAN_AMOUNTS,
  parseProductMap
} = await import('./lib/services/wechat-virtual-payment-service.js')
const {
  hasValidSignature,
  messageSignature
} = await import('./api/wechat-virtual-payment-notify.js')

assert.deepEqual(parseProductMap(), {
  club_starter_monthly: 'club_starter',
  club_half_year: 'club_member',
  club_annual: 'club_partner'
})
assert.deepEqual(EXPECTED_PLAN_AMOUNTS, {
  club_starter_monthly: 9900,
  club_half_year: 49900,
  club_annual: 99800
})

const timestamp = '1785290000'
const nonce = 'virtual-payment-test'
const signature = messageSignature(process.env.WECHAT_MESSAGE_TOKEN, timestamp, nonce)
assert.equal(
  signature,
  crypto.createHash('sha1').update([
    process.env.WECHAT_MESSAGE_TOKEN,
    timestamp,
    nonce
  ].sort().join('')).digest('hex')
)
assert.equal(hasValidSignature({
  query: { signature, timestamp, nonce }
}), true)
assert.equal(hasValidSignature({
  query: { signature: `${signature.slice(0, -1)}0`, timestamp, nonce }
}), false)

const cloudrun = fs.readFileSync(new URL('./cloudrun/index.mjs', import.meta.url), 'utf8')
const miniClient = fs.readFileSync(new URL('./miniprogram/src/services/virtual-payment-service.ts', import.meta.url), 'utf8')
const membershipPage = fs.readFileSync(new URL('./miniprogram/src/pages/learning/index.tsx', import.meta.url), 'utf8')

assert.ok(cloudrun.includes('requestVirtualPayment&${signData}'), 'paySig must bind the API method and the exact signData string')
assert.ok(cloudrun.includes('virtualPaymentSignature(login.sessionKey, signData)'), 'session_key must sign the exact signData string')
assert.ok(miniClient.includes("mode: 'short_series_goods'"), 'the client must use direct virtual-goods mode')
assert.ok(miniClient.includes("order.status === 'completed'"), 'client success must be followed by server order confirmation')
assert.ok(membershipPage.includes('立即开通'), 'Club plans must expose the official in-app purchase entry')
assert.ok(!membershipPage.includes('当前版本暂不支持小程序内支付'), 'the release must not direct purchases around official payment')

console.log('mini virtual-payment checks passed')
