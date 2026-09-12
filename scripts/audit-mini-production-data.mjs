import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFileArg = process.argv.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length)
const envFile = path.resolve(rootDir, envFileArg || '.env.production.local')
assert.ok(fs.existsSync(envFile), `Environment file not found: ${envFile}`)

const environment = dotenv.parse(fs.readFileSync(envFile))
const databaseUrl = environment.NEON_DATABASE_DATABASE_URL || environment.DATABASE_URL
assert.ok(databaseUrl, 'Production database URL is missing')
const parsedUrl = new URL(databaseUrl)
const sql = neon(databaseUrl)

async function metric(name, query, params = []) {
  try {
    return { name, rows: await sql.query(query, params) }
  } catch (error) {
    return { name, error: error instanceof Error ? error.message : String(error) }
  }
}

const reports = await Promise.all([
  metric('database', `
    SELECT current_database() AS database_name, current_schema() AS schema_name,
           NOW() AS checked_at, current_setting('TimeZone') AS timezone`),
  metric('companies', `
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(description), '') IS NULL)::int AS missing_description,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(industry), '') IS NULL)::int AS missing_industry,
           COUNT(*) FILTER (WHERE status = 'active' AND LOWER(BTRIM(COALESCE(industry, ''))) IN ('other', '其他'))::int AS other_industry,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(employee_count), '') IS NULL)::int AS missing_employee_count,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(founded_year), '') IS NULL)::int AS missing_founded_year,
           COUNT(*) FILTER (WHERE status = 'active' AND company_rating IS NULL)::int AS missing_rating,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(logo), '') IS NULL AND NULLIF(BTRIM(cached_logo_url), '') IS NULL)::int AS missing_logo,
           COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 hour')::int AS updated_last_hour,
           COUNT(*) FILTER (WHERE updated_at > NOW() + INTERVAL '5 minutes')::int AS future_updated_at,
           MIN(updated_at) AS oldest_update, MAX(updated_at) AS latest_update
      FROM trusted_companies`),
  metric('company_update_cluster', `
    SELECT DATE_TRUNC('second', updated_at) AS updated_second, COUNT(*)::int AS companies
      FROM trusted_companies
     WHERE status = 'active' AND updated_at > NOW() - INTERVAL '7 days'
     GROUP BY 1 ORDER BY companies DESC, updated_second DESC LIMIT 5`),
  metric('jobs', `
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active,
           COUNT(*) FILTER (WHERE status = 'active' AND is_approved IS TRUE AND COALESCE(member_only, FALSE) IS FALSE)::int AS approved_public,
           COUNT(DISTINCT company_id) FILTER (WHERE status = 'active' AND is_approved IS TRUE AND COALESCE(member_only, FALSE) IS FALSE)::int AS approved_public_companies,
           COUNT(*) FILTER (WHERE status = 'active' AND NULLIF(BTRIM(title), '') IS NULL)::int AS missing_title,
           COUNT(*) FILTER (WHERE status = 'active' AND COALESCE(translations, '{}'::jsonb) = '{}'::jsonb)::int AS missing_translations,
           COUNT(*) FILTER (WHERE source_type = 'mini_catalog_projection')::int AS preview_projection_jobs,
           COUNT(*) FILTER (WHERE updated_at > NOW() + INTERVAL '5 minutes')::int AS future_updated_at,
           MAX(updated_at) AS latest_update
      FROM jobs`),
  metric('directory_eligibility', `
    SELECT COUNT(DISTINCT tc.company_id)::int AS eligible_companies, COUNT(*)::int AS eligible_jobs
      FROM trusted_companies tc
      JOIN jobs j ON j.company_id = tc.company_id
       AND j.status = 'active' AND j.is_approved IS TRUE AND COALESCE(j.member_only, FALSE) IS FALSE
       AND (NULLIF(BTRIM(j.url), '') ~* '^https?://[^[:space:]]+$'
         OR NULLIF(BTRIM(tc.hiring_email), '') ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')
     WHERE tc.status = 'active'`),
  metric('job_history', `
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE closed_at IS NULL AND is_public_opportunity IS TRUE)::int AS current_public,
           COUNT(DISTINCT company_id) FILTER (WHERE closed_at IS NULL AND is_public_opportunity IS TRUE)::int AS current_public_companies,
           COUNT(*) FILTER (WHERE first_seen_at > NOW() + INTERVAL '5 minutes')::int AS future_first_seen,
           MAX(first_seen_at) AS latest_first_seen
      FROM company_job_history`),
  metric('mini_identities', `
    SELECT COUNT(*)::int AS identities, COUNT(DISTINCT user_id)::int AS linked_users,
           COUNT(DISTINCT app_id)::int AS app_ids, MAX(linked_at) AS latest_link
      FROM mini_wechat_identities`)
])

const byName = Object.fromEntries(reports.map((report) => [report.name, report]))
const companies = byName.companies.rows?.[0]
const jobs = byName.jobs.rows?.[0]
const directory = byName.directory_eligibility.rows?.[0]
const history = byName.job_history.rows?.[0]
const critical = []
if (reports.some((report) => report.error)) critical.push('one or more required production tables/queries are unavailable')
if (Number(companies?.active || 0) === 0) critical.push('no active trusted companies')
if (Number(directory?.eligible_companies || 0) === 0) critical.push('no companies are eligible for the Mini Program directory')
if (Number(history?.current_public_companies || 0) === 0) critical.push('no current public company job history')
if (Number(jobs?.approved_public || 0) === 0) critical.push('no approved public jobs')
if (Number(companies?.future_updated_at || 0) > 0 || Number(jobs?.future_updated_at || 0) > 0 || Number(history?.future_first_seen || 0) > 0) critical.push('future-dated catalog records detected')

const targetFingerprint = crypto.createHash('sha256')
  .update(`${parsedUrl.hostname}${parsedUrl.pathname}`)
  .digest('hex')
  .slice(0, 12)
console.log(JSON.stringify({
  readOnly: true,
  envFile: path.relative(rootDir, envFile),
  databaseTarget: { host: parsedUrl.hostname, database: parsedUrl.pathname.replace(/^\//, ''), fingerprint: targetFingerprint },
  reports: Object.fromEntries(reports.map(({ name, rows, error }) => [name, error ? { error } : rows])),
  critical
}, null, 2))

if (critical.length) process.exitCode = 2
