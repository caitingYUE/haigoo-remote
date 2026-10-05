import { neon } from '@neondatabase/serverless'
import { MINI_SMOKE_FIXTURES } from './mini-smoke-fixtures.mjs'
import { loadIsolatedPreviewEnvironment } from './preview-database-safety.mjs'

const envFile = process.argv.find(argument => argument.startsWith('--env-file='))?.slice(11)
const productionEnvFile = process.argv.find(argument => argument.startsWith('--production-env-file='))?.slice(22)
const environment = loadIsolatedPreviewEnvironment({ envFile, productionEnvFile })
if (environment.VERCEL_ENV !== 'preview' || process.env.MINI_SMOKE_ALLOW_SETUP !== 'true') {
  throw new Error('Smoke identities can only be prepared in an explicitly authorized Preview environment')
}

const databaseUrl = environment.DATABASE_URL
const appId = String(environment.WECHAT_MINI_APP_ID || '').trim()
if (!databaseUrl || !appId) throw new Error('Preview database or Mini Program App ID is unavailable')

const dryRun = process.argv.includes('--dry-run')
const sql = dryRun ? null : neon(databaseUrl)

async function upsertUser(key, fixture) {
  const isMember = key === 'member'
  await sql.query(
    `INSERT INTO users (
       user_id, email, username, auth_provider, email_verified, status,
       member_status, member_type, membership_level, member_since,
       member_cycle_start_at, member_expire_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, 'mini_smoke', TRUE, 'active',
       $4, $5, $6, $7, $7, $8, NOW(), NOW()
     )
     ON CONFLICT (user_id) DO UPDATE SET
       email = EXCLUDED.email,
       username = EXCLUDED.username,
       auth_provider = 'mini_smoke',
       status = 'active',
       member_status = EXCLUDED.member_status,
       member_type = EXCLUDED.member_type,
       membership_level = EXCLUDED.membership_level,
       member_since = EXCLUDED.member_since,
       member_cycle_start_at = EXCLUDED.member_cycle_start_at,
       member_expire_at = EXCLUDED.member_expire_at,
       updated_at = NOW()`,
    [
      fixture.userId,
      fixture.email,
      `Mini smoke ${key}`,
      isMember ? 'active' : 'free',
      isMember ? 'quarter' : 'none',
      isMember ? 'club_go' : 'free',
      isMember ? new Date('2026-01-01T00:00:00.000Z') : null,
      isMember ? new Date('2030-01-01T00:00:00.000Z') : null
    ]
  )
  await sql.query(
    `INSERT INTO mini_wechat_identities (app_id, openid, user_id, created_at, linked_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (app_id, openid) DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = NOW()`,
    [appId, fixture.openid, fixture.userId]
  )
}

if (!dryRun) {
  for (const [key, fixture] of Object.entries(MINI_SMOKE_FIXTURES)) {
    await upsertUser(key, fixture)
  }

  // Reset only the unused fixture in the verified, isolated Preview database.
  const unusedUserId = MINI_SMOKE_FIXTURES.unused.userId
  await sql.query('DELETE FROM career_watch_feed_snapshots WHERE user_id = $1', [unusedUserId])
  await sql.query('DELETE FROM career_watch_profiles WHERE user_id = $1', [unusedUserId])
  await sql.query('DELETE FROM mini_career_entitlements WHERE user_id = $1', [unusedUserId])
}

console.log(JSON.stringify({
  environment: 'preview',
  databaseIsolationVerified: true,
  dryRun,
  prepared: dryRun ? [] : Object.keys(MINI_SMOKE_FIXTURES),
  customerRecordsChanged: false
}, null, 2))
