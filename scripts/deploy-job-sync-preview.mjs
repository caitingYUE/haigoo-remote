// Website-only mini-preview release. No CloudRun, WeChat upload or production writes.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { neon } from '@neondatabase/serverless'
import { assertPreviewIsolation, databaseKeys, publishedFingerprint } from './job-sync-preview-safety.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = name => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const committedOnly = process.argv.includes('--committed-only')
const liveCrawlCheck = process.argv.includes('--live-crawl-check')
const liveProbes = []
const cohortChecks = []
const publicSmokeChecks = []
const checkCohort = process.argv.includes('--list-cohort-check')
const cohortNames = ['Braintrust','RWS','AB Agri','Telnyx','The Authentic Asian','The Meliore Foundation','澳大利亚格里菲斯大学','Scalerrs','Manicule','NewPath Conveyancing','RZR','Xsolla','Ola Chat','Cummins 康明斯','花旗','Pearson 培生','Randstad Enterprise','Hackmamba','ARC Group','AG1']
const stable = 'https://mini-preview.haigooremote.com'
const branch = 'codex/mini-1.0.33-production-recovery'
const migrations = ['091_trusted_job_sync.sql', '092_job_sync_manual_gate.sql', '093_manual_crawl_workflow.sql', '094_company_list_checks.sql']
const temporary = []
process.once('exit', () => temporary.forEach(p => fs.rmSync(p, { recursive: true, force: true })))
function run(command, args, options = {}) {
  try { return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 24 * 1024 * 1024, ...options }) }
  catch (error) {
    // Do not print child arguments or its environment: both may contain credentials.
    const output = `${error.stdout || ''}\n${error.stderr || ''}`
    const log = path.join(os.tmpdir(), `job-sync-preview-command-${Date.now()}.log`)
    fs.writeFileSync(log, output, { mode: 0o600 })
    throw new Error(`${path.basename(command)} failed (exit ${error.status}); private diagnostic: ${log}`)
  }
}
function cli(args, options = {}) {
  return arg('vercel-cli')
    ? run(process.execPath, [path.resolve(arg('vercel-cli')), ...args], options)
    : run('npx', ['--yes', 'vercel@58.5.1', ...args], options)
}
function readEnvironment(name) {
  assert(arg(name), `Required --${name}=/path/to/private.env`)
  const file = path.resolve(arg(name))
  assert.equal(fs.statSync(file).mode & 0o077, 0, `Environment file must be private (chmod 600): ${name}`)
  return dotenv.parse(fs.readFileSync(file))
}
function inspect(url) {
  const result = JSON.parse(cli(['inspect', url, '--json']))
  assert.equal(result.target, 'preview', 'Only Preview deployments may be promoted')
  assert.equal(result.readyState, 'READY', 'Deployment must be READY')
  return result
}
function snapshot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haigoo-job-sync-source-'))
  temporary.push(dir)
  // Include reviewed untracked implementation files; omit ignored/secrets/artifacts.
  if (committedOnly) run('git', ['diff', '--quiet', 'HEAD'])
  const files = run('git', committedOnly ? ['ls-tree','-r','--name-only','-z','HEAD'] : ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
  const manifest = []
  for (const file of [...new Set(files)].sort()) {
    if (/(^|\/)(\.env(?:\.|$)|node_modules\/|\.git\/|\.vercel\/)/.test(file)) continue
    const from = path.resolve(root, file), to = path.resolve(dir, file)
    assert(from.startsWith(root + path.sep) && to.startsWith(dir + path.sep), 'Unsafe snapshot path')
    if (!fs.existsSync(from)) continue
    assert(!fs.lstatSync(from).isSymbolicLink(), `Symlink must be reviewed separately: ${file}`)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    manifest.push(`${file}:${createHash('sha256').update(fs.readFileSync(to)).digest('hex')}`)
  }
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json')))
  config.crons = [] // Manual preview acceptance only; no scheduled production-like side effects.
  fs.writeFileSync(path.join(dir, 'vercel.json'), JSON.stringify(config, null, 2) + '\n')
  // Only exists in this Preview snapshot. Produce short-lived signatures for
  // three fixed read routes; master keys never leave the function. The CLI then
  // carries the requests through Vercel's existing deployment protection.
  fs.writeFileSync(path.join(dir, 'api/job-sync-preview-check.js'), `
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const expected = Buffer.from('Bearer ' + (process.env.JOB_SYNC_PREVIEW_SMOKE_SECRET || ''))
  const received = Buffer.from(String(req.headers.authorization || ''))
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.JOB_SYNC_PREVIEW_SMOKE_SECRET || expected.length !== received.length || !timingSafeEqual(expected, received)) return res.status(403).json({ success: false })
  if (req.method !== 'GET') return res.status(405).json({ success: false })
  try {
    if (['crawl','verify','listing'].includes(req.query.probe)) {
      const { probePreviewSource } = await import('../lib/services/job-sync/preview-probe.js')
      return res.json({success:true,result:await probePreviewSource(String(req.query.name||''),req.query.probe)})
    }
    const probes = []
    for (const action of ['career_watch_options', 'membership_plans', 'companies']) {
      const query = action === 'companies' ? { openid: '', page: '1', pageSize: '5' } : {}
      const timestamp = String(Date.now())
      const signature = createHmac('sha256', process.env.MINI_GATEWAY_SHARED_SECRET || '').update('GET:' + action + ':' + timestamp + ':' + createHash('sha256').update(JSON.stringify(query)).digest('hex')).digest('hex')
      probes.push({ route: '/api/mini?' + new URLSearchParams({ action, ...query }), headers: { 'X-Haigoo-Mini-Timestamp': timestamp, 'X-Haigoo-Mini-Signature': signature } })
    }
    return res.json({ success: true, probes })
  } catch { return res.status(502).json({ success: false }) }
}
`)
  fs.mkdirSync(path.join(dir, '.vercel'))
  fs.copyFileSync(path.join(root, '.vercel/project.json'), path.join(dir, '.vercel/project.json'))
  run('git', ['init', '--initial-branch', branch], { cwd: dir })
  for (const field of ['name', 'email']) run('git', ['config', `user.${field}`, run('git', ['config', '--get', `user.${field}`]).trim()], { cwd: dir })
  run('git', ['remote', 'add', 'origin', run('git', ['remote', 'get-url', 'origin']).trim()], { cwd: dir })
  run('git', ['add', '-A'], { cwd: dir })
  run('git', ['commit', '-m', 'Snapshot for manual job sync preview acceptance'], { cwd: dir })
  return { dir, sourceHash: createHash('sha256').update(manifest.join('\n')).digest('hex'), files: manifest.length }
}
function request(origin, route, token = '', headers = {}, requestBody) {
  // curl config via stdin keeps authentication out of child command arguments.
  const allHeaders = { ...(requestBody ? {'Content-Type':'application/json'} : {}), ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const config = Object.entries(allHeaders).map(([key, value]) => `header = ${JSON.stringify(`${key}: ${value}`)}`).join('\n') + '\n' + (requestBody ? 'request = "POST"\ndata = '+JSON.stringify(JSON.stringify(requestBody))+'\n' : '')
  const output = cli(['curl', route, '--deployment', origin, '--yes', '--', '--silent', '--show-error', '--max-time', '60', '--config', '-', '--write-out', '\n%{http_code}'], { input: config })
  const lines = output.trimEnd().split('\n'), status = Number(lines.pop()), body = lines.join('\n')
  return { status, body, json: () => JSON.parse(body) }
}
async function verify(origin, sql, environment) {
  for (const route of ['/', '/jobs', '/companies']) {
    const response = request(origin, route)
    assert.equal(response.status, 200, `Public page must load: ${route}`)
    assert.match(response.body, /<div id="root"/, `Public app shell missing: ${route}`)
  }
  const publicJobs = request(origin, '/api/data/processed-jobs?status=active&isApproved=true&limit=5&page=1')
  const featured = request(origin, '/api/data/processed-jobs?action=featured_home')
  const publicCompanies = request(origin, '/api/data?resource=companies&page=1&limit=5')
  for (const response of [publicJobs, featured, publicCompanies]) assert.equal(response.status, 200, 'Public API smoke failed')
  assert(publicJobs.json().jobs?.length > 0, 'Public job feed must remain populated')
  assert(publicJobs.json().jobs.every(j => j.isApproved === true && j.status === 'active' && !j.memberOnly), 'Public feed access policy changed')
  assert(Array.isArray(featured.json().jobs), 'Featured home API must return jobs')
  assert(publicCompanies.json().companies?.length > 0, 'Public company feed must remain populated')
  publicSmokeChecks.push({origin,pages:['/','/jobs','/companies'],jobs:publicJobs.json().jobs.length,featured:featured.json().jobs.length,companies:publicCompanies.json().companies.length})
  console.log(`Verified public pages, jobs, featured home and companies: ${origin}`)
  assert.equal(request(origin, '/admin/trusted-companies').status, 200, 'Admin page must load')
  assert.equal(request(origin, '/api/admin/job-sync').status, 403, 'Anonymous admin request must fail')
  assert.equal(request(origin, '/api/cron/job-sync').status, 403, 'Anonymous worker request must fail')
  const [admin] = await sql.query("SELECT user_id FROM users WHERE roles->>'admin'='true' OR roles->>'super_admin'='true' ORDER BY user_id LIMIT 1")
  assert(admin, 'An existing preview admin is required; this script never creates one')
  const token = jwt.sign({ userId: admin.user_id }, environment.JWT_SECRET, { expiresIn: '5m' })
  const sync = request(origin, '/api/admin/job-sync?workflow=listing', token)
  assert.equal(sync.status, 200, 'Authenticated job sync must load')
  const payload = sync.json()
  assert(payload.success && payload.states, 'Listing workflow schema/response mismatch')
  assert.equal(request(origin, '/api/admin/job-sync?workflow=manual', token, {}, {action:'start',mode:'preflight'}).status,410,'Legacy write route must be retired')
  const listing = request(origin, '/api/data?resource=companies&page=1&limit=5&sortBy=jobCount&sortOrder=desc', token).json()
  assert(Array.isArray(listing.companies) && listing.companies.length, 'Company list must load')
  for (const co of listing.companies) {
    const id = co.id || co.company_id
    const workflow = request(origin, `/api/admin/job-sync?workflow=listing&companyIds=${encodeURIComponent(id)}`, token)
    assert.equal(workflow.status, 200, 'Company-scoped manual workflow must load')
    assert(workflow.json().states[id], 'Company check state must be explicit')
    const [count] = await sql.query("SELECT count(*)::integer AS count FROM jobs WHERE company_id=$1 AND status='active' AND is_approved IS TRUE", [id])
    assert.equal(Number(co.jobCount), count.count, 'Company active count must match preview database')
    assert(Number.isFinite(Number(co.pendingReviewCount)), 'Pending count must be present')
    const detail = request(origin, `/api/data/processed-jobs?companyId=${encodeURIComponent(id)}&isAdmin=true&status=active&isApproved=true&limit=1&page=1`, token).json()
    assert.equal(Number(detail.total), count.count, 'Company modal count must match active count')
  }
  assert.equal(request(origin, '/api/job-sync-preview-check').status, 403, 'Preview diagnostic requires authentication')
  const gateway = request(origin, '/api/job-sync-preview-check', environment.JOB_SYNC_PREVIEW_SMOKE_SECRET)
  assert.equal(gateway.status, 200, 'Preview gateway diagnostic must succeed')
  assert(gateway.json().success, 'Preview gateway diagnostic failed')
  for (const probe of gateway.json().probes) {
    for (const target of new Set([stable, origin])) {
      const response = request(target, probe.route, '', probe.headers)
      assert.equal(response.status, 200, `Gateway contract ${probe.route} on ${target}`)
      assert(response.json().success, `Gateway contract failed: ${probe.route}`)
    }
  }
  console.log(`Verified admin authentication, review panel, 5 company/modal counts and mini gateway: ${origin}`)
  if (liveCrawlCheck && origin !== stable) {
    const [sample]=await sql.query("SELECT company_id FROM trusted_companies WHERE name='RWS' AND status='active' LIMIT 1")
    assert(sample,'RWS preview sample required')
    const started=request(origin,'/api/admin/job-sync?workflow=listing',token,{}, {action:'start',companyIds:[sample.company_id],requestId:'release-list-'+Date.now(),reset:true})
    assert.equal(started.status,200,'Authenticated list start must succeed')
    const stepped=request(origin,'/api/admin/job-sync?workflow=listing',token,{}, {action:'step',companyId:sample.company_id,runId:started.json().run.id})
    assert.equal(stepped.status,200,'Authenticated list step must succeed')
    const attempt=stepped.json().run.attempts[0]
    assert.equal(attempt.status,'complete','Persistent list check must finish without internal errors')
    assert(attempt.result.checked_at && attempt.result.listed_count>0,'Persistent list evidence must be saved')
    console.log('Verified authenticated start/step, saved list results and retired preflight writes')

    for (const name of checkCohort ? cohortNames.filter(n=>!['Ola Chat','Randstad Enterprise','ARC Group'].includes(n)) : ['RWS','Telnyx','The Meliore Foundation','Manicule','澳大利亚格里菲斯大学','Braintrust','Hackmamba','AB Agri','花旗','Cummins 康明斯','Pearson 培生']) {
      const response=request(origin,'/api/job-sync-preview-check?'+new URLSearchParams({probe:'listing',name}),environment.JOB_SYNC_PREVIEW_SMOKE_SECRET)
      assert.equal(response.status,200,`Real list probe must respond: ${name}`)
      const result=response.json().result
      liveProbes.push(result)
      console.log(`Real list probe: ${JSON.stringify(result)}`)
      assert.equal(typeof result.unknown,'boolean','Probe must report certainty')
      if(!result.complete) assert.equal(result.missing,0,'Incomplete list must not report missing jobs')
      if(['RWS','Telnyx'].includes(name)) assert(result.listed>0,'Core ATS list should be readable')
    }
    if (checkCohort) {
      // Explicit release flag for this user-requested manual staging test;
      // never schedules recurring checks or changes company/job content.
      const cohort=await sql.query("SELECT company_id,name FROM trusted_companies WHERE name=ANY($1::text[]) AND status='active'",[cohortNames])
      assert.equal(cohort.length,cohortNames.length,'Manual cohort must match the requested 20 companies')
      const auth=()=>jwt.sign({userId:admin.user_id},environment.JWT_SECRET,{expiresIn:'5m'})
      const run=request(origin,'/api/admin/job-sync?workflow=listing',auth(),{}, {action:'start',companyIds:cohort.map(c=>c.company_id),requestId:'manual-cohort-'+Date.now()})
      assert.equal(run.status,200)
      for (const co of cohort) {
        const response=request(origin,'/api/admin/job-sync?workflow=listing',auth(),{}, {action:'step',runId:run.json().run.id,companyId:co.company_id})
        assert.equal(response.status,200)
        assert(!response.json().busy,'Another check is running; do not silently duplicate it')
        const attempt=response.json().run.attempts.find(a=>a.company_id===co.company_id)
        assert(['complete','skipped'].includes(attempt.status),'Manual cohort attempt must finish')
      }
      const view=request(origin,'/api/admin/job-sync?'+new URLSearchParams({workflow:'listing',companyIds:cohort.map(c=>c.company_id).join(',')}),auth())
      assert.equal(view.status,200)
      for(const co of cohort){const state=view.json().states[co.company_id];cohortChecks.push({name:co.name,status:state.status,failures:state.failures,candidateCount:state.candidate_count,reasons:state.reasons,new:state.findings.filter(f=>f.kind==='new').length,missing:state.findings.filter(f=>f.kind==='missing').length})}
      console.log('Verified manual cohort checks: '+JSON.stringify(cohortChecks))
    }
  }
}

try {
  const preview = readEnvironment('env-file'), production = readEnvironment('production-env-file')
  // Sensitive JWT exports are empty. Use a deployment-specific Preview key;
  // this intentionally requires preview website users to sign in again.
  if (!preview.JWT_SECRET) preview.JWT_SECRET = randomBytes(48).toString('base64url')
  assertPreviewIsolation(preview, production)
  const sql = neon(preview.DATABASE_URL)
  const before = await publishedFingerprint(sql)
  const previous = inspect(stable)
  console.log(`Isolation verified. Preview baseline: ${before.companies} companies / ${before.jobs} jobs. Previous deployment: ${previous.url}`)
  if (!apply) {
    console.log('Read-only check complete. --apply runs tests, preview-only migrations, deploy, verification and alias promotion.')
  } else {
    const attempt = path.join(os.tmpdir(), `job-sync-preview-baseline-${Date.now()}.json`)
    fs.writeFileSync(attempt, JSON.stringify({ recordedAt: new Date().toISOString(), baseline: before, previous: previous.url }, null, 2) + '\n', { mode: 0o600 })
    console.log(`Non-secret pre-release baseline: ${attempt}`)
    for (const args of [['run', 'test:job-category-search'], ['run', 'test:company-list-check'], ['run', 'test:job-sync'], ['run', 'test:manual-crawl'], ['run', 'test:job-sync-preview'], ['run', 'build']]) run('npm', args, { stdio: 'inherit' })
    for (const test of ['test-cron-policy.js', 'test-admin-job-reliability.js', 'test-admin-company-job-regressions.js', 'test-processed-jobs-write-policy.js', 'test-mini-gateway-signature.js']) run(process.execPath, [test], { stdio: 'inherit' })
    const snap = snapshot()
    console.log(`Reviewed source snapshot: ${snap.files} files; SHA256 ${snap.sourceHash}`)
    const environment = { ...preview, JOB_SYNC_ENABLED: 'false', JOB_SYNC_TRANSLATE_ENABLED: 'false', MINI_WECHAT_REMINDERS_ENABLED: 'false', JOB_SYNC_PREVIEW_SMOKE_SECRET: randomBytes(48).toString('base64url') }
    for (const key of databaseKeys) environment[key] = preview.DATABASE_URL
    const [ledger] = await sql.query("SELECT to_regclass('public.schema_migrations') AS table_name")
    const appliedMigrations = new Set(ledger?.table_name
      ? (await sql.query('SELECT migration_name FROM schema_migrations')).map(row => row.migration_name) : [])
    for (const migration of migrations) {
      // Reuse the verified connection for already-applied migrations; opening a
      // fresh CLI process for each no-op needlessly creates new remote connections.
      if (appliedMigrations.has(migration)) { console.log(`${migration} already applied (verified ledger)`); continue }
      const result = run(process.execPath, ['scripts/run-sql-migration.mjs', '--database-url-env=DATABASE_URL', migration], { env: { ...process.env, ...environment, DOTENV_CONFIG_PATH: '/dev/null' } })
      console.log(result.trim())
    }
    assert.deepEqual(await publishedFingerprint(sql), before, 'Migration changed original published data; promotion blocked')
    // Sensitive Vercel variables export as empty: inherit them, never erase them.
    const keys = Object.keys(environment).filter(k => environment[k] && environment[k] !== '[SENSITIVE]' && !/^VERCEL_|^CI$|^NODE_ENV$/.test(k))
    const output = cli(['deploy', '--yes', '--force', '--archive=tgz', '--target=preview', ...keys.flatMap(k => ['--env', k])], { cwd: snap.dir, env: { ...process.env, ...environment } })
    const origin = output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i)?.[0]
    assert(origin, 'No immutable deployment URL returned')
    inspect(origin)
    console.log(`Immutable preview ready: ${origin}`)
    await verify(origin, sql, environment)
    assert.deepEqual(await publishedFingerprint(sql), before, 'Verification changed published data; promotion blocked')
    // Do not overwrite another release that moved this alias during our build.
    assert.equal(inspect(stable).id, previous.id, 'Preview alias changed concurrently; promotion blocked')
    cli(['alias', 'set', origin, new URL(stable).hostname])
    let after
    try {
      await verify(stable, sql, environment)
      after = await publishedFingerprint(sql)
      assert.deepEqual(after, before, 'Post-promotion verification changed published data')
    }
    catch (error) {
      if (inspect(stable).url === new URL(origin).hostname) {
        cli(['alias', 'set', `https://${previous.url.replace(/^https:\/\//, '')}`, new URL(stable).hostname])
      }
      throw error
    }
    const report = { releasedAt: new Date().toISOString(), origin, alias: stable, previous: previous.url, sourceHash: snap.sourceHash, sourceCommit: committedOnly ? run('git',['rev-parse','HEAD']).trim() : null, baseline: before, after, migrations, automaticSchedules: false, translation: false, liveProbes, cohortChecks, publicSmokeChecks }
    const reportPath = path.resolve(arg('report') || 'docs/qa/job-sync-preview-release.json')
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    console.log(`Preview promoted: ${origin} -> ${stable}\nReport: ${reportPath}`)
  }
} catch (error) {
  console.error(`Preview release stopped: ${error.message}`)
  process.exitCode = 1
}
