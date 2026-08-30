import assert from 'node:assert/strict'
import fs from 'node:fs'
import { careerWatchEntitlements, normalizeCareerWatchInput } from './lib/services/career-watch-service.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const normalized = normalizeCareerWatchInput({
  sourceMode: 'resume',
  roleFamilies: ['engineering', 'data', 'product', 'design', 'unknown'],
  customRoleTerms: ['AI Engineer', 'AI Engineer', 'Data Scientist'],
  activePreferenceKeys: ['rating', 'industry', 'teamSize'],
  companyPreferences: { minRating: 4.5, industries: ['人工智能', '软件服务', '教育', '金融科技'] },
  toleranceMode: 'strict',
  sourcePlatform: 'mini'
})

assert.deepEqual(normalized.roleFamilies, ['engineering', 'data', 'product', 'design'])
assert.deepEqual(normalized.customRoleTerms, ['AI Engineer', 'Data Scientist'])
assert.deepEqual(normalized.companyPreferences, { minRating: 4.5, industries: ['人工智能', '软件服务', '教育'] })
assert.equal(normalized.sourcePlatform, 'mini')
assert.equal(careerWatchEntitlements(false).maxPreferenceTypes, null)
assert.equal(careerWatchEntitlements(false).maxFollows, 5)
assert.equal(careerWatchEntitlements(true).maxFollows, null)

const service = read('./lib/services/career-watch-service.js')
const gateway = read('./lib/api-handlers/mini-gateway.js')
const page = read('./miniprogram/src/pages/index/career-watch-page.tsx')
const client = read('./miniprogram/src/services/career-match-service.ts')

assert.match(service, /export async function createFixedCareerWatchMatch/)
assert.match(service, /recommendations\.length !== 5/)
assert.match(service, /h\.closed_at IS NULL[\s\S]*h\.is_public_opportunity IS TRUE/)
assert.match(service, /preserveFixed/)
assert.match(gateway, /career_watch_state/)
assert.match(gateway, /FREE_MATCH_USED/)
assert.match(gateway, /fixed\.ordinality ASC/)
assert.match(gateway, /hiring\.public_opportunity_updated_at DESC NULLS LAST/)
assert.match(page, /const resumeFlowActive = useRef\(false\)/)
assert.match(page, /mapResumeCareerDirections\(parsed\.structured, result\.filterOptions\)/)
assert.match(page, /title: '暂无匹配类型'/)
assert.match(page, /cached && cached\.matchState !== 'unused'/)
assert.match(page, /暂时无法刷新，当前显示上次结果/)
assert.match(client, /export function normalizeCareerWatchResponse/)
assert.match(client, /normalizeComparableText/)
assert.doesNotMatch(`${page}\n${client}`, /Intl\.DateTimeFormat|toLocaleDateString|\.normalize\(/)

console.log('mini Career Watch checks passed')
