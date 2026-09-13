import crypto from 'node:crypto'
import { runWechatReminderDelivery } from '../services/mini-wechat-reminder-service.js'

export default async function miniWechatRemindersHandler(req, res) {
  const secret = process.env.CRON_SECRET
  const actual = String(req.headers?.authorization || '')
  const expected = `Bearer ${secret || ''}`
  if (!secret || Buffer.byteLength(actual) !== Buffer.byteLength(expected)
    || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ success: false, error: 'Method not allowed' })
  try {
    const result = await runWechatReminderDelivery()
    console.info('[mini-reminders] delivery summary', JSON.stringify(result))
    return res.status(200).json({ success: true, ...result })
  } catch {
    // No raw SDK errors: they can contain token-bearing URLs or query parameters.
    console.error('[mini-reminders] worker failed; inspect durable pending/unknown records')
    return res.status(503).json({ success: false, error: 'Reminder worker failed; pending work retained' })
  }
}
