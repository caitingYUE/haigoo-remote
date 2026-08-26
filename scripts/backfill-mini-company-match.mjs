import 'dotenv/config'
import neonHelper from '../server-utils/dal/neon-helper.js'
import { rebuildCompanyHiringProfile } from '../lib/services/mini-company-match-service.js'

if (!neonHelper.isConfigured) throw new Error('Database URL is required')

const companies = await neonHelper.query(`
  SELECT DISTINCT company_id
    FROM company_job_history
   ORDER BY company_id
`)

let completed = 0
for (const company of companies || []) {
  await rebuildCompanyHiringProfile(company.company_id)
  completed += 1
  if (completed % 25 === 0) console.log(`Rebuilt ${completed}/${companies.length} company hiring profiles`)
}

console.log(`Mini Match backfill complete: ${completed} company hiring profiles`)
