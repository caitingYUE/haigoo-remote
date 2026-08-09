import assert from 'node:assert/strict'
import { paypalPaymentService, normalizeIdempotencyKey, safeProviderSnapshot } from './lib/services/paypal-payment-service.js'

const uuid = '1be7b49f-0fcb-4f1f-8c90-4943950e245a'
assert.equal(normalizeIdempotencyKey(uuid.toUpperCase()), uuid)
assert.throws(() => normalizeIdempotencyKey('not-a-uuid'), /请求标识无效/)

const order = {
  expected_amount_cents: 10_000,
  refunded_amount_cents: 0,
  entitlement_starts_at: '2026-01-01T00:00:00.000Z',
  entitlement_ends_at: '2026-01-11T00:00:00.000Z'
}
assert.equal(paypalPaymentService.refundEstimateFor(order, new Date('2025-12-31T00:00:00.000Z')), 10_000)
assert.equal(paypalPaymentService.refundEstimateFor(order, new Date('2026-01-06T00:00:00.000Z')), 5_000)
assert.equal(paypalPaymentService.refundEstimateFor(order, new Date('2026-01-11T00:00:00.000Z')), 0)
assert.equal(paypalPaymentService.refundEstimateFor({ ...order, refunded_amount_cents: 7_000 }, new Date('2026-01-02T00:00:00.000Z')), 3_000)

const snapshot = safeProviderSnapshot({
  id: 'CAPTURE-1', status: 'COMPLETED', payer: { email_address: 'private@example.com' },
  amount: { currency_code: 'CNY', value: '99.00' }, supplementary_data: { related_ids: { order_id: 'ORDER-1' } }
})
assert.deepEqual(snapshot, {
  id: 'CAPTURE-1', status: 'COMPLETED',
  amount: { currency_code: 'CNY', value: '99.00' },
  create_time: null, update_time: null,
  supplementary_data: { related_ids: { order_id: 'ORDER-1' } }
})
assert.equal('payer' in snapshot, false)

console.log('PayPal payment tests passed')
