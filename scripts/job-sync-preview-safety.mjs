import assert from 'node:assert/strict'

export const databaseKeys = ['DATABASE_URL', 'NEON_DATABASE_URL', 'NEON_DATABASE_DATABASE_URL', 'HAIGOO_DATABASE_URL', 'haigoo_DATABASE_URL', 'pre_haigoo_DATABASE_URL', 'PRE_HAIGOO_DATABASE_URL']
const endpoint = value => {
  const url = new URL(value)
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'Expected a PostgreSQL connection')
  return url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
}

export function assertPreviewIsolation(preview, production) {
  assert.equal(preview.VERCEL_ENV, 'preview', 'Preview environment is required')
  assert.equal(production.VERCEL_ENV, 'production', 'Production comparison environment is required')
  assert(preview.DATABASE_URL && preview.JWT_SECRET, 'Preview database and JWT secret are required')
  const productionEndpoints = databaseKeys.filter(k => production[k]).map(k => endpoint(production[k]))
  assert(productionEndpoints.length, 'Production comparison database is required')
  const previewEndpoint = endpoint(preview.DATABASE_URL)
  for (const key of databaseKeys.filter(k => preview[k])) {
    assert.equal(endpoint(preview[key]), previewEndpoint, `Conflicting preview connection: ${key}`)
    assert(!productionEndpoints.includes(endpoint(preview[key])), 'Preview must use a separate database endpoint (including pooled aliases)')
  }
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
