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
assert.equal(company.openJobCount, 0, 'missing job counts must stay at the honest zero value')
assert.equal(company.careersUrl, '', 'missing careers links must stay empty')
assert.equal('careersPage' in company, false, 'legacy unvalidated Careers fields must stay out of the contract')
assert.equal(mapMiniCompany({ company_id: 'company-2', name: 'No Industry' }).industry, '', 'missing industries must stay empty instead of receiving a fabricated category')

const cachedCompany = mapMiniCompany({
  company_id: 'company-1', name: 'Remote Co',
  cached_logo_url: '/api/company-assets?companyId=company-1&type=logo&v=abc123'
})
assert.equal(cachedCompany.logoFileId, '')
assert.equal(cachedCompany._logoSourcePath, '/api/company-assets?companyId=company-1&type=logo&v=abc123')

const mappedPlan = mapMiniPlan({
  id: 'mini_club_quarter_2026', memberType: 'quarter', name: '季度会员', shortLabel: '季度会员',
  amountCents: 19900, durationMonths: 3, features: ['方向匹配岗位更新']
})
assert.equal(mappedPlan.price, 199)
assert.equal(mappedPlan.durationMonths, 3)
assert.deepEqual(mappedPlan.features, ['方向匹配岗位更新'])

console.log('mini upgrade content contract checks passed')
