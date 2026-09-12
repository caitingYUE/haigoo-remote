import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import {
  createVirtualPaymentReconciler,
  isRefundReconciliationCandidate,
  virtualPaymentQuerySignature
} from './cloudrun/virtual-payment-reconciliation.mjs'
import { wechatVirtualPaymentService as service } from './lib/services/wechat-virtual-payment-service.js'
import neonHelper from './server-utils/dal/neon-helper.js'

assert.equal(isRefundReconciliationCandidate({ status: 'completed' }), true)
assert.equal(isRefundReconciliationCandidate({ status: 'partially_refunded' }), true)
assert.equal(isRefundReconciliationCandidate({ status: 'refunded' }), false)
assert.equal(isRefundReconciliationCandidate({ status: 'pending' }), false)

const appKey = 'sandbox-app-key-for-tests'
const expectedBody = JSON.stringify({ openid: 'openid-1', env: 1, order_id: 'payment-1' })
assert.equal(
  virtualPaymentQuerySignature(appKey, expectedBody),
  crypto.createHmac('sha256', appKey).update(`/xpay/query_order&${expectedBody}`).digest('hex')
)

let tokenRequests = 0
let orderRequests = 0
const persisted = []
const providerOrders = new Map([
  ['payment-paid', { status: 4, order_type: 0, paid_fee: 9900, left_fee: 9900 }],
  ['payment-partial', { status: 4, order_type: 0, paid_fee: 9900, left_fee: 7900 }],
  ['payment-full', { status: 5, order_type: 0, paid_fee: 9900, left_fee: 0 }]
])
const reconciler = createVirtualPaymentReconciler({
  appId: 'test-app', appSecret: 'test-secret', appKey, env: 1,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/cgi-bin/stable_token')) {
      tokenRequests += 1
      return { ok: true, json: async () => ({ access_token: 'access-token', expires_in: 7200 }) }
    }
    orderRequests += 1
    const body = String(options.body)
    const request = JSON.parse(body)
    const params = new URL(url).searchParams
    assert.equal(params.get('access_token'), 'access-token')
    assert.equal(params.get('pay_sig'), virtualPaymentQuerySignature(appKey, body))
    return { ok: true, json: async () => ({ errcode: 0, order: {
      order_id: request.order_id, env_type: 2, ...providerOrders.get(request.order_id)
    } }) }
  }
})
const candidate = (paymentId) => ({ paymentId, openid: 'openid-1', status: 'completed', refundedAmountCents: 0 })
const outcomes = await Promise.all([...providerOrders.keys()].map((paymentId) =>
  reconciler.reconcile(candidate(paymentId), async (snapshot) => {
    persisted.push(snapshot)
    return { changed: true }
  })))
assert.deepEqual(outcomes, [false, false, true], 'only provider-confirmed full refunds use fallback persistence')
assert.equal(tokenRequests, 1, 'concurrent queries share one access-token request')
assert.equal(orderRequests, 3)
assert.deepEqual(persisted[0], {
  openid: 'openid-1', paymentId: 'payment-full', env: 1, providerStatus: 5,
  paidFee: 9900, leftFee: 0, queriedAt: persisted[0].queriedAt
})
assert.equal(await reconciler.reconcile(candidate('payment-full'), async () => ({ changed: true })), false)

let authTokenRequests = 0
let authOrderRequests = 0
const authRetry = createVirtualPaymentReconciler({
  appId: 'test-app', appSecret: 'test-secret', appKey, env: 1,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/cgi-bin/stable_token')) {
      authTokenRequests += 1
      return { ok: true, json: async () => ({ access_token: `token-${authTokenRequests}`, expires_in: 7200 }) }
    }
    authOrderRequests += 1
    if (authOrderRequests === 1) return { ok: true, status: 200, json: async () => ({ errcode: 40014 }) }
    const request = JSON.parse(options.body)
    return { ok: true, json: async () => ({ errcode: 0, order: {
      order_id: request.order_id, env_type: 2, order_type: 0, status: 5, paid_fee: 9900, left_fee: 0
    } }) }
  }
})
assert.equal(await authRetry.reconcile(candidate('payment-auth'), async () => ({ changed: true })), true)
assert.equal(authTokenRequests, 2)
assert.equal(authOrderRequests, 2)

for (const invalidOrder of [
  null,
  { order_id: 'other', env_type: 2, order_type: 0, status: 5, paid_fee: 9900, left_fee: 0 },
  { order_id: 'payment-invalid', env_type: 1, order_type: 0, status: 5, paid_fee: 9900, left_fee: 0 },
  { order_id: 'payment-invalid', env_type: 2, order_type: 1, status: 5, paid_fee: 9900, left_fee: 0 },
  { order_id: 'payment-invalid', env_type: 2, order_type: 0, status: 5, paid_fee: 9900, left_fee: 10000 }
]) {
  const strict = createVirtualPaymentReconciler({
    appId: 'test-app', appSecret: 'test-secret', appKey, env: 1,
    fetchImpl: async (url) => url.endsWith('/cgi-bin/stable_token')
      ? { ok: true, json: async () => ({ access_token: 'token', expires_in: 7200 }) }
      : { ok: true, json: async () => ({ errcode: 0, order: invalidOrder }) }
  })
  await assert.rejects(strict.reconcile(candidate('payment-invalid'), async () => ({ changed: true })))
}

const originalQuery = neonHelper.query
process.env.WECHAT_MINI_APP_ID = 'test-app'
let sqlCall
try {
  neonHelper.query = async (sql, params) => {
    if (sql.includes('FROM payment_records')) return [{
      payment_id: 'payment-1', user_id: 'user-1', payment_method: 'wechat_virtual', provider: 'wechat_virtual',
      status: 'completed', app_id: 'test-app', openid: 'openid-1', currency: 'CNY', paid_amount_cents: 9900,
      refunded_amount_cents: 0, metadata: { virtualPayment: { env: 1 } }
    }]
    sqlCall = { sql, params }
    return [{ result: { success: true, changed: true, entitlementChanged: true } }]
  }
  const result = await service.reconcileRefund({
    paymentId: 'payment-1', userId: 'user-1', openid: 'openid-1', env: 1,
    providerStatus: 5, paidFee: 9900, leftFee: 0, queriedAt: new Date().toISOString()
  })
  assert.equal(result.changed, true)
  assert.match(sqlCall.sql, /reconcile_wechat_virtual_refund_total/)
  assert.equal(sqlCall.params[1], 9900)
  assert.equal(JSON.parse(sqlCall.params[2]).ProviderRefundTotal, 9900)
  await assert.rejects(service.reconcileRefund({
    paymentId: 'payment-1', userId: 'user-1', openid: 'openid-1', env: 0,
    providerStatus: 5, paidFee: 9900, leftFee: 0
  }), (error) => error.code === 'VIRTUAL_PAYMENT_REFUND_RECONCILIATION_MISMATCH')
} finally {
  neonHelper.query = originalQuery
}

const cloudrunSource = fs.readFileSync('cloudrun/index.mjs', 'utf8')
const gatewaySource = fs.readFileSync('lib/api-handlers/mini-gateway.js', 'utf8')
const deploySource = fs.readFileSync('scripts/deploy-mini-cloudrun.mjs', 'utf8')
const migrationSource = fs.readFileSync('server-utils/dal/migrations/087_wechat_refund_provider_reconciliation.sql', 'utf8')
assert.match(cloudrunSource, /session refund reconciliation deferred/)
assert.match(cloudrunSource, /gatewayRequest\('virtual_payment_reconcile_refund'/)
assert.match(gatewaySource, /handleVirtualPaymentRefundReconciliation/)
assert.match(deploySource, /virtual-payment-reconciliation\.mjs/)
assert.match(migrationSource, /payment_id = p_payment_id FOR UPDATE/)
assert.match(migrationSource, /REFUND_RECONCILIATION_CONFLICT/)
assert.match(migrationSource, /backfill_current_wechat_payment_segment/)
assert.match(migrationSource, /SELECT \* INTO v_current[\s\S]*WHERE segment_id = NEW\.segment_id/)
assert.match(migrationSource, /v_current\.superseded_at IS NOT NULL/)
assert.match(migrationSource, /reconciled_duplicate/)

console.log('PASS refund reconciliation: strict provider identity, full-refund fallback, token retry/cache, signed session path, locked cumulative persistence')
