import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import {
  getAdminDailyJobEmailConfig,
  monitorAdminDailyJobEmail,
  previewAdminDailyJobEmail,
  sendAdminDailyJobEmail
} from '../services/admin-daily-job-email-service.js'
import { createAdminMessageOnce } from '../services/admin-message-service.js'

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function isDigestSchemaError(error) {
  return error?.code === 'ADMIN_DAILY_DIGEST_SCHEMA_MISSING'
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'
}

function isAuthorizedAdmin(req) {
  const token = extractToken(req)
  if (!token) return false

  const requester = verifyToken(token)
  if (!requester) return false

  return Boolean(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(requester?.email))
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

  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const action = String(
    req.query.action ||
    req.body?.action ||
    (isVercelCron ? 'run' : 'status')
  ).toLowerCase()

  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'This endpoint requires Vercel Cron, CRON_SECRET, or admin auth.'
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

    if (action === 'run') {
      const result = await sendAdminDailyJobEmail({
        recipient: req.query.recipient || req.body?.recipient,
        targetCount: req.query.targetCount || req.body?.targetCount,
        timeZone: req.query.timeZone || req.body?.timeZone,
        batchDate: req.query.batchDate || req.body?.batchDate,
        force: parseBoolean(req.query.force || req.body?.force)
      })

      return res.status(200).json(result)
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action',
      availableActions: ['status', 'preview', 'monitor', 'run']
    })
  } catch (error) {
    console.error('[Cron:AdminDailyFeaturedEmail] Error:', error)
    await createAdminMessageOnce({
      type: 'system_error',
      title: '定时任务异常：管理员每日精选邮件',
      content: String(error?.message || 'Unknown error')
    }).catch((messageError) => {
      console.error('[Cron:AdminDailyFeaturedEmail] Failed to record admin message:', messageError)
    })
    return res.status(isDigestSchemaError(error) ? 503 : 500).json({
      success: false,
      error: error.message,
      code: error?.code || null,
      migrationRequired: isDigestSchemaError(error)
    })
  }
}
