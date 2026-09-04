import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = path.resolve(projectDir, '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1]
if (!['experience', 'production'].includes(channel)) {
  throw new Error('Usage: node scripts/upload-weapp.mjs --channel=experience|production')
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
const releaseVersion = String(packageJson.version || '').trim()
const uploadProject = path.join(projectDir, `.wechat-${channel}`)
const uploadBundle = path.join(uploadProject, 'dist')
const cli = process.env.WECHAT_DEVTOOLS_CLI
  || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)
}

function runDevToolsUpload(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8' })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)

  // WeChat DevTools CLI can report an upload error while still exiting with 0.
  // Treat its structured/error output as authoritative so release automation
  // never promotes a failed upload as a successful experience build.
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  if (/\[error\]|✖\s*Upload|需要重新登录|upload\s+failed/i.test(output)) {
    throw new Error('WeChat DevTools reported that the upload did not complete')
  }
}

if (!fs.existsSync(cli)) throw new Error(`WeChat DevTools CLI not found: ${cli}`)
if (!fs.existsSync(path.join(uploadProject, 'project.config.json')) || !fs.existsSync(path.join(uploadBundle, 'project.config.json'))) {
  throw new Error(`${channel} project is missing. Build it before uploading.`)
}

run(process.execPath, [
  'scripts/check-production-assets.mjs',
  `--channel=${channel}`,
  `--release-version=${releaseVersion}`
])
run(process.execPath, [
  path.join(rootDir, 'scripts/verify-mini-gateway.mjs'),
  `--target=${channel === 'experience' ? 'development' : 'production'}`,
  '--via-cloudrun',
  '--action=career_watch_options'
])
run(process.execPath, [
  path.join(rootDir, 'scripts/verify-mini-gateway.mjs'),
  `--target=${channel === 'experience' ? 'development' : 'production'}`,
  '--via-cloudrun',
  '--action=companies'
])
runDevToolsUpload(cli, [
  'upload',
  '--project', uploadBundle,
  '--version', releaseVersion,
  '--desc', `Haigoo Remote ${channel} ${releaseVersion}`
])

console.log(`Uploaded WeChat ${channel} bundle ${releaseVersion} from ${uploadBundle}.`)
