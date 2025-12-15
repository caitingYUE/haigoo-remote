
import { sendDailyDigests } from '../../lib/cron-handlers/daily-digest.js'

export default async function handler(req, res) {
  // 鉴权 (检查 Cron Secret 或 Admin Token)
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  
  const isAuthorized = 
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (process.env.NODE_ENV === 'development') // 开发环境允许直接调用

  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  // 设置 SSE Headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  await sendDailyDigests(res)
}
