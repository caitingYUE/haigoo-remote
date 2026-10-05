import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

process.env.DATABASE_URL = 'postgres://test:test@isolated.invalid/db'
process.env.JWT_SECRET = 'test-only-admin-account-isolation-key'
process.env.VERCEL_ENV = 'production'
const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js')
const { default: userHelper } = await import('./server-utils/user-helper.js')
const { default: analyticsHandler } = await import('./lib/api-handlers/analytics-stats.js')
const pg = new PGlite()
await pg.exec(`
  CREATE TABLE users (
    user_id text PRIMARY KEY, email text, username text, auth_provider text,
    email_verified boolean DEFAULT true, profile jsonb DEFAULT '{}', status text DEFAULT 'active', roles jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), last_login_at timestamptz,
    member_status text DEFAULT 'free', member_expire_at timestamptz, member_since timestamptz, member_display_id text,
    member_type text DEFAULT 'none', member_cycle_start_at timestamptz,
    free_company_info_count int DEFAULT 0, free_email_apply_count int DEFAULT 0, free_referral_count int DEFAULT 0,
    free_unlocked_companies jsonb DEFAULT '[]', free_website_apply_count int DEFAULT 0, free_website_apply_job_ids jsonb DEFAULT '[]',
    free_website_apply_limit int DEFAULT 20, free_referral_limit int DEFAULT 3
  );
  CREATE TABLE favorites(user_id text, job_id text);
  CREATE TABLE mini_wechat_identities(user_id text, created_at timestamptz, linked_at timestamptz);
  CREATE TABLE payment_records(user_id text, status text, plan_id text, created_at timestamptz DEFAULT NOW());
  INSERT INTO users(user_id,email,username,auth_provider) VALUES
    ('real-free','customer@example.com','Customer','email'),
    ('real-member','member@example.com','Member','google'),
    ('test-domain-customer','customer@invalid.test','A real registration','email'),
    ('smoke','mini-smoke-member@invalid.test','Mini smoke member','mini_smoke');
  UPDATE users SET member_status='active',member_type='quarter',member_since=NOW(),member_expire_at=NOW()+INTERVAL '3 years'
    WHERE user_id IN ('real-member','smoke');
  INSERT INTO mini_wechat_identities VALUES ('smoke',NOW(),NOW()),('real-member',NOW(),NOW());
`)
const originalQuery = neonHelper.query
const originalSelect = neonHelper.select
const originalAuth = userHelper.validateAdminRequest
try {
  neonHelper.query = async (sql, params = []) => (await pg.query(sql, params)).rows
  neonHelper.select = async (_table, where) => (await pg.query('SELECT * FROM favorites WHERE user_id=$1', [where.user_id])).rows
  const listed = await userHelper.listUsersForAdmin()
  assert.equal(listed.total, 3)
  assert.equal(listed.stats.total, 3)
  assert.equal(listed.stats.both, 1)
  assert.equal(listed.stats.miniUsers, 1)
  assert.deepEqual(new Set(listed.users.map(user => user.userId)), new Set(['real-free','real-member','test-domain-customer']))
  const searched = await userHelper.listUsersForAdmin({ search: 'mini-smoke', exportMode: true })
  assert.equal(searched.total, 0)
  assert.equal(searched.users.length, 0)
  const exported = await userHelper.listUsersForAdmin({ memberStatus: 'active', exportMode: true })
  assert.deepEqual(exported.users.map(user => user.userId), ['real-member'])
  assert.equal((await userHelper.getAllUsers()).length, 3, 'legacy user API must not expose fixtures')

  const membershipResults = []
  userHelper.validateAdminRequest = async () => ({ valid: true })
  neonHelper.query = async (sql, params = []) => {
    if (/WITH membership_users AS|WITH payment_users AS/.test(sql)) {
      const rows = (await pg.query(sql, params)).rows
      membershipResults.push(rows)
      return rows
    }
    return []
  }
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(payload) { this.payload = payload; return this } }
  await analyticsHandler({ method: 'GET', query: { view: 'membership', period: 'month' }, headers: {} }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(membershipResults.length, 2)
  assert.equal(Number(membershipResults[0][0].current_active_users), 1)
  assert.equal(Number(membershipResults[1][0].total_users), 1)

  neonHelper.query = async (sql, params = []) => (await pg.query(sql, params)).rows
  await pg.exec("DELETE FROM users WHERE auth_provider <> 'mini_smoke'")
  assert.equal((await userHelper.listUsersForAdmin()).total, 0)
  assert.deepEqual(await userHelper.getAllUsers(), [], 'fixture-only databases must return an empty customer list')
} finally {
  neonHelper.query = originalQuery
  neonHelper.select = originalSelect
  userHelper.validateAdminRequest = originalAuth
  await pg.close()
}
console.log('Admin fixture isolation passed with local PostgreSQL: lists, search, export, counts, legacy API and membership analytics exclude fixtures; email suffix alone does not hide customers.')
