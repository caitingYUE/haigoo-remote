import assert from 'node:assert/strict'
import fs from 'node:fs'

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const cronPaths = (config.crons || []).map((cron) => cron.path)

for (const task of ['stream-verify-links', 'job-sync', 'job-sync-enrich', 'job-sync-publish']) {
  assert.ok(!cronPaths.includes(`/api/cron/${task}`), `${task} must be manual-only`)
}
assert.ok(!cronPaths.includes('/api/cron/stream-crawl-trusted-jobs'))

const router = fs.readFileSync('api/cron/index.js', 'utf8')
assert.match(router, /taskName === 'stream-crawl-trusted-jobs'/)
assert.match(router, /res\.status\(410\)/)
assert.doesNotMatch(router, /import\('\.\.\/\.\.\/lib\/cron-handlers\/stream-crawl-trusted-jobs\.js'\)/)
assert.ok(router.indexOf("taskName === 'stream-crawl-trusted-jobs'") < router.indexOf('sendLog('))

const control = fs.readFileSync('src/components/CronTestControl.tsx', 'utf8')
assert.doesNotMatch(control, /\/api\/cron\/stream-crawl-trusted-jobs/)

console.log('Production cron policy passed')

const { default: retired } = await import('./lib/cron-handlers/job-sync.js')
const previousSecret = process.env.CRON_SECRET
process.env.CRON_SECRET = 'isolated-policy-test'
try {
  const invoke = (authorization) => {
    const response = { code: 200, body: null, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    retired({ headers: { authorization } }, response)
    return response
  }
  assert.equal(invoke('').code, 403)
  assert.equal(invoke('Bearer isolated-policy-test').code, 410)
} finally {
  if (previousSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousSecret
}
console.log('Retired crawl endpoints reject even authenticated scheduler invocations')
