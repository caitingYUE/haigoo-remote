import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'

// Supply an external test-only PGlite installation; no product dependency.
const modulePath = process.argv.find((arg) => arg.startsWith('--pglite='))?.slice(9)
if (!modulePath) throw new Error('Usage: node scripts/test-mini-acquisition-db.mjs --pglite=/path/to/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(modulePath).href)
const db = new PGlite()
try {
  await db.exec("SET TIME ZONE 'UTC'")
  await db.exec(`CREATE TABLE users (user_id varchar PRIMARY KEY);
    CREATE TABLE trusted_companies (company_id varchar PRIMARY KEY, name text, status varchar DEFAULT 'active');
    CREATE TABLE company_job_history (company_id varchar, closed_at timestamptz, is_public_opportunity boolean, source_published_at timestamptz, first_seen_at timestamptz);
    CREATE TABLE mini_company_follows (
      user_id varchar REFERENCES users, company_id varchar REFERENCES trusted_companies,
      status varchar NOT NULL, in_app_enabled boolean, wechat_enabled boolean,
      wechat_template_status varchar, updated_at timestamptz, UNIQUE(user_id, company_id));
    INSERT INTO users VALUES ('free'), ('expired'), ('member'), ('parallel'), ('reminders');
    INSERT INTO trusted_companies (company_id, name) SELECT 'c' || n, 'Test-only company ' || n FROM generate_series(1, 30) n;
    INSERT INTO company_job_history SELECT company_id, NULL, TRUE, NULL, NULL FROM trusted_companies;`)
  const source = fs.readFileSync('lib/services/mini-company-match-service.js', 'utf8')
    .split('export async function setCompanyFollow')[1].split('export async function listCompanyFollows')[0]
  const client = {
    query: (sql, params) => ({ sql, params }),
    transaction: (queries, options) => {
      assert.equal(options.isolationLevel, 'ReadCommitted')
      assert.match(queries[0].sql, /FROM users WHERE user_id = \$1 FOR UPDATE/)
      return db.transaction(async (tx) => {
        const results = []
        for (const query of queries) results.push((await tx.query(query.sql, query.params)).rows)
        return results
      })
    }
  }
  const follow = vm.runInNewContext(`async function setCompanyFollow${source}; setCompanyFollow`, {
    FOLLOWS_TABLE: 'mini_company_follows', neonHelper: {
      query: async (sql, params) => (await db.query(sql, params)).rows,
      getClient: () => client
    }
  })
  const set = (user, company, active = true, isMember = false) => follow({ user: { user_id: user }, companyId: company, active, isMember })
  const reminderSource = fs.readFileSync('lib/services/mini-company-match-service.js', 'utf8')
    .split('export async function setFollowNotifications')[1].split('export async function recordMatchFeedback')[0]
  const notify = vm.runInNewContext(`async function setFollowNotifications${reminderSource}; setFollowNotifications`, {
    FOLLOWS_TABLE: 'mini_company_follows', neonHelper: {
      query: async (sql, params) => (await db.query(sql, params)).rows,
      getClient: () => client
    }
  })
  const reminder = (companyId, enabled = true, isMember = false) => notify({ user: { user_id: 'reminders' }, companyId, enabled, isMember, templateStatus: enabled ? 'accepted' : 'not_requested' })
  const reminderCount = async () => Number((await db.query("SELECT COUNT(*) AS n FROM mini_company_follows WHERE user_id = 'reminders' AND status = 'active' AND wechat_enabled AND wechat_template_status = 'accepted'")).rows[0].n)
  const reminderLimit = (error) => error.code === 'COMPANY_REMINDER_LIMIT_REACHED' && error.statusCode === 403
  for (let i = 1; i <= 20; i++) await set('reminders', `c${i}`, true, true)
  await assert.rejects(reminder('c30'), (error) => error.code === 'SUBSCRIBE_AUTH_REQUIRED')
  await assert.rejects(notify({ user: { user_id: 'reminders' }, companyId: 'c1', enabled: true, templateStatus: 'rejected' }), (error) => error.code === 'SUBSCRIBE_AUTH_REQUIRED')
  for (let i = 1; i <= 4; i++) await reminder(`c${i}`)
  const concurrentReminders = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reminder(`c${i + 5}`)))
  assert.equal(concurrentReminders.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await reminderCount(), 5)
  await reminder('c1') // Idempotent at the cap.
  await assert.rejects(reminder('c20'), reminderLimit)
  await reminder('c1', false)
  await reminder('c20')
  assert.equal(await reminderCount(), 5)
  await assert.rejects(reminder('c1'), reminderLimit)
  for (let i = 1; i <= 20; i++) await reminder(`c${i}`, true, true)
  assert.equal(await reminderCount(), 20)
  await reminder('c20') // Expired membership preserves previously enabled reminders.
  for (let i = 1; i <= 5; i++) await reminder(`c${i}`, false)
  assert.equal(await reminderCount(), 15)
  await assert.rejects(reminder('c1'), reminderLimit)
  for (let i = 6; i <= 17; i++) await reminder(`c${i}`, false)
  await reminder('c1'); await reminder('c2')
  await assert.rejects(reminder('c3'), reminderLimit)
  assert.equal(await reminderCount(), 5)
  await set('reminders', 'c1', false)
  assert.equal(await reminderCount(), 4, 'unfollow also releases the reminder slot')
  await reminder('c3')
  assert.equal(await reminderCount(), 5)
  const count = async (user) => Number((await db.query("SELECT COUNT(*) AS n FROM mini_company_follows WHERE user_id = $1 AND status = 'active'", [user])).rows[0].n)
  const limitError = (error) => error.code === 'COMPANY_FOLLOW_LIMIT_REACHED' && error.statusCode === 403
  for (let i = 1; i <= 5; i++) await set('free', `c${i}`)
  await assert.rejects(set('free', 'c6'), limitError)
  await set('free', 'c1')
  assert.equal(await count('free'), 5)
  await set('free', 'c1', false)
  await set('free', 'c6')
  await assert.rejects(set('free', 'c1'), limitError)
  assert.equal(await count('free'), 5)

  for (let i = 1; i <= 20; i++) await set('expired', `c${i}`, true, true)
  await db.query("UPDATE mini_company_follows SET wechat_enabled = TRUE, wechat_template_status = 'accepted' WHERE user_id = 'expired'")
  await assert.rejects(set('expired', 'c21'), limitError)
  await set('expired', 'c20')
  assert.equal(await count('expired'), 20)
  assert.equal((await db.query("SELECT wechat_enabled FROM mini_company_follows WHERE user_id = 'expired' AND company_id = 'c20'")).rows[0].wechat_enabled, true)
  for (let i = 1; i <= 5; i++) await set('expired', `c${i}`, false)
  assert.equal(await count('expired'), 15)
  await assert.rejects(set('expired', 'c21'), limitError)
  for (let i = 6; i <= 17; i++) await set('expired', `c${i}`, false)
  assert.equal(await count('expired'), 3)
  await set('expired', 'c21'); await set('expired', 'c22')
  await assert.rejects(set('expired', 'c23'), limitError)
  assert.equal(await count('expired'), 5)
  await set('expired', 'c23', true, true)
  assert.equal(await count('expired'), 6)

  for (let i = 1; i <= 4; i++) await set('parallel', `c${i}`)
  const simultaneous = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => set('parallel', `c${i + 5}`)))
  assert.equal(simultaneous.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await count('parallel'), 5)
  assert.equal(await count('member'), 0, 'accounts remain isolated')
  await db.query("DELETE FROM company_job_history WHERE company_id = 'c30'")
  await set('member', 'c30', true, true)
  await db.query("UPDATE trusted_companies SET status = 'inactive' WHERE company_id = 'c30'")
  await set('member', 'c30')
  await assert.rejects(set('free', 'c30'), (error) => error.code === 'COMPANY_NOT_AVAILABLE')
  await set('member', 'c30', false)
  const gateway = fs.readFileSync('lib/api-handlers/mini-gateway.js', 'utf8')
  const newExpression = gateway.slice(gateway.indexOf('MAX(GREATEST('), gateway.indexOf('AS new_jobs_until,') + 'AS new_jobs_until'.length)
  await db.transaction(async (tx) => {
    await tx.exec(`INSERT INTO company_job_history VALUES
      ('new', NULL, TRUE, NOW() - INTERVAL '1 hour', NULL),
      ('old', NULL, TRUE, NOW() - INTERVAL '72 hours', NULL),
      ('unknown', NULL, TRUE, NULL, NULL), ('future', NULL, TRUE, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '1 hour'),
      ('first-seen', NULL, TRUE, NULL, NOW() - INTERVAL '1 hour'),
      ('rediscovered', NULL, TRUE, NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 hour'),
      ('closed', NOW(), TRUE, NOW(), NOW()), ('private', NULL, FALSE, NOW(), NOW());`)
    for (const id of ['new', 'old', 'unknown', 'future', 'first-seen', 'rediscovered', 'closed', 'private']) {
      const result = await tx.query(`SELECT COALESCE(new_jobs_until > NOW(), FALSE) AS is_new FROM (SELECT ${newExpression} FROM company_job_history h
        WHERE company_id = $1 AND h.closed_at IS NULL AND h.is_public_opportunity IS TRUE) deadlines`, [id])
      assert.equal(result.rows[0].is_new, ['new', 'first-seen', 'rediscovered'].includes(id), id)
    }
  })
  // PGlite serializes transactions; this validates real SQL, not remote multi-connection contention.
  console.log('PostgreSQL SQL execution passed: free cap, duplicate, cancel/re-follow, expiry 20->15->3->5, renewal, serialized simultaneous additions and isolation')
  console.log('NEW source timestamps passed: exact 72h boundary, unknown, future, closed and private jobs excluded')
  await db.exec(`CREATE TABLE career_watch_feed_snapshots (
    user_id text PRIMARY KEY, recommendations jsonb NOT NULL, generated_at timestamptz NOT NULL,
    fixed_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb);
    CREATE TABLE mini_career_entitlements (user_id text PRIMARY KEY, free_assessment_used_at timestamptz);
    INSERT INTO career_watch_feed_snapshots VALUES
      ('original', '[{"companyId":"new"}]', '2026-09-01', '[{"companyId":"original"}]'),
      ('legacy', '[{"companyId":"legacy"}]', '2026-08-31', '[]'),
      ('unused', '[]', '2026-09-01', '[]');
    INSERT INTO mini_career_entitlements VALUES ('original', '2026-08-01'), ('legacy', '2026-08-01'), ('unused', NULL);`)
  const migration = fs.readFileSync('server-utils/dal/migrations/084_mini_match_visit_refresh.sql', 'utf8')
  await db.exec(migration)
  const migrated = (await db.query('SELECT * FROM career_watch_feed_snapshots ORDER BY user_id')).rows
  assert.equal(migrated[0].fixed_recommendations[0].companyId, 'legacy')
  assert.equal(migrated[0].fixed_generated_at.toISOString(), '2026-08-31T00:00:00.000Z', 'legacy recovery uses its actual computation date')
  assert.equal(migrated[1].fixed_recommendations[0].companyId, 'original', 'migration preserves the original fixed match')
  assert.equal(migrated[1].fixed_generated_at.toISOString(), '2026-08-01T00:00:00.000Z')
  assert.equal(migrated[2].fixed_generated_at, null)
  await db.exec(migration)
  assert.deepEqual((await db.query('SELECT * FROM career_watch_feed_snapshots ORDER BY user_id')).rows, migrated, '084 can be rerun without rewriting original snapshots')
  console.log('Migration 084 passed: original snapshot preservation, honest legacy timestamps, unused accounts and idempotence')
} finally { await db.close() }
