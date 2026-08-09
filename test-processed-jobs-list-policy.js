import assert from 'node:assert/strict'
import { resolveProcessedJobListStatus } from './lib/api-handlers/processed-jobs.js'

assert.equal(
  resolveProcessedJobListStatus({ requestedStatus: 'inactive' }),
  'active',
  'public default lists must not allow inactive jobs'
)
assert.equal(
  resolveProcessedJobListStatus({}),
  'active',
  'public default lists must default to active jobs'
)
assert.equal(
  resolveProcessedJobListStatus({ requestedStatus: 'inactive', isExplicitAdminList: true }),
  'inactive',
  'authenticated admin lists may explicitly inspect inactive jobs'
)
assert.equal(
  resolveProcessedJobListStatus({ requestedStatus: 'closed', id: 'job-1' }),
  'closed',
  'an explicit historical job lookup may retain its requested status'
)
assert.equal(
  resolveProcessedJobListStatus({ ids: 'job-1,job-2' }),
  undefined,
  'explicit historical job collections should not be forced into the public-list policy'
)

console.log('✅ Processed jobs list policy tests passed')
