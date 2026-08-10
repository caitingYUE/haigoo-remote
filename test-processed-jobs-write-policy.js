import assert from 'node:assert/strict'
import { filterRecentJobs } from './lib/api-handlers/processed-jobs.js'

const now = Date.now()
const recentDate = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
const expiredDate = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()

assert.equal(
  filterRecentJobs([{ id: 'recent-feed-job', publishedAt: recentDate }], 30).length,
  1,
  'recent feed jobs should remain eligible for ingestion'
)

assert.equal(
  filterRecentJobs([{ id: 'expired-feed-job', publishedAt: expiredDate }], 30).length,
  0,
  'expired feed jobs should still be filtered during ingestion'
)

assert.equal(
  filterRecentJobs([{
    id: 'expired-admin-job',
    publishedAt: expiredDate,
    isManuallyEdited: true
  }], 30).length,
  1,
  'administrator-edited jobs must not be discarded by the ingestion retention window'
)

console.log('processed jobs write policy tests passed')
