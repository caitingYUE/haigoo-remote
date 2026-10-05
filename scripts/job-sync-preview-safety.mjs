import assert from 'node:assert/strict'
import { assertPreviewDatabaseIsolation } from './preview-database-safety.mjs'

export { databaseKeys } from './preview-database-safety.mjs'

export function assertPreviewIsolation(preview, production) {
  assertPreviewDatabaseIsolation(preview, production)
  assert(preview.JWT_SECRET, 'Preview JWT secret is required')
  const productionCaches = Object.entries(production).filter(([k, v]) => v && /(?:REDIS_URL|KV_URL|KV_REST_API_URL)$/.test(k)).map(([, v]) => new URL(v).hostname)
  for (const [key, value] of Object.entries(preview)) {
    if (value && /(?:REDIS_URL|KV_URL|KV_REST_API_URL)$/.test(key)) {
      assert(!productionCaches.includes(new URL(value).hostname), `Shared production cache: ${key}`)
    }
  }
  assert(preview.JWT_SECRET !== production.JWT_SECRET, 'Preview JWT secret must be isolated')
  return true
}

// Ignore only the new migration columns, never any original job/company field.
export async function publishedFingerprint(sql) {
  const [result] = await sql.query(`SELECT
    (SELECT count(*) FROM jobs)::integer AS jobs,
    (SELECT md5(string_agg((to_jsonb(j)-'sync_revision'-'source_published_at'-'last_manual_verified_at'-'crawl_deleted_at'-'crawl_identity_key')::text,'' ORDER BY job_id)) FROM jobs j) AS jobs_hash,
    (SELECT count(*) FROM trusted_companies)::integer AS companies,
    (SELECT md5(string_agg(to_jsonb(c)::text,'' ORDER BY company_id)) FROM trusted_companies c) AS companies_hash`)
  return result
}
