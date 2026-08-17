import crypto from 'node:crypto'
import neonHelper from '../server-utils/dal/neon-helper.js'
import userHelper from '../server-utils/user-helper.js'
import { generateToken, sanitizeUser } from '../server-utils/auth-helpers.js'

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: '服务暂时不可用' })
  const ticket = String(req.body?.ticket || '').trim()
  const jobId = String(req.body?.job || '').trim()
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(ticket) || !jobId) {
    return res.status(400).json({ success: false, error: '申请入口无效' })
  }

  const rows = await neonHelper.query(
    `WITH consumed AS (
       UPDATE mini_web_session_tickets
          SET used_at = NOW()
        WHERE token_hash = $1 AND job_id = $2 AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id, job_id
     )
     SELECT consumed.user_id, consumed.job_id
       FROM consumed
       JOIN jobs ON jobs.job_id = consumed.job_id
      WHERE jobs.status = 'active' AND jobs.is_approved = TRUE
        AND NULLIF(BTRIM(jobs.url), '') IS NOT NULL`,
    [hashToken(ticket), jobId]
  )
  if (!rows?.[0]) return res.status(410).json({ success: false, error: '申请入口已过期，请返回小程序重试' })

  const user = await userHelper.getUserById(rows[0].user_id)
  if (!user) return res.status(401).json({ success: false, error: '账号状态已变化，请重新登录' })
  const token = generateToken({ userId: user.user_id || user.userId, email: user.email })
  return res.status(200).json({
    success: true,
    token,
    user: sanitizeUser(user),
    destination: `/job/${encodeURIComponent(rows[0].job_id)}`
  })
}

export { hashToken }
