import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
const after = process.argv.includes('--after')
const development = process.argv.includes('--development')
const envId = development ? 'haigoo-dev-d2gctbzxma401b345' : 'cloud1-d8ggt7rbl273f83c7'
const serviceName = development ? 'haigoo-mini' : 'haigoo-mini-prod'
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
require(path.join(globalModules, '@cloudbase/cli/node_modules/reflect-metadata'))
const { checkAndGetCredential } = require(path.join(globalModules, '@cloudbase/cli/lib/utils/net/credential.js'))
const cloudbase = require(path.join(root, 'cloudrun/node_modules/@cloudbase/node-sdk'))
const credential = await checkAndGetCredential(true)
const app = cloudbase.init({
  env: envId, secretId: credential.secretId,
  secretKey: credential.secretKey, sessionToken: credential.token
})
const results = { checkedAt: new Date().toISOString(), envId, requests: [], images: [] }
let notes = []
for (let attempt = 0; attempt < 2; attempt++) {
  const started = Date.now()
  const response = await app.callContainer({ name: serviceName, method: 'GET', path: '/mini/growth/notes' })
  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  notes = data.notes || []
  assert.equal(response.statusCode, 200)
  assert.ok(notes.length > 0)
  results.requests.push({ attempt, status: response.statusCode, elapsedMs: Date.now() - started,
    count: notes.length, covers: notes.filter(note => note.coverFileId || note.coverUrl).length })
}
for (const note of notes) {
  const result = { id: note.id, title: note.titleZh || note.title, fileId: note.coverFileId || '', hasCoverUrl: Boolean(note.coverUrl) }
  let imageUrl = note.coverUrl || ''
  if (after) {
    assert.equal(note.coverFileId, '', 'client must not resolve a private file')
    assert.match(imageUrl, /^https:\/\//)
  } else if (note.coverFileId) {
    const started = Date.now()
    const response = await app.getTempFileURL({ fileList: [{ fileID: note.coverFileId, maxAge: 300 }] })
    result.resolveMs = Date.now() - started
    const item = response.fileList?.[0]
    result.resolveCode = item?.code
    imageUrl = item?.tempFileURL || ''
  }
  if (imageUrl) {
    const imageStart = Date.now()
    try {
      const image = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
      result.status = image.status
      result.ttfbMs = Date.now() - imageStart
      result.headers = Object.fromEntries(['content-type', 'content-length', 'cache-control', 'age', 'etag'].map(key => [key, image.headers.get(key)]))
      result.bytes = (await image.arrayBuffer()).byteLength
      result.totalMs = Date.now() - imageStart
      result.imageHost = new URL(imageUrl).host
    } catch (error) { result.error = error.message; result.totalMs = Date.now() - imageStart }
  }
  if (after) { assert.equal(result.status, 200); assert.ok(result.bytes > 0); assert.match(result.headers['content-type'], /^image\//) }
  results.images.push(result)
}
if (after) {
  for (const route of ['/mini/home', `/mini/growth/notes/${encodeURIComponent(notes[0].id)}`]) {
    const response = await app.callContainer({ name: serviceName, method: 'GET', path: route })
    assert.equal(response.statusCode, 200)
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    for (const note of data.notes || [data.note]) {
      assert.match(note.coverUrl, /^https:\/\//)
      assert.equal(note.coverFileId, '')
      if (!note.unlocked) { assert.equal(note.audio, undefined); assert.equal(note.notes, undefined) }
    }
    results.requests.push({ route, status: response.statusCode, directCoverUrls: true })
  }
}
const outputOverride = process.argv.find(argument => argument.startsWith('--output-dir='))?.slice('--output-dir='.length)
const output = outputOverride ? path.resolve(outputOverride) : path.join(root, 'artifacts/mini-note-images-2026-09-06')
await fs.mkdir(output, { recursive: true })
await fs.writeFile(path.join(output, `${development ? 'development-' : ''}${after ? 'after' : 'before'}.json`), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
