import 'dotenv/config'
import neonHelper from '../server-utils/dal/neon-helper.js'
import { createMembershipCodeBatch } from '../lib/services/membership-redemption-code-service.js'

const initialBatches = [
  { batchKey: 'initial-2026-monthly', name: '首批-月度', memberType: 'starter', quantity: 50 },
  { batchKey: 'initial-2026-half-year', name: '首批-半年', memberType: 'half_year', quantity: 30 },
  { batchKey: 'initial-2026-annual', name: '首批-年度', memberType: 'annual', quantity: 10 }
]

if (!neonHelper.isConfigured) throw new Error('DATABASE_URL is required')
if (String(process.env.MEMBERSHIP_REDEMPTION_ENABLED || '').trim().toLowerCase() !== 'true') {
  throw new Error('MEMBERSHIP_REDEMPTION_ENABLED must be true before generating initial codes')
}
if (String(process.env.MEMBERSHIP_REDEMPTION_CODE_KEY || '').length < 32) {
  throw new Error('MEMBERSHIP_REDEMPTION_CODE_KEY must contain at least 32 characters')
}

const created = []
const skipped = []
for (const batch of initialBatches) {
  const existing = await neonHelper.query(
    `SELECT b.batch_id, b.code_count, b.member_type, COUNT(c.code_id)::int AS actual_count
       FROM membership_code_batches b
       LEFT JOIN membership_redemption_codes c ON c.batch_id = b.batch_id
      WHERE b.batch_key = $1
      GROUP BY b.batch_id, b.code_count, b.member_type
      LIMIT 1`,
    [batch.batchKey]
  )
  if (existing?.[0]) {
    if (
      existing[0].member_type !== batch.memberType
      || Number(existing[0].code_count) !== batch.quantity
      || Number(existing[0].actual_count) !== batch.quantity
    ) {
      throw new Error(`Existing bootstrap batch ${batch.batchKey} does not match the expected type/count`)
    }
    skipped.push({ batchKey: batch.batchKey, count: Number(existing[0].code_count || 0) })
    continue
  }
  const result = await createMembershipCodeBatch({
    ...batch,
    channel: '外部平台（待分配）',
    createdBy: 'bootstrap:initial-2026'
  })
  created.push({ batchKey: batch.batchKey, count: result.batch.codeCount })
}

console.log(JSON.stringify({ success: true, created, skipped }, null, 2))
