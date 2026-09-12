import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('./lib/services/mini-member-service.js', 'utf8')
assert.match(source, /import \{ getContinuousMembershipExpireAt \} from '\.\/membership-redemption-code-service\.js'/)
assert.match(source, /const memberExpireAt = await getContinuousMembershipExpireAt\(user\)/)
assert.match(source, /memberExpireAt\s*\n\s*\}/)
console.log('PASS: member-services exposes the same continuous expiry used by membership plans.')
