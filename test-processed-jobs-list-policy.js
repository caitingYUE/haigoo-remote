import assert from 'node:assert/strict'
import {
  applyRankedJobDiversityPolicy,
  isDirectEntitySearch,
  resolveProcessedJobListStatus
} from './lib/api-handlers/processed-jobs.js'

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

const rankedJobs = [
  { id: 'wave-1', company: 'Wave', title: 'Senior Product Manager' },
  { id: 'wave-2', company: 'Wave', title: 'Product Designer' },
  { id: 'wave-3', company: 'Wave', title: 'Risk Analyst' },
  { id: 'wave-4', company: 'Wave', title: 'Lifecycle Marketing Manager' },
  { id: 'atria-1', company: 'Atria', title: 'Product Manager' },
  { id: 'remote-1', company: 'Remote', title: 'Product Designer' },
  { id: 'stripe-1', company: 'Stripe', title: 'Product Lead' }
]

assert.equal(
  isDirectEntitySearch({ search: 'wave' }, rankedJobs),
  true,
  'an exact company-name query should be treated as a direct entity search'
)

assert.deepEqual(
  applyRankedJobDiversityPolicy(rankedJobs, { search: 'wave' }).slice(0, 4).map(job => job.id),
  ['wave-1', 'wave-2', 'wave-3', 'wave-4'],
  'direct company searches must preserve relevance order without company scattering'
)

assert.equal(
  isDirectEntitySearch({ search: 'product' }, rankedJobs),
  false,
  'a generic single-token role query should retain exploration diversity'
)

assert.deepEqual(
  applyRankedJobDiversityPolicy(rankedJobs, { search: 'product' }).slice(0, 4).map(job => job.id),
  ['wave-1', 'wave-2', 'atria-1', 'remote-1'],
  'generic searches should still limit repeated companies in the visible window'
)

assert.equal(
  isDirectEntitySearch({ search: 'Product Designer' }, rankedJobs),
  true,
  'a specific multi-word job title should prioritize direct title matches'
)

console.log('✅ Processed jobs list policy tests passed')
