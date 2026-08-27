import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1] || 'production'
if (!['local', 'experience', 'production'].includes(channel)) {
  throw new Error('channel must be local, experience or production')
}
const isLocal = channel === 'local'
const sourceDir = path.join(projectDir, isLocal ? 'dist-local' : channel === 'experience' ? 'dist-experience' : 'dist-prod')
const targetDir = isLocal ? projectDir : path.join(projectDir, `.wechat-${channel}`)
const targetBundleDir = path.join(targetDir, 'dist')
const stagingDir = path.join(projectDir, isLocal ? '.dist-local-next' : `.wechat-${channel}-next`)
const stagingBundleDir = isLocal ? stagingDir : path.join(stagingDir, 'dist')
const backupBundleDir = path.join(targetDir, isLocal ? '.dist-local-previous' : '.dist-previous')

const sourceStat = await fs.stat(sourceDir).catch(() => null)
if (!sourceStat?.isDirectory()) {
  throw new Error(`${channel} bundle is missing. Run the matching build command first.`)
}
if (!isLocal && (path.dirname(targetDir) !== projectDir || path.basename(targetDir) !== `.wechat-${channel}`)) {
  throw new Error(`Refusing to replace unexpected directory: ${targetDir}`)
}
if (path.dirname(stagingDir) !== projectDir || path.basename(stagingDir) !== (isLocal ? '.dist-local-next' : `.wechat-${channel}-next`)) {
  throw new Error(`Refusing to use unexpected staging directory: ${stagingDir}`)
}

const projectConfig = JSON.parse(
  await fs.readFile(path.join(projectDir, 'project.config.json'), 'utf8')
)
projectConfig.miniprogramRoot = 'dist/'
projectConfig.srcMiniprogramRoot = 'dist/'

// Keep the project root in place while WeChat DevTools is open. Removing the
// entire directory makes the active project lose its page root and remain at
// wx://not-found even after the bundle has been recreated. It also deletes the
// developer's project.private.config.json.
await fs.rm(stagingDir, { recursive: true, force: true })
if (!isLocal) await fs.mkdir(stagingDir, { recursive: true })
await fs.cp(sourceDir, stagingBundleDir, { recursive: true })
for (const filename of ['app.js', 'app.json', 'base.wxml', 'comp.js', 'comp.json', 'comp.wxml']) {
  const stat = await fs.stat(path.join(stagingBundleDir, filename)).catch(() => null)
  if (!stat?.isFile()) throw new Error(`${channel} bundle is incomplete: missing ${filename}`)
}
await fs.mkdir(targetDir, { recursive: true })
await fs.rm(backupBundleDir, { recursive: true, force: true })

const existingBundle = await fs.stat(targetBundleDir).catch(() => null)
let previousBundleMoved = false

try {
  if (existingBundle?.isDirectory()) {
    await fs.rename(targetBundleDir, backupBundleDir)
    previousBundleMoved = true
  }
  await fs.rename(stagingBundleDir, targetBundleDir)
  if (!isLocal) {
    await fs.writeFile(
      path.join(targetDir, 'project.config.json'),
      `${JSON.stringify(projectConfig, null, 2)}\n`,
      'utf8'
    )
  }
  await fs.rm(backupBundleDir, { recursive: true, force: true })
} catch (error) {
  await fs.rm(targetBundleDir, { recursive: true, force: true })
  if (previousBundleMoved) {
    await fs.rename(backupBundleDir, targetBundleDir)
  }
  throw error
} finally {
  await fs.rm(stagingDir, { recursive: true, force: true })
}

console.log(`Prepared ${channel} WeChat project: ${targetDir}`)
