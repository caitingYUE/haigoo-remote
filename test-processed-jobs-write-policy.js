import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./lib/api-handlers/processed-jobs.js', import.meta.url), 'utf8')

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

console.log('processed jobs write policy tests passed')
