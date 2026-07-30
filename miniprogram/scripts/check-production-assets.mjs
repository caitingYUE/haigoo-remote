import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundleDir = path.join(projectDir, '.wechat-production', 'dist')
const appConfigPath = path.join(bundleDir, 'app.json')
const maximumMediaBytes = 200 * 1024
const mediaExtensions = new Set([
  '.aac',
  '.flac',
  '.gif',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mp3',
  '.ogg',
  '.png',
  '.svg',
  '.wav',
  '.webp'
])

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath]
  }))
  return nested.flat()
}

const bundleStat = await fs.stat(bundleDir).catch(() => null)
if (!bundleStat?.isDirectory()) {
  throw new Error('Prepared production bundle is missing. Run npm run build:weapp:prod first.')
}

const appConfig = JSON.parse(await fs.readFile(appConfigPath, 'utf8'))
if (appConfig.lazyCodeLoading !== 'requiredComponents') {
  throw new Error('Production app.json must enable lazyCodeLoading=requiredComponents.')
}

const mediaFiles = (await listFiles(bundleDir))
  .filter((filePath) => mediaExtensions.has(path.extname(filePath).toLowerCase()))

const mediaStats = await Promise.all(mediaFiles.map(async (filePath) => ({
  filePath,
  size: (await fs.stat(filePath)).size
})))
const oversizedFiles = mediaStats.filter(({ size }) => size > maximumMediaBytes)

if (oversizedFiles.length > 0) {
  const details = oversizedFiles
    .map(({ filePath, size }) => `${path.relative(bundleDir, filePath)} (${size} bytes)`)
    .join('\n')
  throw new Error(`Production media exceeds the 200 KiB limit:\n${details}`)
}

const largestMedia = mediaStats.sort((left, right) => right.size - left.size)[0]
const largestSummary = largestMedia
  ? `${path.relative(bundleDir, largestMedia.filePath)} (${largestMedia.size} bytes)`
  : 'none'

console.log(`Production quality gate passed: required component injection enabled; ${mediaStats.length} media files checked; largest ${largestSummary}.`)
