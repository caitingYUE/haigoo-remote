import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const processedJobs = read('lib/api-handlers/processed-jobs.js')
const featuredJobs = read('lib/services/featured-home-jobs.js')
const trustedCompanies = read('lib/api-handlers/trusted-companies.js')
const userProfile = read('lib/api-handlers/user-profile.js')
const bundles = read('lib/api-handlers/job-bundles.js')
const miniGateway = read('lib/api-handlers/mini-gateway.js')
const detail = read('src/components/JobDetailPanel.tsx')
const detailPage = read('src/pages/JobDetailPage.tsx')
const filters = read('src/components/JobFilterBar.tsx')

assert.ok(
  processedJobs.includes('COALESCE(${JOBS_TABLE}.member_only, false) = false'),
  'public list/detail/search SQL must exclude Club jobs by default'
)
assert.ok(
  processedJobs.includes('canAccessMemberOnly: isMemberUser') &&
    processedJobs.includes('canAccessMemberOnly: isMember || isExplicitAdminList'),
  'only server-verified members or explicit admin lists may opt into Club jobs'
)
assert.ok(
  featuredJobs.includes('COALESCE(j.member_only, false) = false'),
  'anonymous home featured jobs must exclude Club jobs'
)
assert.ok(
  userProfile.includes("AND COALESCE(j.member_only, false) = false"),
  'free-account favorites must not reveal stale Club jobs'
)
assert.ok(
  bundles.includes("${canAccessMemberOnly ? '' : 'AND COALESCE(member_only, false) = false'}"),
  'job bundles must apply the same Club visibility rule'
)
assert.ok(
  miniGateway.includes("code: 'JOB_UNAVAILABLE'") && !miniGateway.includes('memberOnlyJobGatingEnabled'),
  'mini application links must fail closed for non-members without a feature flag'
)
assert.ok(
  trustedCompanies.includes('allowPublicEmailOnly') && trustedCompanies.includes('referralContacts: []'),
  'public email-only roles may expose only the company mailbox, never named contacts'
)
assert.ok(
  detail.includes("text('邮箱申请', 'Apply by email')") && detail.includes("text('企业官网公开投递邮箱。'"),
  'email-only roles must use the approved public-channel copy'
)
assert.ok(
  detail.includes('isPublicEmailOnlyApply') &&
    detail.includes("goToLogin(isPublicEmailOnlyApply ? '登录后可以使用邮箱申请，申请次数与官网直申共用。'") &&
    detail.includes("const canProceed = await consumeWebsiteApplyIfNeeded()"),
  'email-only application must remain free while sharing the authenticated monthly application allowance'
)
assert.ok(
  detail.includes('hasLegacyEmailUnlock') &&
    detail.includes('showReferralModule && (isMember || hasLegacyEmailUnlock)') &&
    detail.includes('邮箱申请 <span'),
  'historically opened email information must remain visible without restoring the retired referral entry'
)
assert.ok(
  detailPage.includes('该职位链接已失效') && detailPage.includes('当前不可访问'),
  'restricted share links must render the generic invalid-link state'
)
assert.ok(
  filters.includes('COMPLIANCE_FEATURES.memberOnlyJobFilter && isMember'),
  'Club filter must not be visible to guests or free accounts'
)

console.log('Job access policy tests passed.')
