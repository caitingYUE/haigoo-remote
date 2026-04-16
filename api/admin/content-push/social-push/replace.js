import {
  assertAdminRequest,
  setAdminJsonHeaders
} from '../../../../lib/services/admin-content-push-service.js'
import { replaceSocialPushJob } from '../../../../lib/services/admin-social-push-service.js'

export default async function handler(req, res) {
  setAdminJsonHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const admin = await assertAdminRequest(req, res)
  if (!admin) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const result = await replaceSocialPushJob(req.body || {})
    return res.status(200).json(result)
  } catch (error) {
    console.error('[Admin Social Push Replace] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '替换推荐岗位失败'
    })
  }
}
