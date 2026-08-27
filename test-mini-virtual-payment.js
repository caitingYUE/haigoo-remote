import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

process.env.WECHAT_MESSAGE_TOKEN = 'test-message-token'
process.env.WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON = JSON.stringify({
  mini_club_quarter_2026: 'club_quarter',
  mini_club_half_year_2026: 'club_half_year'
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
  mini_club_quarter_2026: 'club_quarter',
  mini_club_half_year_2026: 'club_half_year'
})
assert.deepEqual(EXPECTED_PLAN_AMOUNTS, {
  mini_club_quarter_2026: 19900,
  mini_club_half_year_2026: 69900
})
assert.deepEqual(
  Object.fromEntries(Object.entries(VIRTUAL_PAYMENT_PRODUCTS.mini_club_quarter_2026).filter(([key]) => ['productId', 'amountCents', 'memberType', 'durationMonths', 'durationDays'].includes(key))),
  { productId: 'club_quarter', amountCents: 19900, memberType: 'quarter', durationMonths: 3, durationDays: 0 }
)
assert.equal(VIRTUAL_PAYMENT_PRODUCTS.mini_club_half_year_2026.productId, 'club_half_year')
assert.equal(VIRTUAL_PAYMENT_PRODUCTS.mini_club_half_year_2026.amountCents, 69900)
assert.equal(VIRTUAL_PAYMENT_PRODUCTS.mini_club_half_year_2026.durationMonths, 6)
assert.doesNotThrow(() => ensurePurchaseEligible({
  member_status: 'active', member_type: 'half_year',
  member_expire_at: '2099-12-31T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.mini_club_half_year_2026))
assert.throws(() => ensurePurchaseEligible({
  member_status: 'active', member_type: 'half_year',
  member_expire_at: '2099-12-31T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.mini_club_quarter_2026), (error) => (
  error?.statusCode === 409 &&
  error?.code === 'VIRTUAL_PAYMENT_PLAN_CHANGE_NOT_SUPPORTED'
))
assert.doesNotThrow(() => ensurePurchaseEligible({
  member_status: 'inactive',
  member_type: 'annual',
  member_expire_at: '2020-01-01T00:00:00.000Z'
}, VIRTUAL_PAYMENT_PRODUCTS.mini_club_quarter_2026))

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
  query: { signature: `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`, timestamp, nonce }
}), false)

process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET = 'test-relay-secret'
const relayNotification = {
  Event: 'xpay_goods_deliver_notify',
  Env: 1,
  GoodsInfo: { ProductId: 'club_quarter', Quantity: 1 }
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
    'x-haigoo-payment-relay-signature': `${sandboxRelaySignature.slice(0, -1)}${sandboxRelaySignature.endsWith('0') ? '1' : '0'}`
  }
}, relayNotification), false)

const cloudrun = fs.readFileSync(new URL('./cloudrun/index.mjs', import.meta.url), 'utf8')
const miniClient = fs.readFileSync(new URL('./miniprogram/src/services/virtual-payment-service.ts', import.meta.url), 'utf8')
const membershipPage = fs.readFileSync(new URL('./miniprogram/src/pages/membership/index.tsx', import.meta.url), 'utf8')
const orderCenter = fs.readFileSync(new URL('./miniprogram/src/pages/payment-orders/index.tsx', import.meta.url), 'utf8')
const paymentService = fs.readFileSync(new URL('./lib/services/wechat-virtual-payment-service.js', import.meta.url), 'utf8')
const paymentSetup = fs.readFileSync(new URL('./docs/wechat-virtual-payment-setup.md', import.meta.url), 'utf8')
const envExample = fs.readFileSync(new URL('./.env.example', import.meta.url), 'utf8')

assert.ok(cloudrun.includes('requestVirtualPayment&${signData}'), 'paySig must bind the API method and the exact signData string')
assert.ok(cloudrun.includes('virtualPaymentSignature(login.sessionKey, signData)'), 'session_key must sign the exact signData string')
assert.ok(miniClient.includes("mode: 'short_series_goods'"), 'the client must use direct virtual-goods mode')
assert.ok(miniClient.includes("order.status === 'completed'"), 'client success must be followed by server order confirmation')
assert.ok(membershipPage.includes('开通${selectedPlan.shortLabel}') && membershipPage.includes('purchase(selectedPlan)'), 'supported environments must expose the official in-app purchase entry for the selected server plan')
assert.ok(membershipPage.includes('paymentAvailable') && membershipPage.includes('isVirtualPaymentSupported'), 'purchase buttons must require server and device capability')
assert.ok(membershipPage.includes('暂时无法购买'), 'unsupported environments must hide payment and explain the safe fallback')
assert.ok(!membershipPage.includes('openOfficialAccount') && !membershipPage.includes('setClipboardData'), 'the release must not route purchases around official payment')
assert.ok(orderCenter.includes('getVirtualPaymentOrders'), 'users must have an in-app order history')
assert.ok(orderCenter.includes('支付成功') && orderCenter.includes('已退款'), 'the order center must distinguish terminal payment states')
assert.ok(orderCenter.includes('已取消'), 'the order center must show client-cancelled orders honestly')
assert.ok(miniClient.includes("cancelled ? 'cancelled' : 'failed'"), 'the client must report terminal payment invocation results')
assert.ok(paymentService.includes("status IN ('pending', 'cancelled', 'failed')"), 'a late verified callback must still complete a client-cancelled order')
assert.ok(paymentService.includes('memberType !== catalogPlan.memberType') && paymentService.includes('durationMonths !== catalogPlan.durationMonths'), 'callback must validate the catalog member type and duration')
assert.ok(paymentService.includes('Number(payment.paid_amount_cents || 0) !== paidAmountCents'), 'completed callbacks must reject conflicting amounts')
assert.match(paymentSetup, /mini_club_quarter_2026[\s\S]*19900/)
assert.match(paymentSetup, /mini_club_half_year_2026[\s\S]*69900/)
assert.match(paymentSetup, /mini_club_quarter_2026[\s\S]*club_quarter/)
assert.match(paymentSetup, /mini_club_half_year_2026[\s\S]*club_half_year/)
assert.ok(!/\|\s*`(?:club_starter_monthly|club_annual)`/.test(paymentSetup), 'payment setup must not instruct operators to create retired products')
assert.match(envExample, /"mini_club_quarter_2026":"club_quarter"/)

console.log('mini virtual-payment checks passed')
