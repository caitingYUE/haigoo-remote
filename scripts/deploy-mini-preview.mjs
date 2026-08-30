import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
if (previewEnvironment.VERCEL_ENV !== 'preview' || !previewEnvironment.MINI_GATEWAY_SHARED_SECRET) {
  throw new Error('Preview deployment contract must contain VERCEL_ENV=preview and MINI_GATEWAY_SHARED_SECRET')
}
const previewContractKeys = [
  'DATABASE_URL',
  'MINI_GATEWAY_SHARED_SECRET',
  'MINI_MATCH_FIXED_SNAPSHOT_ENABLED'
]
const previewDeploymentEnvironment = Object.fromEntries(
  previewContractKeys.map((key) => [key, previewEnvironment[key]]).filter(([, value]) => value)
)
for (const key of previewContractKeys.slice(0, 2)) {
  if (!previewDeploymentEnvironment[key]) throw new Error(`Preview deployment contract is missing ${key}`)
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
      `--action=${action}`,
      `--env-file=${path.resolve(envFile)}`,
      '--vercel-curl'
    ], { stdio: 'inherit' })
  }
}

function verifySmoke(origin) {
  run('node', [
    'scripts/verify-mini-experience-smoke.mjs',
    `--env-file=${path.resolve(envFile)}`,
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
  `--preview-env-file=${path.resolve(envFile)}`
], { stdio: 'inherit' })
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.unused, 'career_watch_state', ['--expect-match-state=unused'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'career_watch_state', ['--expect-match-state=fixed_free'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.fixed, 'companies', ['--expect-company-scope=free_fixed', '--expect-company-total=5'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'career_watch_state', ['--expect-match-state=member_dynamic'])
verifyCloudrunFixture(MINI_SMOKE_FIXTURES.member, 'companies', ['--expect-company-scope=member_all'])

run('npm', ['--prefix', 'miniprogram', 'run', 'upload:weapp:experience'], { stdio: 'inherit' })

console.log(`Preview gateway promoted and experience bundle uploaded: ${deploymentUrl} -> ${stableOrigin}`)
