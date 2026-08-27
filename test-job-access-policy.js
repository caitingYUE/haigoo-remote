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
const bundleDetailPage = read('src/pages/JobBundleDetailPage.tsx')
const filters = read('src/components/JobFilterBar.tsx')
const linkVerifier = read('lib/cron-handlers/stream-verify-links.js')
const dataManagement = read('src/services/data-management-service.ts')
const jobSync = read('lib/services/job-sync-service.js')
const adminBundles = read('src/components/admin/AdminJobBundles.tsx')

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
  bundleDetailPage.includes("fetch(`/api/data/processed-jobs?${params.toString()}`, {") &&
    bundleDetailPage.includes("headers: token ? { Authorization: `Bearer ${token}` } : undefined"),
  'bundle job hydration must preserve member authentication so Club jobs remain visible'
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
assert.ok(
  /NULLIF\(BTRIM\((?:jobs\.)?url\), ''\) IS NOT NULL/.test(linkVerifier),
  'link verification must not deactivate email-only roles that intentionally have no website URL'
)
assert.ok(
  dataManagement.includes("queryParams.append('isAdmin', 'true')"),
  'admin job reads must use the authenticated admin-list switch so pending jobs can be edited'
)
assert.ok(
  linkVerifier.includes("return { status: 'error_retry', reason: `Blocked or Authwall (HTTP ${statusCode})` }")
    && !linkVerifier.includes("last_verified_at < NOW() - INTERVAL '30 days'"),
  'auth walls and elapsed time must not automatically unapprove or deactivate jobs'
)
assert.ok(
  linkVerifier.includes("String(rawUrl || '').trim()") &&
    linkVerifier.includes("return { status: 'ambiguous', reason: 'Invalid URL format' }") &&
    !linkVerifier.includes("return { status: 'dead', reason: 'Invalid URL format' }"),
  'URL whitespace and malformed values must not permanently deactivate jobs'
)
assert.ok(
  linkVerifier.includes("jobs.status = 'inactive'") &&
    linkVerifier.includes("jobs.haigoo_comment LIKE '[自动巡查] 判定链接彻底死亡并下线，原因:%'") &&
    linkVerifier.includes("SET status = 'active'") &&
    linkVerifier.includes("CASE WHEN status = 'inactive' THEN NULL ELSE haigoo_comment END"),
  'automatically deactivated jobs must be rechecked and restored when their links recover'
)
assert.ok(
  processedJobs.includes("jobs.url IS DISTINCT FROM EXCLUDED.url") &&
    processedJobs.includes("AND BTRIM(EXCLUDED.url) ~* '^https?://[^[:space:]]+$'"),
  'correcting an approved inactive job URL must reactivate the job'
)
assert.ok(
  !jobSync.includes('PROCESSED_JOBS_RETAIN_DAYS') &&
    !jobSync.includes('validCrawledJobs') &&
    !trustedCompanies.includes('filteredByTime'),
  'trusted-company imports and synchronization must not filter jobs by publication age'
)
assert.ok(
  processedJobs.includes("(req.method === 'POST' || req.method === 'DELETE')") &&
    processedJobs.includes('await isAdminRequest(req)') &&
    dataManagement.includes("'Authorization': `Bearer ${token}`"),
  'job mutations must require server-verified admin access and send the admin token'
)
assert.ok(
  adminBundles.includes('authorized-users-popover') &&
    adminBundles.includes('bundle.allowed_users') &&
    adminBundles.includes('编辑授权'),
  'admin bundle rows must expose authorized user details and an edit action'
)

console.log('Job access policy tests passed.')
