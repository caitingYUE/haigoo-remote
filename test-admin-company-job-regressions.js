import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeAnalyticsEvent } from './lib/services/analytics-event-service.js'

const historyService = fs.readFileSync('lib/services/mini-company-match-service.js', 'utf8')
const historyUpdate = historyService.slice(
  historyService.indexOf('if (existing)'),
  historyService.indexOf('\n  const rows = await companyHistoryQuery(', historyService.indexOf('if (existing)'))
)
assert.match(
  historyUpdate,
  /first_seen_at = COALESCE\(first_seen_at, \$13::timestamptz, NOW\(\)\)[\s\S]+WHERE history_id = \$17 AND company_id = \$1 AND source_job_id = \$2/,
  'history updates must type every bound PostgreSQL parameter'
)
for (let index = 1; index <= 17; index += 1) {
  assert.match(historyUpdate, new RegExp(`\\$${index}(?!\\d)`), `history update must use $${index}`)
}

const processedJobs = fs.readFileSync('lib/api-handlers/processed-jobs.js', 'utf8')
assert.match(processedJobs, /job_id = ANY\(\$1::text\[\]\)/)
assert.match(processedJobs, /sourceType:\s*50/)

const longFlowId = `website_apply_${'job-'.repeat(20)}`
const event = normalizeAnalyticsEvent({
  event: 'feature_consume',
  properties: { flow_id: longFlowId }
})
const otherEvent = normalizeAnalyticsEvent({
  event: 'feature_consume',
  properties: { flow_id: `${longFlowId}other` }
})
assert.equal(event.flowId.length, 64)
assert.equal(event.properties.flow_id, event.flowId)
assert.notEqual(event.flowId, otherEvent.flowId)

console.log('Admin company job regression checks passed')
