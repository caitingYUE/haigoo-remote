import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stableOrigin = 'https://mini-preview.haigooremote.com'
const suppliedDeployment = process.argv
  .find((argument) => argument.startsWith('--deployment='))
  ?.slice('--deployment='.length)
const contractActions = ['sync', 'career_watch_options', 'companies', 'membership_plans']

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

run('npx', ['vercel', 'alias', 'set', deploymentUrl, new URL(stableOrigin).hostname], {
  stdio: 'inherit'
})

verifyDeployment(stableOrigin)

console.log(`Preview gateway promoted: ${deploymentUrl} -> ${stableOrigin}`)
