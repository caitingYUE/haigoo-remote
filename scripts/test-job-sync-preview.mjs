import assert from 'node:assert/strict'
import { assertPreviewIsolation } from './job-sync-preview-safety.mjs'
const p = { VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://u:p@ep-preview.neon.tech/db', JWT_SECRET: 'preview', REDIS_URL: 'redis://preview.example:6379' }
const production = { VERCEL_ENV: 'production', DATABASE_URL: 'postgres://u:p@ep-production.neon.tech/db', JWT_SECRET: 'production', REDIS_URL: 'redis://production.example:6379' }
assert(assertPreviewIsolation(p, production))
for (const change of [
  { VERCEL_ENV: 'production' },
  { DATABASE_URL: production.DATABASE_URL },
  { DATABASE_URL: 'postgres://different:password@ep-production-pooler.neon.tech/other' },
  { NEON_DATABASE_DATABASE_URL: production.DATABASE_URL },
  { REDIS_URL: 'redis://other:password@production.example:6379' },
  { JWT_SECRET: production.JWT_SECRET },
  { DATABASE_URL: '' }
]) assert.throws(() => assertPreviewIsolation({ ...p, ...change }, production))
assert.throws(() => assertPreviewIsolation(p, { ...production, DATABASE_URL: '' }))
console.log('Preview isolation guards passed (production, pooled aliases, shadow connections, shared cache/JWT, missing comparison).')
