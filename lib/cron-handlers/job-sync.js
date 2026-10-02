import { timingSafeEqual } from 'node:crypto'

// All company crawl/check/review work now starts in the authenticated manual UI.
// Keep authentication on retired endpoints; timers can never revive old queues.
export default function handler(req, res) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : ''
  const received = String(req.headers.authorization || '')
  res.setHeader('Cache-Control', 'no-store')
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(received) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  return res.status(410).json({
    success: false,
    error: '自动岗位检查与爬虫已停用，请在可信企业页面手动使用“更新检查”。'
  })
}
