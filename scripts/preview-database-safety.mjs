import assert from 'node:assert/strict'
import fs from 'node:fs'
import dotenv from 'dotenv'

export const databaseKeys = ['DATABASE_URL', 'NEON_DATABASE_URL', 'NEON_DATABASE_DATABASE_URL', 'HAIGOO_DATABASE_URL', 'haigoo_DATABASE_URL', 'pre_haigoo_DATABASE_URL', 'PRE_HAIGOO_DATABASE_URL']

function endpoint(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid database connection configuration') }
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'Expected a PostgreSQL connection')
  assert(url.hostname, 'Database endpoint is required')
  return url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
}

export function assertPreviewDatabaseIsolation(preview, production) {
  assert.equal(preview.VERCEL_ENV, 'preview', 'Preview environment is required')
  assert.equal(production.VERCEL_ENV, 'production', 'Production comparison environment is required')
  assert(preview.DATABASE_URL, 'Explicit Preview DATABASE_URL is required')
  const productionEndpoints = databaseKeys.filter(key => production[key]).map(key => endpoint(production[key]))
  assert(productionEndpoints.length, 'Production comparison database is required')
  const previewEndpoint = endpoint(preview.DATABASE_URL)
  for (const key of databaseKeys.filter(key => preview[key])) {
    assert.equal(endpoint(preview[key]), previewEndpoint, `Conflicting preview connection: ${key}`)
    assert(!productionEndpoints.includes(endpoint(preview[key])), 'Preview must use a separate database endpoint (including pooled aliases)')
  }
  return true
}

export function loadIsolatedPreviewEnvironment({ envFile, productionEnvFile } = {}) {
  assert(envFile, 'Explicit --env-file is required; ambient environment and .env are not accepted')
  const preview = dotenv.parse(fs.readFileSync(envFile))
  const production = dotenv.parse(fs.readFileSync(productionEnvFile || new URL('../.env.production.local', import.meta.url)))
  assertPreviewDatabaseIsolation(preview, production)
  return preview
}
