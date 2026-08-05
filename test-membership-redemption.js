import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.MEMBERSHIP_REDEMPTION_CODE_KEY = 'test-only-membership-redemption-key-2026-do-not-use'

const {
  decryptRedemptionCode,
  encryptRedemptionCode,
  generateRedemptionCode,
  hashRedemptionCode,
  isMembershipRedemptionEnabled,
  membershipCodePlanDefinitions,
  normalizeRedemptionCode
} = await import('./lib/services/membership-redemption-code-service.js')

const formats = {
  starter: /^HG-M-(?:[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-){3}[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/,
  half_year: /^HG-H-(?:[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-){3}[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/,
  annual: /^HG-Y-(?:[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-){3}[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/
}

for (const [memberType, pattern] of Object.entries(formats)) {
  const generated = Array.from({ length: 200 }, () => generateRedemptionCode(memberType))
  assert.equal(new Set(generated).size, generated.length, `${memberType} test codes must be unique`)
  generated.forEach(code => assert.match(code, pattern))
}

const sample = generateRedemptionCode('starter')
const normalized = normalizeRedemptionCode(` ${sample.toLowerCase().replaceAll('-', ' - ')} `)
assert.equal(normalized, sample.replaceAll('-', ''))
assert.equal(hashRedemptionCode(sample), hashRedemptionCode(normalized))
assert.notEqual(encryptRedemptionCode(sample), encryptRedemptionCode(sample), 'AES-GCM must use a fresh IV')
assert.equal(decryptRedemptionCode(encryptRedemptionCode(sample)), normalized)
const encrypted = encryptRedemptionCode(sample)
const encryptedParts = encrypted.split('.')
encryptedParts[3] = `${encryptedParts[3][0] === 'A' ? 'B' : 'A'}${encryptedParts[3].slice(1)}`
const tampered = encryptedParts.join('.')
assert.throws(() => decryptRedemptionCode(tampered), 'AES-GCM must reject modified ciphertext')
assert.notEqual(hashRedemptionCode(sample), hashRedemptionCode(generateRedemptionCode('starter')))
assert.deepEqual(
  Object.fromEntries(Object.entries(membershipCodePlanDefinitions).map(([key, value]) => [key, value.durationMonths])),
  { starter: 1, half_year: 6, annual: 12 }
)

delete process.env.MEMBERSHIP_REDEMPTION_ENABLED
assert.equal(isMembershipRedemptionEnabled(), false, 'feature must fail closed when the flag is missing')
process.env.MEMBERSHIP_REDEMPTION_ENABLED = 'true'
assert.equal(isMembershipRedemptionEnabled(), true)
process.env.MEMBERSHIP_REDEMPTION_ENABLED = 'false'
assert.equal(isMembershipRedemptionEnabled(), false)

const migration = fs.readFileSync(
  new URL('./server-utils/dal/migrations/064_membership_redemption_codes.sql', import.meta.url),
  'utf8'
)
for (const requiredInvariant of [
  'membership_redemption_codes_plan_duration_check',
  'membership_redemption_codes_usage_state_check',
  'membership_entitlement_segments_no_overlap',
  'activated_at',
  'superseded_at',
  'membership_code_admin_audit',
  'pg_advisory_xact_lock',
  'rebase_pending_membership_entitlements'
]) {
  assert.ok(migration.includes(requiredInvariant), `migration must include ${requiredInvariant}`)
}
const rateLimitTableSql = migration.match(/CREATE TABLE IF NOT EXISTS mini_rate_limits \([\s\S]*?\n\);/)?.[0] || ''
const batchTableSql = migration.match(/CREATE TABLE IF NOT EXISTS membership_code_batches \([\s\S]*?\n\);/)?.[0] || ''
assert.ok(rateLimitTableSql && batchTableSql, 'migration tables must be parseable by section')
assert.ok(!rateLimitTableSql.includes('batch_id'), 'rate-limit schema must not contain membership batch constraints')
assert.ok(batchTableSql.includes('membership_code_batches_identity_plan_unique'))

const distributionMigration = fs.readFileSync(
  new URL('./server-utils/dal/migrations/065_membership_code_distribution.sql', import.meta.url),
  'utf8'
)
for (const requiredDistributionInvariant of [
  'distributed_at',
  'distributed_by',
  'membership_redemption_codes_distribution_state_check',
  "'distribution'",
  'membership_code_admin_audit_target_check'
]) {
  assert.ok(
    distributionMigration.includes(requiredDistributionInvariant),
    `distribution migration must include ${requiredDistributionInvariant}`
  )
}

console.log('Membership redemption code tests passed')
