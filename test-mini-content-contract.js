import assert from 'node:assert/strict'

process.env.MINI_GATEWAY_SHARED_SECRET = 'test-mini-gateway-secret'
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-entropy-for-tests-only'

const { mapMiniCompany, mapMiniNote, mapMiniPlan, safeCloudFileId } = await import('./lib/api-handlers/mini-gateway.js')

assert.equal(safeCloudFileId('https://public.example/audio.mp3'), '', 'public URLs are not playback authorization')
assert.equal(safeCloudFileId('cloud://prod-env.assets/notes/audio.mp3'), 'cloud://prod-env.assets/notes/audio.mp3')

const baseNote = {
  note_id: '273fa1b4-2044-42cc-a238-bf1cd386cdd5',
  origin_type: 'external',
  title: '远程工作能力',
  original_title: 'Remote work skills',
  summary: 'Summary only',
  author_name: 'Haigoo 职业研究',
  source_name: 'Source publication',
  source_url: 'https://example.com/source',
  category: '',
  tags: ['remote'],
  access_tier: 'vip',
  content_blocks: [{ type: 'paragraph', text: 'Member body' }],
  audio_file_id: 'cloud://prod-env.assets/notes/audio.mp3',
  audio_duration_seconds: 120
}

const locked = mapMiniNote(baseNote, false, { detail: true })
assert.equal(locked.unlocked, false)
assert.equal('notes' in locked, false, 'locked response must omit note body')
assert.equal('audio' in locked, false, 'locked response must omit audio metadata')
assert.equal('sourceUrl' in locked, false, 'locked response must omit source links')
assert.equal(locked.originType, 'external')

const unlocked = mapMiniNote(baseNote, true, { detail: true })
assert.equal(unlocked.unlocked, true)
assert.deepEqual(unlocked.notes, baseNote.content_blocks)
assert.equal(unlocked.sourceUrl, baseNote.source_url)
assert.deepEqual(unlocked.audio, { fileId: baseNote.audio_file_id, durationSeconds: 120 })

const free = mapMiniNote({ ...baseNote, access_tier: 'free' }, false, { detail: true })
assert.equal(free.unlocked, true, 'free website content must remain free in the Mini Program')

const company = mapMiniCompany({
  company_id: 'company-1', name: 'Remote Co', description: 'Distributed company',
  industry: 'SaaS', tags: ['remote'], specialties: ['async'], cached_logo_url: 'https://unsafe.example/logo.png'
})
assert.equal(company.logoFileId, '', 'company images must not expose third-party URLs')
assert.equal(company._logoSourcePath, '', 'third-party company images must not enter the trusted cache path')
assert.equal('jobCount' in company, false, 'company contract must omit job counts')
assert.equal('careersPage' in company, false, 'company contract must omit Careers CTA')

const cachedCompany = mapMiniCompany({
  company_id: 'company-1', name: 'Remote Co',
  cached_logo_url: '/api/company-assets?companyId=company-1&type=logo&v=abc123'
})
assert.equal(cachedCompany.logoFileId, '')
assert.equal(cachedCompany._logoSourcePath, '/api/company-assets?companyId=company-1&type=logo&v=abc123')

const mappedPlan = mapMiniPlan({
  id: 'club_starter_monthly', memberType: 'starter', name: 'Starter', shortLabel: 'Starter',
  price: 99, currency: 'CNY', duration_days: 30, features: ['岗位内容 must not leak']
})
assert.equal(mappedPlan.price, 99)
assert.equal(mappedPlan.features.some((feature) => feature.includes('岗位')), false, 'Mini plan features must stay within the 1.0 product scope')

console.log('mini 1.0 content contract checks passed')
