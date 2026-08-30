import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { MINI_SMOKE_FIXTURES } from './mini-smoke-fixtures.mjs'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stableOrigin = 'https://mini-preview.haigooremote.com'
const previewBranch = 'codex/mini-1.0.7-release'
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
const previewEnvironment = dotenv.parse(fs.readFileSync(path.resolve(envFile)))
if (previewEnvironment.VERCEL_ENV !== 'preview' || !previewEnvironment.DATABASE_URL) {
  throw new Error('Preview deployment contract must contain VERCEL_ENV=preview and DATABASE_URL')
}
const parseEnvironment = (value) => typeof value === 'string'
  ? JSON.parse(value)
  : Array.isArray(value)
    ? Object.fromEntries(value.map((item) => [item.Key || item.key, item.Value || item.value]))
    : { ...(value || {}) }
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const require = createRequire(import.meta.url)
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { getCloudrunService } = require(path.join(globalModules, '@cloudbase/cli/lib/commands/cloudrun/base.js'))
const developmentService = await getCloudrunService('haigoo-dev-d2gctbzxma401b345')
const developmentDetail = await developmentService.detail({ serverName: 'haigoo-mini' })
const developmentEnvironment = parseEnvironment(developmentDetail.ServerConfig?.EnvParams)
const developmentContract = {
  MINI_GATEWAY_SHARED_SECRET: String(developmentEnvironment.MINI_GATEWAY_SHARED_SECRET || '').trim(),
  WECHAT_MINI_APP_ID: String(developmentEnvironment.WECHAT_MINI_APP_ID || '').trim()
}
if (developmentContract.MINI_GATEWAY_SHARED_SECRET.length < 32) {
  throw new Error('Development CloudRun gateway secret is unavailable')
}
if (!/^wx[0-9a-f]{16}$/i.test(developmentContract.WECHAT_MINI_APP_ID)) {
  throw new Error('Development CloudRun Mini Program App ID is invalid')
}
const previewContractKeys = [
  'DATABASE_URL',
  'MINI_GATEWAY_SHARED_SECRET',
  'WECHAT_MINI_APP_ID',
  'MINI_MATCH_FIXED_SNAPSHOT_ENABLED'
]
const effectiveEnvironment = { ...previewEnvironment, ...developmentContract }
const previewDeploymentEnvironment = Object.fromEntries(
  previewContractKeys.map((key) => [key, effectiveEnvironment[key]]).filter(([, value]) => value)
)
for (const key of [
  'DATABASE_URL',
  'MINI_GATEWAY_SHARED_SECRET',
  'WECHAT_MINI_APP_ID'
]) {
  if (!previewDeploymentEnvironment[key]) throw new Error(`Preview deployment contract is missing ${key}`)
}
const effectiveEnvFile = path.join(os.tmpdir(), `haigoo-mini-preview-${process.pid}.env`)
fs.writeFileSync(
  effectiveEnvFile,
  Object.entries(effectiveEnvironment).map(([key, value]) => `${key}=${JSON.stringify(String(value))}`).join('\n'),
  { mode: 0o600 }
)
process.once('exit', () => fs.rmSync(effectiveEnvFile, { force: true }))

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
      `--action=${action}`,
      `--env-file=${effectiveEnvFile}`,
      '--vercel-curl'
    ], { stdio: 'inherit' })
  }
}

function verifySmoke(origin) {
  run('node', [
    'scripts/verify-mini-experience-smoke.mjs',
    `--env-file=${effectiveEnvFile}`,
    `--origin=${origin}`,
    '--vercel-curl'
  ], { stdio: 'inherit' })
}

function createVerifiedSourceSnapshot() {
  const trackedStatus = run('git', ['status', '--porcelain', '--untracked-files=no']).trim()
  if (trackedStatus) {
    throw new Error('Preview deployment requires a clean tracked worktree')
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haigoo-mini-preview-source-'))
  const trackedFiles = run('git', ['ls-files', '-z']).split('\0').filter(Boolean)
  for (const relativePath of trackedFiles) {
    const sourcePath = path.resolve(rootDir, relativePath)
    const targetPath = path.resolve(stagingDir, relativePath)
    if (!sourcePath.startsWith(`${rootDir}${path.sep}`) || !targetPath.startsWith(`${stagingDir}${path.sep}`)) {
      throw new Error(`Unsafe tracked path in release snapshot: ${relativePath}`)
    }
    const sourceStat = fs.lstatSync(sourcePath)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    if (sourceStat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(sourcePath), targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
      fs.chmodSync(targetPath, sourceStat.mode)
    }
  }

  const projectLink = path.join(rootDir, '.vercel', 'project.json')
  if (!fs.existsSync(projectLink)) {
    throw new Error('Preview deployment requires a linked Vercel project')
  }
  const stagingProjectLink = path.join(stagingDir, '.vercel', 'project.json')
  fs.mkdirSync(path.dirname(stagingProjectLink), { recursive: true })
  fs.copyFileSync(projectLink, stagingProjectLink)

  // Vercel scopes Preview variables by Git branch. The release snapshot is
  // intentionally clean, so restore only the branch identity needed for the
  // correct Preview contract instead of deploying the dirty source checkout.
  run('git', ['init', '--initial-branch', previewBranch], { cwd: stagingDir })
  run('git', ['config', 'user.name', 'Haigoo Preview Release'], { cwd: stagingDir })
  run('git', ['config', 'user.email', 'preview-release@localhost'], { cwd: stagingDir })
  const remoteUrl = run('git', ['remote', 'get-url', 'origin']).trim()
  if (remoteUrl) run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: stagingDir })
  run('git', ['add', '--all'], { cwd: stagingDir })
  run('git', ['commit', '--quiet', '-m', 'Preview release snapshot'], { cwd: stagingDir })
  if (run('git', ['branch', '--show-current'], { cwd: stagingDir }).trim() !== previewBranch) {
    throw new Error(`Preview source snapshot must use ${previewBranch}`)
  }

  const gatewaySource = fs.readFileSync(
    path.join(stagingDir, 'lib', 'api-handlers', 'mini-gateway.js'),
    'utf8'
  )
  for (const marker of [
    'res = attachRequestTrace(res, requestId)',
    'publicOpportunityUpdatedAt: row.public_opportunity_updated_at || null'
  ]) {
    if (!gatewaySource.includes(marker)) {
      throw new Error(`Vercel source snapshot is missing release marker: ${marker}`)
    }
  }

  return stagingDir
}

function runPreflight() {
  for (const script of ['test:mini-runtime', 'test:mini-release', 'test:mini-gateway', 'test:mini-career-watch', 'test:mini-company-match']) {
    run('npm', ['run', script], { stdio: 'inherit' })
  }
  run('npm', ['--prefix', 'miniprogram', 'run', 'type-check'], { stdio: 'inherit' })
  run('npm', ['--prefix', 'miniprogram', 'run', 'build:weapp:experience'], { stdio: 'inherit' })
  run('node', ['-r', 'dotenv/config', 'scripts/setup-mini-smoke-identities.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: effectiveEnvFile,
      MINI_SMOKE_ALLOW_SETUP: 'true'
    }
  })
}

async function verifyCloudrunFixture(fixture, action, expectations = []) {
  const args = [
    'scripts/verify-mini-gateway.mjs',
    '--target=development',
    '--via-cloudrun',
    `--action=${action}`,
    `--openid=${fixture.openid}`,
    ...expectations
  ]
  let lastError
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      const output = run('node', args)
      process.stdout.write(output)
      return
    } catch (error) {
      lastError = error
      if (attempt === 18) {
        if (error?.stdout) process.stdout.write(String(error.stdout))
        if (error?.stderr) process.stderr.write(String(error.stderr))
        throw error
      }
      console.log(`CloudRun revision is not ready yet (${attempt}/18); retrying in 10 seconds.`)
      await new Promise((resolve) => setTimeout(resolve, 10_000))
    }
  }
  throw lastError
}

runPreflight()

let deploymentUrl
if (suppliedDeployment) {
  deploymentUrl = normalizeDeployment(suppliedDeployment)
} else {
  const stagingDir = createVerifiedSourceSnapshot()
  try {
    const deploymentEnvironmentArgs = Object.keys(previewDeploymentEnvironment)
      .flatMap((key) => ['--env', key])
    const output = run('npx', [
      'vercel', 'deploy', '--yes', '--force', '--archive=tgz',
      ...deploymentEnvironmentArgs
    ], {
      cwd: stagingDir,
      env: {
        ...process.env,
        ...previewDeploymentEnvironment
      }
    })
    deploymentUrl = normalizeDeployment(output)
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
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
run('node', [
  'scripts/deploy-mini-cloudrun.mjs',
  '--target=development',
  '--sync-preview-contract',
  `--preview-env-file=${effectiveEnvFile}`
], { stdio: 'inherit' })
await verifyCloudrunFixture(MINI_SMOKE_FIXTURES.unused, 'career_watch_state', ['--expect-match-state=unused'])
await verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'career_watch_state', ['--expect-match-state=fixed_free'])
await verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'companies', ['--expect-company-scope=free_fixed', '--expect-company-total=5'])
await verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'career_watch_state', ['--expect-match-state=member_dynamic'])
await verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'companies', ['--expect-company-scope=member_all'])

run('npm', ['--prefix', 'miniprogram', 'run', 'upload:weapp:experience'], { stdio: 'inherit' })

console.log(`Preview gateway promoted and experience bundle uploaded: ${deploymentUrl} -> ${stableOrigin}`)
