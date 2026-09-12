import assert from 'node:assert/strict'
import fs from 'node:fs'

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const cronPaths = (config.crons || []).map((cron) => cron.path)

assert.ok(cronPaths.includes('/api/cron/stream-verify-links'))
assert.ok(!cronPaths.includes('/api/cron/stream-crawl-trusted-jobs'))

const router = fs.readFileSync('api/cron/index.js', 'utf8')
assert.match(router, /taskName === 'stream-crawl-trusted-jobs'/)
assert.match(router, /res\.status\(410\)/)
assert.doesNotMatch(router, /import\('\.\.\/\.\.\/lib\/cron-handlers\/stream-crawl-trusted-jobs\.js'\)/)
assert.ok(router.indexOf("taskName === 'stream-crawl-trusted-jobs'") < router.indexOf('sendLog('))

const control = fs.readFileSync('src/components/CronTestControl.tsx', 'utf8')
assert.doesNotMatch(control, /\/api\/cron\/stream-crawl-trusted-jobs/)

console.log('Production cron policy passed')
