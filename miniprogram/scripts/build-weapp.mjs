import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1]
const targets = {
  experience: {
    cloudEnv: 'haigoo-dev-d2gctbzxma401b345',
    cloudService: 'haigoo-mini'
  },
  production: {
    cloudEnv: 'cloud1-d8ggt7rbl273f83c7',
    cloudService: 'haigoo-mini-prod'
  }
}

if (!targets[channel]) {
  throw new Error('Usage: node scripts/build-weapp.mjs --channel=experience|production')
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
const releaseVersion = String(packageJson.version || '').trim()
if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(releaseVersion)) {
  throw new Error('miniprogram/package.json must contain the release version before building')
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: projectDir,
    env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)
}

const taroBinary = path.join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'taro.cmd' : 'taro')
if (!fs.existsSync(taroBinary)) throw new Error('Taro CLI is missing. Run npm install in miniprogram first.')

const target = targets[channel]
const buildEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  TARO_APP_RELEASE_CHANNEL: channel,
  TARO_APP_CLOUD_ENV: target.cloudEnv,
  TARO_APP_CLOUD_SERVICE: target.cloudService,
  TARO_APP_RELEASE_VERSION: releaseVersion
}

run(taroBinary, ['build', '--type', 'weapp', '--no-check'], buildEnvironment)
run(process.execPath, ['scripts/prepare-production-project.mjs', `--channel=${channel}`])
run(process.execPath, [
  'scripts/check-production-assets.mjs',
  `--channel=${channel}`,
  `--release-version=${releaseVersion}`
])

console.log(`WeChat ${channel} bundle ready for ${releaseVersion}.`)
