import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'
import {
  careerWatchEntitlements,
  createFixedCareerWatchMatch,
  getCareerWatchAccessState,
  getCareerWatchFeed,
  getCareerWatchFilterOptions,
  getCareerWatchImportSources,
  getCareerWatchProfile,
  getPublicCareerWatchFeed,
  importCareerWatchDraft,
  saveCareerWatchProfile
} from '../services/career-watch-service.js'
import { listCompanyFollows, markMatchUpdatesRead, recordMatchFeedback, setCompanyFollow } from '../services/mini-company-match-service.js'

function authenticatedUserId(req) {
  try {
    const token = extractToken(req)
    const payload = token ? verifyToken(token) : null
    return payload?.userId || null
  } catch {
    return null
  }
}

async function resolveUser(req) {
  const userId = authenticatedUserId(req)
  return userId ? userHelper.getUserById(userId) : null
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500)
  return res.status(status >= 400 && status <= 599 ? status : 500).json({
    success: false,
    code: error?.code || undefined,
    error: status >= 500 ? '关注更新暂时不可用，请稍后重试' : error?.message,
    currentProfile: error?.currentProfile || undefined
  })
}

export default async function careerWatchHandler(req, res) {
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })
  try {
    const user = await resolveUser(req)
    const action = String(req.query?.action || '').trim()
    if (req.method === 'GET' && !user) {
      const [recommendations, filterOptions] = await Promise.all([
        getPublicCareerWatchFeed(6),
        getCareerWatchFilterOptions()
      ])
      return res.status(200).json({
        success: true,
        authenticated: false,
        profile: null,
        recommendations,
        filterOptions,
        followedUpdates: [],
        generatedAt: new Date().toISOString()
      })
    }
    if (!user?.user_id) return res.status(401).json({ success: false, error: '请先登录后设置关注方向' })
    const membership = deriveMembershipCapabilities(user)
    const isMember = Boolean(membership.canAccessTrustedCompaniesPage)

    if (req.method === 'GET' && action === 'follows') {
      return res.status(200).json(await listCompanyFollows(user))
    }
    if (req.method === 'POST' && action === 'follow') {
      const result = await setCompanyFollow({
        user,
        companyId: req.body?.companyId,
        active: req.body?.followed !== false,
        isMember
      })
      return res.status(200).json(result)
    }
    if (req.method === 'POST' && action === 'feedback') {
      return res.status(200).json(await recordMatchFeedback({
        user,
        companyId: req.body?.companyId,
        action: req.body?.action
      }))
    }
    if (req.method === 'POST' && action === 'updates-read') {
      return res.status(200).json(await markMatchUpdatesRead(user, req.body?.inboxIds))
    }
    if (req.method === 'POST' && action === 'import') {
      return res.status(200).json({
        success: true,
        ...(await importCareerWatchDraft(user.user_id, String(req.body?.source || '')))
      })
    }
    if (req.method === 'PUT') {
      const profile = isMember
        ? await saveCareerWatchProfile({
            userId: user.user_id,
            input: { ...(req.body || {}), sourcePlatform: 'web' },
            expectedVersion: req.body?.version
          })
        : await createFixedCareerWatchMatch({
            userId: user.user_id,
            input: { ...(req.body || {}), sourcePlatform: 'web' },
            expectedVersion: req.body?.version
          })
      const access = await getCareerWatchAccessState(user.user_id, isMember)
      const [feed, filterOptions] = await Promise.all([
        getCareerWatchFeed({ userId: user.user_id, profile, isMember, fixedFree: access.matchState === 'fixed_free' }),
        getCareerWatchFilterOptions()
      ])
      return res.status(200).json({ success: true, profile, filterOptions, ...access, ...feed, entitlements: careerWatchEntitlements(isMember) })
    }
    if (req.method === 'GET') {
      const [profile, importSources, filterOptions] = await Promise.all([
        getCareerWatchProfile(user.user_id),
        getCareerWatchImportSources(user.user_id),
        getCareerWatchFilterOptions()
      ])
      const access = await getCareerWatchAccessState(user.user_id, isMember)
      const feed = await getCareerWatchFeed({ userId: user.user_id, profile, isMember, fixedFree: access.matchState === 'fixed_free' })
      return res.status(200).json({
        success: true,
        authenticated: true,
        profile,
        importSources,
        filterOptions,
        ...access,
        entitlements: careerWatchEntitlements(isMember),
        ...feed
      })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[career-watch] request failed', error)
    return sendError(res, error)
  }
}
