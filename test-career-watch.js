import assert from 'node:assert/strict'
import fs from 'node:fs'
import { careerWatchEntitlements, normalizeCareerWatchInput } from './lib/services/career-watch-service.js'

const normalized = normalizeCareerWatchInput({
  sourceMode: 'resume',
  roleFamilies: ['engineering', 'data', 'product', 'design', 'unknown'],
  customRoleTerms: ['AI Engineer', 'AI Engineer', 'Data Scientist', 'Product Engineer'],
  activePreferenceKeys: ['rating', 'industry', 'teamSize'],
  companyPreferences: { minRating: 4.5, industries: ['人工智能', '软件服务', '教育', '金融科技'] },
  toleranceMode: 'strict',
  sourcePlatform: 'mini'
})

assert.deepEqual(normalized.roleFamilies, ['engineering', 'data', 'product', 'design'])
assert.deepEqual(normalized.customRoleTerms, ['AI Engineer', 'Data Scientist', 'Product Engineer'])
assert.deepEqual(normalized.activePreferenceKeys, ['rating', 'industry', 'teamSize'])
assert.deepEqual(normalized.companyPreferences, { minRating: 4.5, industries: ['人工智能', '软件服务', '教育'] })
assert.equal(normalized.toleranceMode, 'strict')
assert.equal(normalized.sourcePlatform, 'mini')

const defaults = normalizeCareerWatchInput({ activePreferenceKeys: ['rating', 'companyAge', 'industry'] })
assert.deepEqual(defaults.activePreferenceKeys, ['rating', 'companyAge', 'industry'])
assert.deepEqual(defaults.companyPreferences, {})
assert.equal(defaults.toleranceMode, 'balanced')

assert.deepEqual(careerWatchEntitlements(false), {
  isMember: false, maxRoleFamilies: 5, maxPreferenceTypes: null, maxFollows: 5, refreshHours: null, proactiveDigest: false
})
assert.deepEqual(careerWatchEntitlements(true), {
  isMember: true, maxRoleFamilies: 5, maxPreferenceTypes: null, maxFollows: null, refreshHours: 6, proactiveDigest: true
})

const service = fs.readFileSync(new URL('./lib/services/career-watch-service.js', import.meta.url), 'utf8')
const gateway = fs.readFileSync(new URL('./lib/api-handlers/mini-gateway.js', import.meta.url), 'utf8')
const miniPage = fs.readFileSync(new URL('./miniprogram/src/pages/index/career-watch-page.tsx', import.meta.url), 'utf8')
const webSection = fs.readFileSync(new URL('./src/components/home/CareerWatchSection.tsx', import.meta.url), 'utf8')
assert.match(service, /profile\.toleranceMode === 'strict'/)
assert.match(service, /glassdoor/i)
assert.match(service, /career_watch_feed_snapshots/)
assert.match(service, /to_jsonb\(s\) \? 'preferences' AS has_preferences_column/)
assert.match(service, /subscription\.has_preferences_column/)
assert.doesNotMatch(service, /preferences FROM subscriptions/)
assert.match(service, /WHERE career_watch_profiles\.version = \$12/)
assert.match(service, /export async function createFixedCareerWatchMatch/)
assert.match(service, /free_assessment_used_at IS NOT NULL/)
assert.match(service, /recommendations\.length !== 5/)
assert.match(service, /fixedFree/)
assert.match(service, /FROM trusted_companies/)
assert.match(service, /jsonb_array_elements_text/)
assert.match(service, /inbox\.status = 'unread'/)
assert.match(service, /getLiveFollowedUpdates\(userId\)/)
assert.match(service, /matchedCustomDirection/)
assert.match(service, /501 人以上/)
assert.doesNotMatch(service, /large: '500 人以上'/)
assert.match(gateway, /career_watch_state/)
assert.match(gateway, /FREE_MATCH_USED/)
assert.match(gateway, /matchState/)
assert.match(gateway, /filterOptions/)
assert.match(gateway, /career_resume_sync/)
assert.match(gateway, /handleCareerWatchOptions/)
assert.match(gateway, /scope === 'resume'/)
assert.match(gateway, /createFixedCareerWatchMatch\(\{/)
assert.match(miniPage, /上传简历识别方向/)
assert.match(miniPage, /可选择 1–5 个方向/)
assert.match(miniPage, /查看方向与企业/)
assert.match(miniPage, /roleGroups/)
assert.match(miniPage, /const resumeFlowActive = useRef\(false\)/)
assert.match(miniPage, /if \(resumeFlowActive\.current\) return/)
assert.match(miniPage, /const result = await fetchCareerWatch\(\)\s+if \(resumeFlowActive\.current\) return/)
assert.match(miniPage, /resumeFlowActive\.current = true/)
assert.match(miniPage, /resumeFlowActive\.current = false/)
assert.match(miniPage, />不限</)
assert.doesNotMatch(miniPage, /item\.count|\{item\.count\}\s*个岗位/)
assert.doesNotMatch(miniPage, /只比较后台已有/)
assert.doesNotMatch(miniPage, /match-orbit|resultPreview|正在检查企业与岗位变化/)
assert.doesNotMatch(miniPage, /const INDUSTRIES/)
assert.doesNotMatch(miniPage, /\['软件服务'/)
assert.doesNotMatch(miniPage, /teamSizes\[0\]|ratings\[0\]|companyAges\[0\]|industries\[0\]/)
assert.doesNotMatch(miniPage, /maxPreferenceTypes|最多设置 2 项|2\/2 类企业条件/)
assert.doesNotMatch(webSection, /const ROLES|const MORE_ROLES|const INDUSTRIES/)
assert.match(webSection, /state\?\.filterOptions/)
const parseHandler = gateway.slice(gateway.indexOf('async function handleCareerResumeParse'), gateway.indexOf('async function handleCareerResumeSync'))
assert.doesNotMatch(parseHandler, /\n\s*careerText,/)

console.log('Career watch tests passed')
