import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./lib/api-handlers/processed-jobs.js', import.meta.url), 'utf8')
const syncSource = readFileSync(new URL('./lib/services/job-sync-service.js', import.meta.url), 'utf8')
const trustedCompaniesSource = readFileSync(new URL('./lib/api-handlers/trusted-companies.js', import.meta.url), 'utf8')

assert.doesNotMatch(
  source,
  /filterRecentJobs\s*\(/,
  'processed job writes must not filter records by publication age'
)

assert.match(
  source,
  /const unique = removeDuplicates\(validJobs\)/,
  'all validated jobs should proceed to deduplication regardless of publication date'
)

assert.match(
  source,
  /Age-based cleanup skipped/,
  'the legacy age-based cleanup endpoint must remain disabled'
)

assert.doesNotMatch(
  syncSource,
  /PROCESSED_JOBS_RETAIN_DAYS|validCrawledJobs/,
  'trusted-company synchronization must not apply an age retention window'
)

assert.doesNotMatch(
  trustedCompaniesSource,
  /filteredByTime|daysDiff > 30/,
  'manual trusted-company crawling must not discard jobs older than 30 days'
)

console.log('processed jobs write policy tests passed')
