import assert from 'node:assert/strict'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy-for-tests-only'

const {
  gatewaySecrets,
  hasGatewaySignature,
  normalizeEventId,
  normalizeJobSnapshot,
  requestSignature,
  stableJson
} = await import('./lib/api-handlers/mini-gateway.js')

const payloadA = { type: 'website', jobId: 'job-1', nested: { b: 2, a: 1 } }
const payloadB = { nested: { a: 1, b: 2 }, jobId: 'job-1', type: 'website' }

assert.equal(stableJson(payloadA), stableJson(payloadB), 'object key order must not alter gateway signatures')
assert.equal(
  requestSignature('POST', 'application', '1720000000000', payloadA),
  requestSignature('POST', 'application', '1720000000000', payloadB),
  'the same request payload must produce one stable HMAC'
)
assert.notEqual(
  requestSignature('POST', 'application', '1720000000000', payloadA),
  requestSignature('POST', 'bind', '1720000000000', payloadA),
  'an HMAC cannot be replayed against another gateway action'
)
assert.notEqual(
  requestSignature('GET', 'sync', '1720000000000', { page: '1', limit: '20' }),
  requestSignature('GET', 'sync', '1720000000000', { page: '2', limit: '20' }),
  'GET query parameters must be covered by the gateway HMAC'
)

process.env.MINI_GATEWAY_PRODUCTION_SECRET = 'test-production-gateway-secret'
assert.deepEqual(
  gatewaySecrets(),
  ['test-mini-gateway-secret', 'test-production-gateway-secret'],
  'development and production gateway secrets must be accepted independently'
)

const timestamp = String(Date.now())
const productionSignature = requestSignature('GET', 'sync', timestamp, { page: '2' }, process.env.MINI_GATEWAY_PRODUCTION_SECRET)
assert.equal(
  hasGatewaySignature({
    method: 'GET',
    query: { action: 'sync', page: '2' },
    headers: {
      'x-haigoo-mini-timestamp': timestamp,
      'x-haigoo-mini-signature': productionSignature
    }
  }, 'sync'),
  true,
  'production CloudRun must be able to use a separate gateway secret'
)

const legacySignature = requestSignature('GET', 'sync', timestamp, {})
assert.equal(
  hasGatewaySignature({
    method: 'GET',
    query: { action: 'sync', page: '2' },
    headers: {
      'x-haigoo-mini-timestamp': timestamp,
      'x-haigoo-mini-signature': legacySignature
    }
  }, 'sync'),
  false,
  'legacy GET signatures must not authorize altered or unsigned query parameters'
)

process.env.MINI_GATEWAY_READONLY_SECRET = 'test-readonly-jobs-secret'
const readonlySignature = requestSignature('GET', 'sync', timestamp, { page: '1' }, process.env.MINI_GATEWAY_READONLY_SECRET)
assert.equal(
  hasGatewaySignature({
    method: 'GET',
    query: { action: 'sync', page: '1' },
    headers: {
      'x-haigoo-mini-timestamp': timestamp,
      'x-haigoo-mini-signature': readonlySignature
    }
  }, 'sync'),
  true,
  'the read-only secret must authorize formal job synchronization'
)
const forbiddenReadonlySignature = requestSignature('GET', 'favorites', timestamp, { openid: 'test-openid' }, process.env.MINI_GATEWAY_READONLY_SECRET)
assert.equal(
  hasGatewaySignature({
    method: 'GET',
    query: { action: 'favorites', openid: 'test-openid' },
    headers: {
      'x-haigoo-mini-timestamp': timestamp,
      'x-haigoo-mini-signature': forbiddenReadonlySignature
    }
  }, 'favorites'),
  false,
  'the read-only secret must not authorize user-data actions'
)

const clientEventId = 'mini-event-1785220821602-cw1mv702ie'
assert.match(normalizeEventId(clientEventId), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
assert.equal(normalizeEventId(clientEventId), normalizeEventId(clientEventId), 'client event IDs must map to a deterministic UUID')

assert.deepEqual(
  normalizeJobSnapshot({
    id: 'formal-job-1',
    title: 'Senior Engineer',
    company: 'Formal Company',
    url: 'https://example.com/jobs/1',
    hiringEmail: 'jobs@example.com',
    memberOnly: true
  }, 'formal-job-1'),
  {
    id: 'formal-job-1',
    title: 'Senior Engineer',
    company: 'Formal Company',
    memberOnly: true,
    url: 'https://example.com/jobs/1',
    sourceUrl: '',
    hiringEmail: 'jobs@example.com',
    emailType: '',
    canRefer: false,
    effectiveReferralContactCount: 0
  },
  'a signed formal-job snapshot must be usable by Preview account actions'
)
assert.equal(
  normalizeJobSnapshot({ id: 'another-job', url: 'javascript:alert(1)' }, 'formal-job-1'),
  null,
  'a job snapshot cannot be replayed for another job'
)

console.log('mini gateway signature checks passed')
