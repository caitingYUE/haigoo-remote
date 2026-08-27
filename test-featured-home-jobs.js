import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getFeaturedHomeSelectedJobs } from './lib/services/featured-home-jobs.js'

const rows = [
  { job_id: 'a-1', company_id: 'a' },
  { job_id: 'a-2', company_id: 'a' },
  { job_id: 'a-3', company_id: 'a' },
  { job_id: 'a-4', company_id: 'a' },
  { job_id: 'b-1', company_id: 'b' },
  { job_id: 'c-1', company_id: 'c' },
  { job_id: 'd-1', company_id: 'd' }
]

const queries = []
const selected = await getFeaturedHomeSelectedJobs({
  neonHelper: {
    async query(sql) {
      queries.push(sql)
      return rows
    }
  },
  limit: 6
})

assert.equal(queries.length, 1, 'homepage must use one featured-only query')
assert.match(queries[0], /j\.is_featured = true/, 'homepage must select featured jobs')
assert.doesNotMatch(queries[0], /INTERVAL/, 'featured jobs must not be restricted by an age window')
assert.match(
  queries[0],
  /ORDER BY COALESCE\(j\.published_at, j\.updated_at, j\.created_at\) DESC/,
  'featured jobs must be ordered by public publication time'
)
assert.equal(selected.length, 6, 'company spreading must still fill all six homepage slots')
assert.deepEqual(
  selected.slice(0, 5).map((row) => row.job_id),
  ['a-1', 'a-2', 'b-1', 'c-1', 'd-1'],
  'company spreading should prefer at most two jobs per company'
)

const landingPage = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8')
assert.match(landingPage, /processedJobsService\.getFeaturedHomeJobs\(\)/, 'homepage must use the featured jobs endpoint')

console.log('Featured home jobs tests passed.')
