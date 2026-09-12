import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const cloudRun = fs.readFileSync('cloudrun/index.mjs', 'utf8')
const clientAssets = fs.readFileSync('miniprogram/src/services/cloud-asset-service.ts', 'utf8')
const contentService = fs.readFileSync('miniprogram/src/services/content-service.ts', 'utf8')

assert.match(cloudRun, /async function attachCompanyLogos[\s\S]+return hydrated\s*\n\}/)
assert.doesNotMatch(cloudRun, /async function attachPublicImageUrls/, 'content responses must not wait for temporary URL signing')
assert.doesNotMatch(cloudRun, /\[fileKey\]: kind === 'company' \? url : ''/, 'failed signing must never erase stable file IDs')
assert.match(cloudRun, /coverUrl = contentOriginUrl\(_coverSourcePath, apiOrigin\)/)
assert.match(cloudRun, /coverFileId: '', coverUrl/)
assert.match(cloudRun, /logoFileId: directUrl,\s*logoUrl: directUrl/)
assert.match(clientAssets, /Taro\.cloud\.getTempFileURL\(\{ fileList \}\)/)
assert.match(clientAssets, /resolved\.set\(value, cached\?\.url \|\| value\)/, 'client keeps cloud ID as the immediate fallback')
assert.match(contentService, /\^https\?:\\\/\\\//, 'stable HTTPS assets must bypass private CloudBase signing')
assert.match(contentService, /\? \[\] : \[note\.coverFileId\]/)
assert.match(contentService, /\? \[\] : \[company\.logoFileId, company\.logoUrl\]/)

const contentOriginUrl = (value, origin) => value ? `${origin}${value}` : ''
const noteSource = cloudRun.slice(cloudRun.indexOf('async function attachNoteCovers'), cloudRun.indexOf('async function attachCompanyLogos'))
const attachNoteCovers = vm.runInNewContext(`(${noteSource})`, { contentOriginUrl, apiOrigin: 'https://api.example' })
const [note] = await attachNoteCovers([{ id: 'note', coverFileId: 'cloud://old', _coverSourcePath: '/cover' }])
assert.equal(note.coverFileId, '')
assert.equal(note.coverUrl, 'https://api.example/cover')

const companySource = cloudRun.slice(cloudRun.indexOf('async function attachCompanyLogos'), cloudRun.indexOf('async function attachFollowLogos'))
const attachCompanyLogos = vm.runInNewContext(`(${companySource})`, {
  contentOriginUrl,
  apiOrigin: 'https://preview.example',
  jobsApiOrigin: 'https://www.example'
})
const [company] = await attachCompanyLogos([{ id: 'company', logoFileId: 'cloud://old', _logoSourcePath: '/api/company-assets?companyId=company&type=logo' }])
assert.equal(company.logoFileId, 'https://www.example/api/company-assets?companyId=company&type=logo')
assert.equal(company.logoUrl, company.logoFileId)

console.log('Mini public image contracts passed: direct HTTPS priority, native batch fallback and non-empty fallback.')
