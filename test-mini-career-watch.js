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
const card = read('./miniprogram/src/components/match-company-card/index.tsx')
const directorySearch = read('./lib/services/mini-company-search-service.js')
const unreadUpdates = read('./miniprogram/src/pages/unread-updates/index.tsx')

assert.match(service, /export async function createFixedCareerWatchMatch/)
assert.match(service, /recommendations\.length !== 5/)
assert.match(service, /h\.closed_at IS NULL[\s\S]*h\.is_public_opportunity IS TRUE/)
assert.match(service, /preserveFixed/)
assert.match(service, /snapshotId/)
assert.match(service, /validUntil/)
assert.match(service, /verifiedAt/)
assert.match(service, /publishedAt: latest\.source_published_at/)
assert.match(service, /parseJsonObject\(row\?\.translations\)\.title/)
assert.match(service, /jobLocation: jobLocationForRow\(latest\)/)
assert.doesNotMatch(service, /rating > 0 && rating <= 5 && \/glassdoor\/i/)
assert.match(service, /openJobCount/)
assert.match(service, /scoreBreakdown/)
assert.match(service, /scoreConfidence/)
assert.match(service, /openRoleLabels/)
assert.match(service, /tc\.address/)
assert.match(service, /applyLiveRecommendationState/)
assert.match(service, /CASE WHEN jobs\.status = 'active' AND jobs\.is_approved IS TRUE AND COALESCE\(jobs\.member_only, FALSE\) IS FALSE/)
assert.doesNotMatch(service, /history\.is_public_opportunity IS TRUE\)\s+OR \(jobs\.status/)
assert.match(service, /COALESCE\(history\.source_published_at, jobs\.published_at\) AS source_published_at/)
assert.match(gateway, /career_watch_state/)
assert.match(gateway, /FREE_MATCH_USED/)
assert.doesNotMatch(gateway, /fixed\.ordinality ASC/)
assert.match(gateway, /FREE_COMPANY_DIRECTORY_LIMIT = 12/)
assert.match(directorySearch, /const aLatest = Date\.parse/)
assert.match(directorySearch, /return bLatest - aLatest/)
assert.match(page, /const resumeFlowActive = useRef\(false\)/)
assert.match(page, /mapResumeCareerDirections\(parsed\.structured, result\.filterOptions\)/)
assert.match(page, /title: '暂无匹配类型'/)
assert.match(page, /isCareerWatchCacheValid\(cached\)/)
assert.match(page, /暂时无法更新，仍在展示上次结果/)
assert.match(client, /export function normalizeCareerWatchResponse/)
assert.match(client, /export function isCareerWatchCacheValid/)
assert.match(client, /publishedAt/)
assert.match(card, /unfollowedIcon='plus'/)
assert.match(card, /presentation\.jobLocation/)
assert.match(card, />去申请</)
assert.doesNotMatch(card, /发布于/)
assert.doesNotMatch(card, /核验于|核验日期待更新/)
assert.match(client, /normalizeComparableText/)
assert.doesNotMatch(`${page}\n${client}`, /Intl\.DateTimeFormat|toLocaleDateString|\.normalize\(/)
assert.match(unreadUpdates, /job-detail\/index\?companyId=\$\{encodeURIComponent\(item\.companyId\)\}&jobId=\$\{encodeURIComponent\(item\.jobId\)\}/)
assert.doesNotMatch(unreadUpdates, /job-detail\/index\?id=/)

console.log('mini Career Watch checks passed')
