import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1] || 'production'
if (!['experience', 'production'].includes(channel)) {
  throw new Error('channel must be experience or production')
}
const sourceDir = path.join(projectDir, channel === 'experience' ? 'dist-experience' : 'dist-prod')
const targetDir = path.join(projectDir, `.wechat-${channel}`)
const targetBundleDir = path.join(targetDir, 'dist')
const stagingDir = path.join(projectDir, `.wechat-${channel}-next`)
const stagingBundleDir = path.join(stagingDir, 'dist')
const backupBundleDir = path.join(targetDir, '.dist-previous')

const sourceStat = await fs.stat(sourceDir).catch(() => null)
if (!sourceStat?.isDirectory()) {
  throw new Error(`${channel} bundle is missing. Run the matching build command first.`)
}
if (path.dirname(targetDir) !== projectDir || path.basename(targetDir) !== `.wechat-${channel}`) {
  throw new Error(`Refusing to replace unexpected directory: ${targetDir}`)
}
if (path.dirname(stagingDir) !== projectDir || path.basename(stagingDir) !== `.wechat-${channel}-next`) {
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
await fs.mkdir(stagingDir, { recursive: true })
await fs.cp(sourceDir, stagingBundleDir, { recursive: true })
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
  await fs.writeFile(
    path.join(targetDir, 'project.config.json'),
    `${JSON.stringify(projectConfig, null, 2)}\n`,
    'utf8'
  )
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
