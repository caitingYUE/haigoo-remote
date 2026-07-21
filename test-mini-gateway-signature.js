import assert from 'node:assert/strict'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'

const { requestSignature, stableJson } = await import('./lib/api-handlers/mini-gateway.js')

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

console.log('mini gateway signature checks passed')
