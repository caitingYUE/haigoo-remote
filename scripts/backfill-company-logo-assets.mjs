import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const [{ default: neonHelper }, { cacheCompanyLogoBestEffort }] = await Promise.all([
  import('../server-utils/dal/neon-helper.js'),
  import('../lib/services/company-image-asset-service.js')
])

const limitArg = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0)
const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 0

if (!neonHelper?.isConfigured) {
  console.error('[company-logo-backfill] Database is not configured.')
  process.exit(1)
}

const rows = await neonHelper.query(
  `SELECT company_id, name, logo
   FROM trusted_companies
   WHERE COALESCE(NULLIF(BTRIM(logo), ''), NULL) IS NOT NULL
     AND (
       cached_logo_url IS NULL
       OR logo_cache_status IS DISTINCT FROM 'ready'
     )
   ORDER BY updated_at DESC
   ${limit ? `LIMIT ${limit}` : ''}`
)

let success = 0
let skipped = 0
let failed = 0

console.log(`[company-logo-backfill] Found ${rows.length} companies to process.`)

for (const row of rows) {
  const result = await cacheCompanyLogoBestEffort(neonHelper, row.company_id, row.logo)
  if (result?.success) {
    success += 1
    console.log(`[company-logo-backfill] OK ${row.name} -> ${result.cachedLogoUrl}`)
  } else if (result?.skipped) {
    skipped += 1
    console.log(`[company-logo-backfill] SKIP ${row.name}: ${result.reason}`)
  } else {
    failed += 1
    console.warn(`[company-logo-backfill] FAIL ${row.name}: ${result?.error || 'unknown error'}`)
  }
}

console.log(JSON.stringify({ total: rows.length, success, skipped, failed }, null, 2))
