import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.argv.find((argument) => argument.startsWith('--channel='))?.split('=')[1] || 'production'
const releaseVersion = process.argv.find((argument) => argument.startsWith('--release-version='))?.split('=')[1] || ''
const targets = {
  experience: {
    cloudEnv: 'haigoo-dev-d2gctbzxma401b345',
    cloudService: 'haigoo-mini',
    forbiddenEnv: 'cloud1-d8ggt7rbl273f83c7',
    forbiddenService: 'haigoo-mini-prod'
  },
  production: {
    cloudEnv: 'cloud1-d8ggt7rbl273f83c7',
    cloudService: 'haigoo-mini-prod',
    forbiddenEnv: 'haigoo-dev-d2gctbzxma401b345',
    forbiddenService: 'haigoo-mini'
  }
}
if (!targets[channel]) throw new Error('channel must be experience or production')
if (!releaseVersion) throw new Error('release-version is required')

const bundleDir = path.join(projectDir, `.wechat-${channel}`, 'dist')
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
  throw new Error(`Prepared ${channel} bundle is missing. Run the matching build command first.`)
}

const appConfig = JSON.parse(await fs.readFile(appConfigPath, 'utf8'))
if (appConfig.lazyCodeLoading !== 'requiredComponents') {
  throw new Error(`${channel} app.json must enable lazyCodeLoading=requiredComponents.`)
}

const scriptFiles = (await listFiles(bundleDir)).filter((filePath) => path.extname(filePath) === '.js')
const compiledScripts = (await Promise.all(scriptFiles.map((filePath) => fs.readFile(filePath, 'utf8')))).join('\n')
const expected = targets[channel]
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const activeConfiguration = new RegExp(
  `String\\(["']${escapePattern(expected.cloudEnv)}["']\\)\\.trim\\(\\)[\\s\\S]{0,100}`
    + `String\\(["']${escapePattern(expected.cloudService)}["']\\)\\.trim\\(\\)[\\s\\S]{0,100}`
    + `String\\(["']${escapePattern(releaseVersion)}["']\\)\\.trim\\(\\)`
)
if (!activeConfiguration.test(compiledScripts)) {
  throw new Error(`${channel} bundle does not contain the expected active environment/service/version configuration`)
}
const forbiddenConfiguration = new RegExp(
  `String\\(["']${escapePattern(expected.forbiddenEnv)}["']\\)\\.trim\\(\\)[\\s\\S]{0,100}`
    + `String\\(["']${escapePattern(expected.forbiddenService)}["']\\)\\.trim\\(\\)`
)
if (forbiddenConfiguration.test(compiledScripts)) {
  throw new Error(`${channel} bundle contains the opposite channel's active environment configuration`)
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

console.log(`${channel} quality gate passed for ${releaseVersion}: environment contract verified; required component injection enabled; ${mediaStats.length} media files checked; largest ${largestSummary}.`)
