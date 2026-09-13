import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bounded guest probes only: no synthetic identities or account/payment writes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const actions = ['career_watch_options', 'companies', 'membership_plans', 'content_home']
const rounds = Number(process.argv.find(arg => arg.startsWith('--rounds='))?.split('=')[1] || 5)
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) throw new Error('rounds must be 1–5')
const output = path.resolve(root, process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'tmp/mini-production-readonly.json')
const report = { startedAt: new Date().toISOString(), transport: 'CloudBase SDK → production CloudRun → Vercel', rounds, samples: [] }
for (let round = 1; round <= rounds; round++) {
  for (const action of actions) {
    const result = spawnSync(process.execPath, [
      'scripts/verify-mini-gateway.mjs', '--target=production', '--via-cloudrun', `--action=${action}`
    ], { cwd: root, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024 })
    let payload
    try { payload = JSON.parse(result.stdout || '') } catch { /* failed probes stay in the report */ }
    const sample = { round, action, at: new Date().toISOString(), passed: result.status === 0 && payload?.status === 200 }
    if (sample.passed) {
      for (const key of ['status', 'requestDurationMs', 'companyAccessScope', 'returnedCompanies', 'returnedRoles', 'returnedNotes', 'returnedPlans', 'paymentAvailable']) sample[key] = payload[key]
    } else {
      sample.error = result.error?.code || (result.stderr || '').split('\n').find(line => line.startsWith('Error: Gateway check failed')) || `Probe exit ${result.status}`
    }
    report.samples.push(sample)
    console.log(`${round}/${rounds} ${action}: ${sample.passed ? `PASS ${sample.requestDurationMs}ms` : sample.error}`)
  }
}
report.finishedAt = new Date().toISOString()
report.summary = actions.map(action => {
  const samples = report.samples.filter(sample => sample.action === action)
  const times = samples.filter(sample => sample.passed).map(sample => sample.requestDurationMs).sort((a, b) => a - b)
  const middle = Math.floor(times.length / 2)
  const medianMs = times.length ? (times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2) : null
  return { action, total: samples.length, passed: times.length, minMs: times[0] ?? null, medianMs, maxMs: times.at(-1) ?? null }
})
report.passed = report.samples.every(sample => sample.passed)
report.limitations = 'Small guest-only sample, includes SDK/network time; not a load test or a guarantee of future availability. Account lifecycle tests run in isolation.'
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report.summary, null, 2))
if (!report.passed) process.exitCode = 1
