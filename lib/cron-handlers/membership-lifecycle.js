import { sweepExpiredMemberships } from '../services/membership-lifecycle-service.js'

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'
}

function isAuthorizedRequest(req) {
  if (req.headers['x-vercel-cron'] === '1') return true

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  return !isProductionEnvironment()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'This endpoint requires CRON_SECRET or Vercel cron auth.'
    })
  }

  try {
    const result = await sweepExpiredMemberships({
      limit: req.query.limit || req.body?.limit || 200
    })

    return res.status(200).json(result)
  } catch (error) {
    console.error('[Cron:MembershipLifecycle] Error:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error'
    })
  }
}
