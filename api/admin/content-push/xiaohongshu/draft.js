import {
  DRAFT_TEMPLATE_VERSION,
  assertAdminRequest,
  saveXiaohongshuDraft,
  setAdminJsonHeaders
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
    const draft = await saveXiaohongshuDraft(req.body || {}, admin)
    return res.status(200).json({
      success: true,
      templateVersion: DRAFT_TEMPLATE_VERSION,
      draft
    })
  } catch (error) {
    console.error('[admin content push draft] error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save draft'
    })
  }
}
