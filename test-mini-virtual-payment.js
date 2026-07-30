import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

process.env.WECHAT_MESSAGE_TOKEN = 'test-message-token'
process.env.WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON = JSON.stringify({
  club_starter_monthly: 'club_starter_monthly',
  club_half_year: 'club_half_year',
  club_annual: 'club_annual'
})

const {
  EXPECTED_PLAN_AMOUNTS,
  VIRTUAL_PAYMENT_PRODUCTS,
  ensurePurchaseEligible,
  parseProductMap
} = await import('./lib/services/wechat-virtual-payment-service.js')
const {
  hasValidRelaySignature,
  hasValidSignature,
  messageSignature,
  relaySignature
} = await import('./api/wechat-virtual-payment-notify.js')

assert.deepEqual(parseProductMap(), {
  club_starter_monthly: 'club_starter_monthly',
  club_half_year: 'club_half_year',
  club_annual: 'club_annual'
})
assert.deepEqual(EXPECTED_PLAN_AMOUNTS, {
  club_starter_monthly: 9900,
  club_half_year: 49900,
  club_annual: 99800
})
assert.deepEqual(VIRTUAL_PAYMENT_PRODUCTS.club_starter_monthly, {
  productId: 'club_starter_monthly',
  amountCents: 9900,
  memberType: 'starter',
  durationMonths: 0,
  durationDays: 30
})
assert.doesNotThrow(() => ensurePurchaseEligible({
  member_status: 'active',
  member_type: 'annual',
  member_expire_at: '2099-12-31T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.club_annual))
assert.throws(() => ensurePurchaseEligible({
  member_status: 'active',
  member_type: 'annual',
  member_expire_at: '2099-12-31T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.club_starter_monthly), (error) => (
  error?.statusCode === 409 &&
  error?.code === 'VIRTUAL_PAYMENT_PLAN_CHANGE_NOT_SUPPORTED'
))
assert.doesNotThrow(() => ensurePurchaseEligible({
  member_status: 'inactive',
  member_type: 'annual',
  member_expire_at: '2020-01-01T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.club_starter_monthly))

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

process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET = 'test-relay-secret'
const relayNotification = {
  Event: 'xpay_goods_deliver_notify',
  Env: 1,
  GoodsInfo: { ProductId: 'club_starter_monthly', Quantity: 1 }
}
const relayTimestamp = String(Date.now())
const sandboxRelaySignature = relaySignature(
  process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET,
  relayTimestamp,
  relayNotification
)
assert.equal(hasValidRelaySignature({
  headers: {
    'x-haigoo-payment-relay-timestamp': relayTimestamp,
    'x-haigoo-payment-relay-signature': sandboxRelaySignature
  }
}, relayNotification), true)
assert.equal(hasValidRelaySignature({
  headers: {
    'x-haigoo-payment-relay-timestamp': relayTimestamp,
    'x-haigoo-payment-relay-signature': `${sandboxRelaySignature.slice(0, -1)}0`
  }
}, relayNotification), false)

const cloudrun = fs.readFileSync(new URL('./cloudrun/index.mjs', import.meta.url), 'utf8')
const miniClient = fs.readFileSync(new URL('./miniprogram/src/services/virtual-payment-service.ts', import.meta.url), 'utf8')
const membershipPage = fs.readFileSync(new URL('./miniprogram/src/pages/learning/index.tsx', import.meta.url), 'utf8')
const orderCenter = fs.readFileSync(new URL('./miniprogram/src/pages/payment-orders/index.tsx', import.meta.url), 'utf8')

assert.ok(cloudrun.includes('requestVirtualPayment&${signData}'), 'paySig must bind the API method and the exact signData string')
assert.ok(cloudrun.includes('virtualPaymentSignature(login.sessionKey, signData)'), 'session_key must sign the exact signData string')
assert.ok(miniClient.includes("mode: 'short_series_goods'"), 'the client must use direct virtual-goods mode')
assert.ok(miniClient.includes("order.status === 'completed'"), 'client success must be followed by server order confirmation')
assert.ok(membershipPage.includes('立即开通'), 'Club plans must expose the official in-app purchase entry')
assert.ok(!membershipPage.includes('当前版本暂不支持小程序内支付'), 'the release must not direct purchases around official payment')
assert.ok(orderCenter.includes('getVirtualPaymentOrders'), 'users must have an in-app order history')
assert.ok(orderCenter.includes('支付成功') && orderCenter.includes('已退款'), 'the order center must distinguish terminal payment states')

console.log('mini virtual-payment checks passed')
