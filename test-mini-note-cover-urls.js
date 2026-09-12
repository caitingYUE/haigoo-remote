import assert from 'node:assert/strict'
import fs from 'node:fs'

const cloudRun = fs.readFileSync('cloudrun/index.mjs', 'utf8')
const clientAssets = fs.readFileSync('miniprogram/src/services/cloud-asset-service.ts', 'utf8')
const contentService = fs.readFileSync('miniprogram/src/services/content-service.ts', 'utf8')

assert.match(cloudRun, /async function attachNoteCovers[\s\S]+return hydrated\s*\n\}/)
assert.match(cloudRun, /async function attachCompanyLogos[\s\S]+return hydrated\s*\n\}/)
assert.doesNotMatch(cloudRun, /async function attachPublicImageUrls/, 'content responses must not wait for temporary URL signing')
assert.doesNotMatch(cloudRun, /\[fileKey\]: kind === 'company' \? url : ''/, 'failed signing must never erase stable file IDs')
assert.match(clientAssets, /Taro\.cloud\.getTempFileURL\(\{ fileList \}\)/)
assert.match(clientAssets, /resolved\.set\(value, cached\?\.url \|\| value\)/, 'client keeps cloud ID as the immediate fallback')
assert.match(contentService, /coverUrl: urls\.get\(note\.coverFileId \|\| ''\) \|\| note\.coverUrl \|\| note\.coverFileId \|\| ''/)
assert.match(contentService, /logoUrl: urls\.get\(company\.logoFileId \|\| ''\)/)

console.log('Mini public image contracts passed: stable IDs, native batch resolution and non-empty fallback.')
