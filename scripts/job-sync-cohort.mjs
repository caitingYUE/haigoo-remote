import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import { db, initializeCohort } from '../lib/services/job-sync/store.js'
import { catalogSource } from '../lib/services/job-sync/catalog.js'
import { detectSource } from '../lib/services/job-sync/adapters.js'

// Default is read-only. Initializing the cohort never enables a source or writes jobs.
const rows =
  await db(`SELECT c.company_id,c.name,c.careers_page,c.website,COUNT(j.job_id)::integer AS published_jobs,
  jsonb_agg(jsonb_build_object('job_id',j.job_id,'title',j.title,'url',j.url)) AS existing_jobs
  FROM trusted_companies c JOIN jobs j ON j.company_id=c.company_id AND j.status='active' AND j.is_approved IS TRUE
  WHERE c.status='active' GROUP BY c.company_id,c.name,c.careers_page,c.website ORDER BY c.name`)
const report = rows.map((co) => {
  const seed = catalogSource(co),
    url = seed.url || co.careers_page || co.website || ''
  let detected
  try {
    detected = detectSource(url)
  } catch {
    detected = detectSource('')
  }
  const adapter = seed.adapter || detected.adapter
  return {
    ...co,
    proposed_url: url,
    adapter,
    rollout_tier: adapter === 'manual' ? 'C' : seed.config?.rolloutTier || 'B',
    config: { ...detected.config, ...seed.config },
    ownership_review: seed.rule?.requiresReview === true,
    readiness:
      adapter === 'manual'
        ? 'manual'
        : Object.keys(seed.config || {}).includes('board')
          ? 'validated-public-api'
          : ['html', 'feed'].includes(adapter)
            ? 'needs-source-validation'
            : 'adapter-available-needs-validation',
    capabilities:
      adapter === 'manual'
        ? { discover: false, details: false, updates: false, absence: false }
        : { ...detected.capabilities, ...seed.capabilities }
  }
})
const pathArg = process.argv.find((a) => a.startsWith('--report='))
if (pathArg)
  await writeFile(
    pathArg.slice(9),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        company_count: report.length,
        published_jobs: report.reduce((n, c) => n + c.published_jobs, 0),
        companies: report
      },
      null,
      2
    ) + '\n'
  )
console.log(
  JSON.stringify(
    {
      company_count: report.length,
      published_jobs: report.reduce((n, c) => n + c.published_jobs, 0),
      readiness: report.reduce(
        (out, c) => ({ ...out, [c.readiness]: (out[c.readiness] || 0) + 1 }),
        {}
      )
    },
    null,
    2
  )
)
if (process.argv.includes('--initialize')) console.log(await initializeCohort())
