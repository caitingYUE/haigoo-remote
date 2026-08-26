import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1]
if (!['experience', 'production'].includes(channel)) {
  throw new Error('Usage: node scripts/upload-weapp.mjs --channel=experience|production')
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
const releaseVersion = String(packageJson.version || '').trim()
const uploadProject = path.join(projectDir, `.wechat-${channel}`)
const cli = process.env.WECHAT_DEVTOOLS_CLI
  || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)
}

if (!fs.existsSync(cli)) throw new Error(`WeChat DevTools CLI not found: ${cli}`)
if (!fs.existsSync(path.join(uploadProject, 'project.config.json'))) {
  throw new Error(`${channel} project is missing. Build it before uploading.`)
}

run(process.execPath, [
  'scripts/check-production-assets.mjs',
  `--channel=${channel}`,
  `--release-version=${releaseVersion}`
])
run(cli, [
  'upload',
  '--project', uploadProject,
  '--version', releaseVersion,
  '--desc', `Haigoo Remote ${channel} ${releaseVersion}`
])

console.log(`Uploaded WeChat ${channel} bundle ${releaseVersion} from ${uploadProject}.`)
