import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(projectDir, 'dist-prod')
const targetDir = path.join(projectDir, '.wechat-production')
const targetBundleDir = path.join(targetDir, 'dist')

const sourceStat = await fs.stat(sourceDir).catch(() => null)
if (!sourceStat?.isDirectory()) {
  throw new Error('Production bundle is missing. Run npm run build:weapp:prod first.')
}
if (path.dirname(targetDir) !== projectDir || path.basename(targetDir) !== '.wechat-production') {
  throw new Error(`Refusing to replace unexpected directory: ${targetDir}`)
}

const projectConfig = JSON.parse(
  await fs.readFile(path.join(projectDir, 'project.config.json'), 'utf8')
)
projectConfig.miniprogramRoot = 'dist/'
projectConfig.srcMiniprogramRoot = 'dist/'

await fs.rm(targetDir, { recursive: true, force: true })
await fs.mkdir(targetDir, { recursive: true })
await fs.cp(sourceDir, targetBundleDir, { recursive: true })
await fs.writeFile(
  path.join(targetDir, 'project.config.json'),
  `${JSON.stringify(projectConfig, null, 2)}\n`,
  'utf8'
)

console.log(`Prepared production WeChat project: ${targetDir}`)
