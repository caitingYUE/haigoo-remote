import {
  assertAdminRequest,
  getXiaohongshuJobList,
  setAdminJsonHeaders
} from '../../../../lib/services/admin-content-push-service.js'

export default async function handler(req, res) {
  setAdminJsonHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const admin = await assertAdminRequest(req, res)
  if (!admin) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const data = await getXiaohongshuJobList(req.query || {})
    return res.status(200).json({ success: true, ...data })
  } catch (error) {
    console.error('[admin content push jobs] error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch jobs'
    })
  }
}
