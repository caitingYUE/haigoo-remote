import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.RESEND_API_KEY = 'test-resend-key'
process.env.SITE_URL = 'https://haigooremote.example'

const previousFetch = globalThis.fetch
const requests = []
globalThis.fetch = async (url, options) => {
  requests.push({ url, options, body: JSON.parse(options.body) })
  return { ok: true, json: async () => ({ id: `email-${requests.length}` }) }
}

try {
  const { sendMembershipRefundedEmail } = await import(`./server-utils/email-service.js?refund-email-test=${Date.now()}`)
  assert.equal(typeof sendMembershipRefundedEmail, 'function')

  await sendMembershipRefundedEmail({
    to: 'member@example.com', username: '<Test>', accountEmail: 'member@example.com',
    memberType: 'starter', paymentId: 'HG-ORDER-3137', refundAmountCents: 9900,
    refundedAt: '2026-09-09T02:21:57.665Z', membershipActive: false,
    memberExpireAt: '2026-09-09T02:21:57.665Z', idempotencyKey: 'membership-refund/HG-ORDER-3137'
  })
  await sendMembershipRefundedEmail({
    to: 'member@example.com', username: 'Test', accountEmail: 'member@example.com',
    memberType: 'starter', paymentId: 'HG-ORDER-B66E', refundAmountCents: 9900,
    refundedAt: '2026-09-09T02:21:57.665Z', membershipActive: true,
    memberExpireAt: '2026-10-09T02:21:57.665Z', idempotencyKey: 'membership-refund/HG-ORDER-B66E'
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].body.subject, '退款已完成，会员权益已失效')
  assert.match(requests[0].body.html, /退款时间/)
  assert.match(requests[0].body.html, /权益失效时间/)
  assert.match(requests[0].body.html, /hi@haigooremote\.com/)
  assert.doesNotMatch(requests[0].body.html, /<Test>/)
  assert.equal(requests[0].options.headers['Idempotency-Key'], 'membership-refund/HG-ORDER-3137')
  assert.equal(requests[1].body.subject, '退款已完成，会员有效期已调整')
  assert.match(requests[1].body.html, /调整后有效期/)
  assert.equal(requests[1].options.headers['Idempotency-Key'], 'membership-refund/HG-ORDER-B66E')

  const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js')
  const originalQuery = neonHelper.query
  let receipt = null
  try {
    neonHelper.query = async (sql, params) => {
      if (sql.includes("p.metadata->'membershipRefundEmail'")) return [{
        receipt,
        payment_status: 'refunded',
        refund_status: 'COMPLETED',
        refunded_amount_cents: 9900,
        refunded_at: '2026-09-09T02:21:57.665Z',
        email: 'member@example.com',
        username: 'Test',
        refunded_member_type: 'starter',
        membership_active: false,
        member_expire_at: '2026-09-09T02:21:57.665Z'
      }]
      if (sql.includes("'{membershipRefundEmail}'")) {
        receipt ||= JSON.parse(params[1])
        return [{ receipt }]
      }
      if (sql.includes("'{membershipRefundEmail,sentAt}'")) {
        receipt = { ...receipt, sentAt: '2026-09-09T02:22:00.000Z' }
        return []
      }
      throw new Error(`Unexpected test query: ${sql}`)
    }
    const { notifyWechatMembershipRefunded } = await import(`./lib/services/membership-notification-service.js?refund-notification-test=${Date.now()}`)
    assert.equal(await notifyWechatMembershipRefunded('HG-ORDER-NOTIFY'), true)
    assert.equal(await notifyWechatMembershipRefunded('HG-ORDER-NOTIFY'), false)
    assert.equal(requests.length, 3, 'sentAt receipt prevents duplicate sends')
    assert.equal(requests[2].options.headers['Idempotency-Key'], 'membership-refund/HG-ORDER-NOTIFY')
  } finally {
    neonHelper.query = originalQuery
  }
  const paymentSource = fs.readFileSync('lib/services/wechat-virtual-payment-service.js', 'utf8')
  assert.match(paymentSource, /row\.metadata\?\.membershipRefundEmail && !row\.metadata\.membershipRefundEmail\.sentAt/)

  console.log('PASS membership refund email: cancellation/adjustment copy, escaped content, support contact, stable idempotency key')
} finally {
  globalThis.fetch = previousFetch
}
