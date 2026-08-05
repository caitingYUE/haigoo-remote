import userHelper from '../../server-utils/user-helper.js'
import { trackServerAnalyticsEvent } from '../services/analytics-event-service.js'
import {
  createMembershipCodeBatch,
  exportMembershipCodeBatch,
  isMembershipRedemptionConfigured,
  isMembershipRedemptionEnabled,
  isMembershipRedemptionReady,
  listMembershipCodes,
  updateMembershipCodeDistribution,
  updateMembershipCodeBatch,
  voidMembershipCode
} from '../services/membership-redemption-code-service.js'

function csvCell(value) {
  const raw = String(value ?? '')
  const text = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${text.replace(/"/g, '""')}"`
}

function makeCsv(rows) {
  const header = [
    '兑换码', '会员类型', '权益月数', '批次', '渠道', '生成时间',
    '兑换截止时间', '状态', '分发状态', '分发时间', '分发操作人', '兑换时间', '兑换用户ID'
  ]
  const lines = rows.map(row => [
    row.code,
    row.memberType,
    row.durationMonths,
    row.batchName,
    row.channel,
    row.generatedAt,
    row.expiresAt,
    row.status,
    row.distributed ? '已分发' : '未分发',
    row.distributedAt || '',
    row.distributedBy || '',
    row.redeemedAt || '',
    row.redeemedByUserId || ''
  ].map(csvCell).join(','))
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\n')}`
}

function errorStatus(error) {
  if (['INVALID_MEMBER_TYPE', 'INVALID_BATCH', 'INVALID_QUANTITY'].includes(error?.code)) return 400
  if (error?.code === 'BATCH_EXISTS') return 409
  if (error?.code === 'BATCH_NOT_FOUND') return 404
  if (['FEATURE_DISABLED', 'REDEMPTION_KEY_MISSING', 'DATABASE_NOT_CONFIGURED', 'SCHEMA_NOT_READY'].includes(error?.code)) return 503
  return 500
}

async function trackAdminCodeEventSafely(payload, context) {
  try {
    await trackServerAnalyticsEvent(payload, context)
  } catch (error) {
    console.warn('[membership-codes] Analytics tracking failed:', error?.message || error)
  }
}

function isLocalTestSuperAdmin(user) {
  return process.env.NODE_ENV !== 'production'
    && String(user?.email || '').trim().toLowerCase() === 'test_admin@haigoo.com'
}

export default async function membershipCodesHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const adminCheck = await userHelper.validateAdminRequest(req)
  if (!adminCheck.valid) {
    return res.status(adminCheck.error === 'Forbidden' ? 403 : 401).json({
      success: false,
      error: adminCheck.error || 'Unauthorized'
    })
  }

  const admin = adminCheck.user
  const adminUserId = admin?.userId || admin?.user_id
  const superAdmin = Boolean(admin?.roles?.super_admin)
    || await userHelper.isSuperAdmin(adminUserId)
    || isLocalTestSuperAdmin(admin)

  if (!isMembershipRedemptionEnabled()) {
    return res.status(503).json({
      success: false,
      code: 'FEATURE_DISABLED',
      isSuperAdmin: superAdmin,
      error: '会员兑换码功能暂未启用'
    })
  }

  if (!isMembershipRedemptionConfigured()) {
    return res.status(503).json({
      success: false,
      code: 'REDEMPTION_NOT_CONFIGURED',
      isSuperAdmin: superAdmin,
      error: '兑换码密钥或数据库尚未配置'
    })
  }

  if (!(await isMembershipRedemptionReady())) {
    return res.status(503).json({
      success: false,
      code: 'SCHEMA_NOT_READY',
      isSuperAdmin: superAdmin,
      error: '兑换码功能尚未初始化，请先执行数据库迁移'
    })
  }

  try {
    if (req.method === 'GET' && req.query.export === 'csv') {
      if (!superAdmin) return res.status(403).json({ success: false, error: '仅超级管理员可导出完整兑换码' })
      const batchId = String(req.query.batchId || '')
      if (!batchId) return res.status(400).json({ success: false, error: '缺少批次 ID' })
      const rows = await exportMembershipCodeBatch(batchId, {
        exportedBy: admin?.email || adminUserId
      })
      const safeName = String(rows?.[0]?.batchName || 'membership-codes').replace(/[\\/:*?"<>|]/g, '-')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.csv`)}`)
      await trackAdminCodeEventSafely({
        event: 'membership_code_batch_exported',
        properties: { batch_id: batchId, code_count: rows.length }
      }, {
        user: admin,
        userId: adminUserId,
        pageKey: 'admin_membership_codes',
        module: 'admin_membership_codes'
      })
      return res.status(200).send(makeCsv(rows))
    }

    if (req.method === 'GET') {
      const data = await listMembershipCodes({
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        status: req.query.status,
        memberType: req.query.memberType,
        channel: req.query.channel,
        batchId: req.query.batchId,
        revealCodes: superAdmin
      })
      return res.status(200).json({ success: true, isSuperAdmin: superAdmin, ...data })
    }

    if (req.method === 'POST') {
      if (!superAdmin) return res.status(403).json({ success: false, error: '仅超级管理员可生成兑换码' })
      const result = await createMembershipCodeBatch({
        name: req.body?.name,
        channel: req.body?.channel,
        memberType: req.body?.memberType,
        quantity: req.body?.quantity,
        createdBy: admin?.email || adminUserId
      })
      await trackAdminCodeEventSafely({
        event: 'membership_code_batch_generated',
        properties: {
          batch_id: result.batch.batchId,
          member_type: result.batch.memberType,
          code_count: result.batch.codeCount,
          channel: result.batch.channel
        }
      }, {
        user: admin,
        userId: adminUserId,
        pageKey: 'admin_membership_codes',
        module: 'admin_membership_codes'
      })
      return res.status(201).json({ success: true, ...result })
    }

    if (req.method === 'PATCH') {
      if (req.body?.operation === 'distribution') {
        const distribution = await updateMembershipCodeDistribution({
          codeId: req.body?.codeId,
          distributed: req.body?.distributed,
          updatedBy: admin?.email || adminUserId
        })
        if (!distribution) {
          return res.status(409).json({
            success: false,
            error: '分发状态已变化，或该兑换码已无法修改'
          })
        }
        return res.status(200).json({ success: true, distribution })
      }
      if (!superAdmin) return res.status(403).json({ success: false, error: '仅超级管理员可修改兑换码' })
      if (req.body?.operation === 'void') {
        const updated = await voidMembershipCode({
          codeId: req.body?.codeId,
          reason: req.body?.reason,
          voidedBy: admin?.email || adminUserId
        })
        if (!updated) return res.status(409).json({ success: false, error: '兑换码不存在或已无法作废' })
        return res.status(200).json({ success: true })
      }
      if (req.body?.operation === 'update_batch') {
        const batch = await updateMembershipCodeBatch({
          batchId: req.body?.batchId,
          name: req.body?.name,
          channel: req.body?.channel,
          updatedBy: admin?.email || adminUserId
        })
        if (!batch) return res.status(404).json({ success: false, error: '批次不存在' })
        return res.status(200).json({ success: true, batch })
      }
      return res.status(400).json({ success: false, error: '不支持的操作' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[membership-codes] Request failed:', error?.code || error?.message || error)
    if (/membership_(redemption_codes|code_batches|entitlement_segments|code_admin_audit).*does not exist/i.test(String(error?.message || ''))) {
      return res.status(503).json({
        success: false,
        code: 'SCHEMA_NOT_READY',
        isSuperAdmin: superAdmin,
        error: '兑换码功能尚未初始化，请先执行数据库迁移'
      })
    }
    return res.status(errorStatus(error)).json({
      success: false,
      code: error?.code || 'MEMBERSHIP_CODE_ADMIN_ERROR',
      isSuperAdmin: superAdmin,
      error: errorStatus(error) < 500 ? error?.message || '兑换码操作失败' : '兑换码操作失败'
    })
  }
}
