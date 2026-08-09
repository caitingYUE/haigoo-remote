import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { paypalPaymentService } from '../services/paypal-payment-service.js'

const RATE_LIMITS = {
  'create-order': { attempts: 8, windowSeconds: 15 * 60 },
  'capture-order': { attempts: 12, windowSeconds: 15 * 60 },
  'request-refund': { attempts: 5, windowSeconds: 60 * 60 }
}

function setHeaders(req, res) {
  const allowedOrigins = new Set([
    'http://localhost:3000', 'http://localhost:5173',
    'https://haigoo-admin.vercel.app', 'https://haigooremote.com', 'https://www.haigooremote.com'
  ])
  const origin = String(req.headers?.origin || '')
  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
}

async function authenticatedUser(req) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  if (!payload?.userId) return null
  return await userHelper.getUserById(payload.userId)
}

function clientAddress(req) {
  return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
    || String(req.headers?.['x-real-ip'] || '').trim()
    || 'unknown'
}

async function consumeRateLimit(req, userId, action) {
  const rule = RATE_LIMITS[action]
  if (!rule || !neonHelper.isConfigured) return { allowed: true }
  const secret = String(process.env.PAYPAL_CLIENT_SECRET || process.env.JWT_SECRET || 'paypal-rate-limit')
  const hashes = [
    crypto.createHmac('sha256', secret).update(`paypal:${action}:user:${userId}`).digest('hex'),
    crypto.createHmac('sha256', secret).update(`paypal:${action}:ip:${clientAddress(req)}`).digest('hex')
  ]
  const rows = await Promise.all(hashes.map(keyHash => neonHelper.query(
    `INSERT INTO payment_api_rate_limits (key_hash, action, attempts, window_started_at, updated_at)
     VALUES ($1, $2, 1, NOW(), NOW())
     ON CONFLICT (key_hash, action) DO UPDATE SET
       attempts = CASE WHEN payment_api_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN 1 ELSE payment_api_rate_limits.attempts + 1 END,
       window_started_at = CASE WHEN payment_api_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN NOW() ELSE payment_api_rate_limits.window_started_at END,
       updated_at = NOW()
     RETURNING attempts, window_started_at`,
    [keyHash, action, rule.windowSeconds]
  )))
  const exceeded = rows.map(result => result?.[0]).find(row => Number(row?.attempts || 0) > rule.attempts)
  if (!exceeded) return { allowed: true }
  const retryAfter = Math.max(1, Math.ceil((new Date(exceeded.window_started_at).getTime() + rule.windowSeconds * 1000 - Date.now()) / 1000))
  return { allowed: false, retryAfter }
}

export default async function paypalHandler(req, res) {
  setHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const action = String(req.query?.action || 'config')

  try {
    if (req.method === 'GET' && action === 'config') {
      return res.status(200).json({ success: true, config: paypalPaymentService.publicConfig() })
    }

    const user = await authenticatedUser(req)
    if (!user) return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: '请先登录后再继续' })
    const userId = user.userId || user.user_id

    if (RATE_LIMITS[action]) {
      const limit = await consumeRateLimit(req, userId, action)
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfter))
        return res.status(429).json({ success: false, code: 'RATE_LIMITED', error: '操作过于频繁，请稍后再试', retryAfter: limit.retryAfter })
      }
    }

    if (req.method === 'POST' && action === 'create-order') {
      const order = await paypalPaymentService.createOrder({
        user, userId, planId: req.body?.planId, idempotencyKey: req.body?.idempotencyKey
      })
      return res.status(order?.paypalOrderId ? 201 : 200).json({ success: true, order })
    }
    if (req.method === 'POST' && action === 'capture-order') {
      const result = await paypalPaymentService.captureOrder({
        userId, paymentId: req.body?.paymentId, paypalOrderId: req.body?.paypalOrderId
      })
      return res.status(result.pending ? 202 : 200).json({ success: true, ...result })
    }
    if (req.method === 'GET' && action === 'order') {
      const order = await paypalPaymentService.getOrder({ userId, paymentId: req.query?.paymentId })
      return res.status(200).json({ success: true, order })
    }
    if (req.method === 'GET' && action === 'orders') {
      const data = await paypalPaymentService.listOrders({ userId, page: req.query?.page, pageSize: req.query?.pageSize })
      return res.status(200).json({ success: true, ...data })
    }
    if (req.method === 'POST' && action === 'request-refund') {
      const refund = await paypalPaymentService.requestRefund({
        userId, paymentId: req.body?.paymentId, reason: req.body?.reason
      })
      return res.status(201).json({ success: true, refund })
    }
    return res.status(404).json({ success: false, code: 'ACTION_NOT_FOUND', error: '不支持的支付操作' })
  } catch (requestError) {
    const status = Number(requestError?.statusCode || 500)
    if (status >= 500) {
      console.error('[paypal-api] Request failed:', requestError?.code || requestError?.message || requestError)
    }
    return res.status(status).json({
      success: false,
      code: requestError?.code || 'PAYPAL_SERVER_ERROR',
      error: status >= 500 ? '支付服务暂时不可用，请稍后再试' : requestError?.message || '支付请求失败',
      ...(requestError?.details?.debugId ? { debugId: requestError.details.debugId } : {})
    })
  }
}
