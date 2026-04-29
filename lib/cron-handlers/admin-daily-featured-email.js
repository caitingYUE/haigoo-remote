import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import {
  getAdminDailyJobEmailConfig,
  monitorAdminDailyJobEmail,
  previewAdminDailyJobEmail,
  refreshAdminDailyJobEmail,
  notifySocialPushFailure
} from '../services/admin-social-push-service.js'

function isDigestSchemaError(error) {
  return error?.code === 'ADMIN_DAILY_DIGEST_SCHEMA_MISSING'
    || error?.code === 'SOCIAL_PUSH_SCHEMA_MISSING'
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'
}

function isAuthorizedAdmin(req) {
  const token = extractToken(req)
  if (!token) return false

  const requester = verifyToken(token)
  if (!requester) return false

  return Boolean(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(String(requester?.email || '').toLowerCase()))
}

function isAuthorizedRequest(req) {
  if (req.headers['x-vercel-cron'] === '1') return true

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || req.headers.Authorization

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
  if (isAuthorizedAdmin(req)) return true

  return !isProductionEnvironment()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const action = String(
    req.query.action ||
    req.body?.action ||
    'status'
  ).toLowerCase()

  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'This endpoint requires CRON_SECRET or admin auth.'
    })
  }

  try {
    if (action === 'status') {
      return res.status(200).json({
        success: true,
        ...getAdminDailyJobEmailConfig()
      })
    }

    if (action === 'preview') {
      const result = await previewAdminDailyJobEmail({
        recipient: req.query.recipient || req.body?.recipient,
        targetCount: req.query.targetCount || req.body?.targetCount,
        timeZone: req.query.timeZone || req.body?.timeZone,
        batchDate: req.query.batchDate || req.body?.batchDate
      })

      return res.status(200).json(result)
    }

    if (action === 'monitor') {
      const result = await monitorAdminDailyJobEmail({
        recipient: req.query.recipient || req.body?.recipient,
        timeZone: req.query.timeZone || req.body?.timeZone,
        batchDate: req.query.batchDate || req.body?.batchDate
      })

      return res.status(200).json(result)
    }

    if (action === 'refresh' || action === 'run') {
      const result = await refreshAdminDailyJobEmail({
        recipient: req.query.recipient || req.body?.recipient,
        targetCount: req.query.targetCount || req.body?.targetCount,
        timeZone: req.query.timeZone || req.body?.timeZone,
        batchDate: req.query.batchDate || req.body?.batchDate
      })

      return res.status(200).json(result)
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action',
      availableActions: ['status', 'preview', 'monitor', 'refresh']
    })
  } catch (error) {
    console.error('[Cron:AdminDailyFeaturedEmail] Error:', error)
    await notifySocialPushFailure(error)
    return res.status(isDigestSchemaError(error) ? 503 : 500).json({
      success: false,
      error: error.message,
      code: error?.code || null,
      migrationRequired: isDigestSchemaError(error)
    })
  }
}
