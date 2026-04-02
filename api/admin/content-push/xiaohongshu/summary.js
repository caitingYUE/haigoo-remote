import {
  assertAdminRequest,
  generateXiaohongshuSummary,
  setAdminJsonHeaders,
  SUMMARY_TEMPLATE_VERSION
} from '../../../../lib/services/admin-content-push-service.js'

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
    const result = await generateXiaohongshuSummary(req.body || {})
    return res.status(200).json({
      success: true,
      templateVersion: SUMMARY_TEMPLATE_VERSION,
      ...result
    })
  } catch (error) {
    console.error('[admin content push summary] error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate summary'
    })
  }
}
