import {
  assertAdminRequest,
  setAdminJsonHeaders
} from '../../../../lib/services/admin-content-push-service.js'
import {
  disableSocialPushGroup,
  listSocialPushGroups,
  saveSocialPushGroup
} from '../../../../lib/services/admin-social-push-service.js'

export default async function handler(req, res) {
  setAdminJsonHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const admin = await assertAdminRequest(req, res)
  if (!admin) return

  try {
    if (req.method === 'GET') {
      const result = await listSocialPushGroups({
        timeZone: req.query.timeZone
      })
      return res.status(200).json(result)
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const result = await saveSocialPushGroup(req.body || {})
      return res.status(200).json(result)
    }

    if (req.method === 'DELETE') {
      const result = await disableSocialPushGroup({
        id: req.query.id || req.body?.id
      })
      return res.status(200).json(result)
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[Admin Social Push Groups] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '处理社群分组失败'
    })
  }
}
