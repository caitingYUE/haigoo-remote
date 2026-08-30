import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MINI_SMOKE_FIXTURES } from './mini-smoke-fixtures.mjs'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stableOrigin = 'https://mini-preview.haigooremote.com'
const suppliedDeployment = process.argv
  .find((argument) => argument.startsWith('--deployment='))
  ?.slice('--deployment='.length)
const envFile = process.argv
  .find((argument) => argument.startsWith('--env-file='))
  ?.slice('--env-file='.length)
const contractActions = ['sync', 'career_watch_options', 'companies', 'membership_plans']

if (!envFile || !fs.existsSync(path.resolve(envFile))) {
  throw new Error('Preview deployment requires --env-file=/path/to/preview.env for authenticated release smoke tests')
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    ...options
  })
}

function normalizeDeployment(value) {
  const match = String(value || '').match(/https:\/\/[a-z0-9-]+\.vercel\.app/i)
  if (!match) throw new Error('Unable to identify the Vercel Preview deployment URL')
  return match[0]
}

function verifyDeployment(origin) {
  for (const action of contractActions) {
    run('node', [
      'scripts/verify-mini-gateway.mjs',
      '--target=development',
      `--origin=${origin}`,
      `--action=${action}`
    ], { stdio: 'inherit' })
  }
}

function verifySmoke(origin) {
  run('node', [
    'scripts/verify-mini-experience-smoke.mjs',
    `--env-file=${path.resolve(envFile)}`,
    `--origin=${origin}`
  ], { stdio: 'inherit' })
}

function runPreflight() {
  for (const script of ['test:mini-runtime', 'test:mini-release', 'test:mini-career-watch', 'test:mini-company-match']) {
    run('npm', ['run', script], { stdio: 'inherit' })
  }
  run('npm', ['--prefix', 'miniprogram', 'run', 'type-check'], { stdio: 'inherit' })
  run('npm', ['--prefix', 'miniprogram', 'run', 'build:weapp:experience'], { stdio: 'inherit' })
  run('node', ['-r', 'dotenv/config', 'scripts/setup-mini-smoke-identities.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: path.resolve(envFile),
      MINI_SMOKE_ALLOW_SETUP: 'true'
    }
  })
}

function verifyCloudrunFixture(fixture, action, expectations = []) {
  run('node', [
    'scripts/verify-mini-gateway.mjs',
    '--target=development',
    '--via-cloudrun',
    `--action=${action}`,
    `--openid=${fixture.openid}`,
    ...expectations
  ], { stdio: 'inherit' })
}

runPreflight()

let deploymentUrl
if (suppliedDeployment) {
  deploymentUrl = normalizeDeployment(suppliedDeployment)
} else {
  const output = run('npx', ['vercel', 'deploy', '--yes'])
  deploymentUrl = normalizeDeployment(output)
}

// Verify the immutable deployment before moving the stable alias. A failed
// deployment therefore cannot replace the last known-good development gateway.
// These checks deliberately cover the two contracts required by the current
// Mini Program instead of accepting a deployment merely because legacy sync works.
verifyDeployment(deploymentUrl)
verifySmoke(deploymentUrl)

run('npx', ['vercel', 'alias', 'set', deploymentUrl, new URL(stableOrigin).hostname], {
  stdio: 'inherit'
})

verifyDeployment(stableOrigin)
verifySmoke(stableOrigin)

// CloudRun is switched only after both the immutable deployment and stable
// Preview alias pass. If this step fails, the WeChat experience bundle is not
// uploaded and the current formal Mini Program remains untouched.
run('node', ['scripts/deploy-mini-cloudrun.mjs', '--target=development'], { stdio: 'inherit' })
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.unused, 'career_watch_state', ['--expect-match-state=unused'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'career_watch_state', ['--expect-match-state=fixed_free'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'companies', ['--expect-company-scope=free_fixed', '--expect-company-total=5'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'career_watch_state', ['--expect-match-state=member_dynamic'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'companies', ['--expect-company-scope=member_all'])

run('npm', ['--prefix', 'miniprogram', 'run', 'upload:weapp:experience'], { stdio: 'inherit' })

console.log(`Preview gateway promoted and experience bundle uploaded: ${deploymentUrl} -> ${stableOrigin}`)
