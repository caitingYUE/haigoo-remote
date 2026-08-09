import assert from 'node:assert/strict'
import { buildAttentionReasons, deriveMembershipState, isConfirmedApplication } from './api/admin/member-crm.js'

const now = new Date('2026-08-09T00:00:00.000Z')

assert.equal(deriveMembershipState({ member_status: 'active', member_cycle_start_at: '2026-08-10T00:00:00.000Z', member_expire_at: '2026-09-10T00:00:00.000Z' }, now), 'pending')
assert.equal(deriveMembershipState({ member_status: 'active', member_cycle_start_at: '2026-07-01T00:00:00.000Z', member_expire_at: '2027-01-01T00:00:00.000Z' }, now), 'active')
assert.equal(deriveMembershipState({ member_status: 'active', member_cycle_start_at: '2026-07-01T00:00:00.000Z', member_expire_at: '2026-08-20T00:00:00.000Z' }, now), 'expiring')
assert.equal(deriveMembershipState({ member_status: 'expired', member_cycle_start_at: '2026-01-01T00:00:00.000Z', member_expire_at: '2026-06-01T00:00:00.000Z' }, now), 'expired')
assert.equal(deriveMembershipState({ member_status: 'active', member_cycle_start_at: '2026-09-01T00:00:00.000Z', member_expire_at: '2026-08-01T00:00:00.000Z' }, now), 'anomaly')

const attention = buildAttentionReasons({
  membershipState: 'anomaly',
  hasServicePlan: false,
  nextFollowUpAt: '2020-01-01T00:00:00.000Z',
  unavailableRecommendationCount: 2
})
assert.deepEqual(attention, ['会员日期异常', '缺少服务方案', '跟进已逾期', '2 个推荐岗位失效'])

assert.equal(isConfirmedApplication({ interaction_type: 'apply_redirect', status: 'entry_opened' }), false)
assert.equal(isConfirmedApplication({ interaction_type: 'pending_apply', status: 'pending_apply' }), false)
assert.equal(isConfirmedApplication({ interaction_type: 'pending_apply', status: 'applied' }), true)
assert.equal(isConfirmedApplication({ interaction_type: 'referral', status: 'applied' }), true)
assert.equal(isConfirmedApplication({ current_status: 'interviewing' }), true)

console.log('Member CRM status policy tests passed')
