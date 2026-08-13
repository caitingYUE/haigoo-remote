import assert from 'node:assert/strict'
import { getWebsiteApplyCycle, getWebsiteApplyPeriodKey, getWebsiteApplyState } from './lib/api-handlers/free-usage.js'

const registeredAt = '2026-08-13T02:30:00.000Z'
const registrationUser = { created_at: registeredAt }
const firstCycleKey = registeredAt
const secondCycleKey = '2026-09-12T02:30:00.000Z'

assert.deepEqual(getWebsiteApplyCycle(registrationUser, new Date('2026-08-20T00:00:00.000Z')), {
  periodKey: firstCycleKey,
  cycleStartedAt: firstCycleKey,
  nextResetAt: secondCycleKey,
})
assert.equal(getWebsiteApplyPeriodKey(registrationUser, new Date('2026-09-12T02:29:59.999Z')), firstCycleKey)
assert.equal(getWebsiteApplyPeriodKey(registrationUser, new Date('2026-09-12T02:30:00.000Z')), secondCycleKey)

const currentState = getWebsiteApplyState({
  ...registrationUser,
  free_website_apply_count: 3,
  free_website_apply_job_ids: ['job-a', 'job-b', 'job-c'],
  free_website_apply_period_key: firstCycleKey,
}, new Date('2026-08-20T00:00:00.000Z'))

assert.deepEqual(currentState, {
  usage: 3,
  unlockedJobIds: ['job-a', 'job-b', 'job-c'],
  periodKey: firstCycleKey,
  cycleStartedAt: firstCycleKey,
  nextResetAt: secondCycleKey,
})

const rolledState = getWebsiteApplyState({
  ...registrationUser,
  free_website_apply_count: 20,
  free_website_apply_job_ids: ['legacy-job'],
  free_website_apply_period_key: firstCycleKey,
}, new Date('2026-09-12T02:30:00.000Z'))

assert.deepEqual(rolledState, {
  usage: 0,
  unlockedJobIds: [],
  periodKey: secondCycleKey,
  cycleStartedAt: secondCycleKey,
  nextResetAt: '2026-10-12T02:30:00.000Z',
})

const legacyCalendarMonthState = getWebsiteApplyState({
  ...registrationUser,
  free_website_apply_count: 20,
  free_website_apply_job_ids: ['legacy-job'],
  free_website_apply_period_key: '2026-08',
}, new Date('2026-08-20T00:00:00.000Z'))

assert.deepEqual(legacyCalendarMonthState, {
  usage: 0,
  unlockedJobIds: [],
  periodKey: firstCycleKey,
  cycleStartedAt: firstCycleKey,
  nextResetAt: secondCycleKey,
})

const profileFallbackState = getWebsiteApplyState({
  ...registrationUser,
  profile: {
    preferences: {
      freeUsage: {
        websiteApply: {
          count: 2,
          unlockedJobIds: ['job-new-a', 'job-new-b'],
          periodKey: firstCycleKey,
        },
      },
    },
  },
}, new Date('2026-08-20T00:00:00.000Z'))

assert.deepEqual(profileFallbackState, {
  usage: 2,
  unlockedJobIds: ['job-new-a', 'job-new-b'],
  periodKey: firstCycleKey,
  cycleStartedAt: firstCycleKey,
  nextResetAt: secondCycleKey,
})

console.log('Registration-anchored 30-day website-apply quota tests passed')
