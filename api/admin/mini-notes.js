import neonHelper from '../../server-utils/dal/neon-helper.js'
import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import {
  getCareerGrowthNote,
  listCareerGrowthNotes,
  mapCareerGrowthNote,
  saveCareerGrowthNote
} from '../../lib/services/career-growth-notes-service.js'

function isAdmin(user, payload) {
  const email = String(user?.email || payload?.email || '').trim().toLowerCase()
  return Boolean(payload?.isAdmin || payload?.role === 'admin' || user?.roles?.admin || user?.roles?.super_admin || SUPER_ADMIN_EMAILS.includes(email))
}

async function requireAdmin(req, res) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const user = payload?.userId ? await userHelper.getUserById(payload.userId).catch(() => null) : null
  if (!payload || !isAdmin(user, payload)) {
    res.status(403).json({ success: false, error: '无权管理小程序笔记' })
    return null
  }
  return { id: payload.userId || payload.email, email: user?.email || payload.email }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })

  const admin = await requireAdmin(req, res)
  if (!admin) return
  const actor = admin.id || admin.email || 'admin'

  try {
    const id = String(req.query?.id || req.body?.id || '').trim()
    if (req.method === 'GET' && id) {
      const note = await getCareerGrowthNote(id)
      if (!note) return res.status(404).json({ success: false, error: '笔记不存在' })
      return res.status(200).json({ success: true, note: mapCareerGrowthNote(note) })
    }
    if (req.method === 'GET') {
      const result = await listCareerGrowthNotes({
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        status: req.query.status,
        originType: req.query.originType,
        accessTier: req.query.accessTier,
        category: req.query.category
      })
      return res.status(200).json({ success: true, ...result, totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)) })
    }
    if (req.method === 'POST') {
      const note = await saveCareerGrowthNote({ body: req.body || {}, actor })
      return res.status(201).json({ success: true, note })
    }
    if (req.method === 'PUT' && id) {
      const note = await saveCareerGrowthNote({ id, body: req.body || {}, actor })
      return res.status(200).json({ success: true, note })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    if (status >= 500) console.error('[mini-notes] request failed', error)
    return res.status(status).json({ success: false, error: error?.message || '保存失败' })
  }
}
