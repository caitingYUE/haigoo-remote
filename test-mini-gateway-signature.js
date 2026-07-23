import assert from 'node:assert/strict'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy-for-tests-only'

const { gatewaySecrets, hasGatewaySignature, requestSignature, stableJson } = await import('./lib/api-handlers/mini-gateway.js')

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
  true,
  'legacy GET signatures remain valid during the rolling deployment'
)

console.log('mini gateway signature checks passed')
