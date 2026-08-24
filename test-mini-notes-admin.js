import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeCareerGrowthNote } from './lib/services/career-growth-notes-service.js'

const body = [{ id: 'p1', type: 'paragraph', text: '正文' }]

const original = normalizeCareerGrowthNote({
  originType: 'original',
  title: '原创笔记',
  summary: '简介',
  contentBlocks: body,
  accessTier: 'free',
  status: 'draft'
}, null, 'admin@example.com')
assert.equal(original.authorName, 'Haigoo 职业研究')
assert.equal(original.sourceName, 'Haigoo Remote')
assert.equal(original.rightsBasis, 'owned')

assert.throws(() => normalizeCareerGrowthNote({
  originType: 'external', title: '外部整理', summary: '简介', authorName: '作者',
  sourceName: '来源', sourceUrl: 'http://example.com', rightsBasis: 'licensed',
  rightsConfirmed: true, contentBlocks: body, status: 'draft'
}), /HTTPS/)

assert.throws(() => normalizeCareerGrowthNote({
  originType: 'external', title: '外部整理', summary: '简介', authorName: '作者',
  sourceName: '来源', sourceUrl: 'https://example.com', rightsConfirmed: true,
  contentBlocks: body, status: 'published', coverImageHash: 'cover'
}), /发布依据/)

assert.throws(() => normalizeCareerGrowthNote({
  originType: 'original', title: '待发布', summary: '简介', authorName: '作者',
  contentBlocks: body, status: 'published'
}), /上传封面/)

const serviceSource = fs.readFileSync(new URL('./lib/services/career-growth-notes-service.js', import.meta.url), 'utf8')
assert.match(serviceSource, /WHERE note_id=\$1::uuid AND version=\$2/, 'updates must use optimistic locking')
assert.match(serviceSource, /statusCode: 409/, 'stale writes must return 409')
assert.match(serviceSource, /WITH saved_note AS/, 'video and canonical note writes must share one SQL statement')
assert.match(serviceSource, /AND \(NOT \$5::boolean OR EXISTS \(SELECT 1 FROM saved_note\)\)/, 'video update must depend on a successful note write')

const websiteSource = fs.readFileSync(new URL('./api/corporate-english-public.js', import.meta.url), 'utf8')
assert.match(websiteSource, /source_video_id = video\.video_id/, 'website notes must be reached through linked videos only')

console.log('mini notes admin contract checks passed')
