import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { systemSettingsService } from './system-settings-service.js'
import {
  getDefaultMembershipPlanConfig,
  getMembershipPlans,
  normalizeMembershipPlanConfig,
  normalizeMemberType
} from '../shared/membership.js'
import { trackServerAnalyticsEvent } from './analytics-event-service.js'

const PAYPAL_PLAN_TYPES = new Set(['starter', 'half_year', 'annual'])
const ORDER_TTL_HOURS = 3
const TOKEN_SKEW_MS = 60_000
let accessTokenCache = { environment: '', token: '', expiresAt: 0 }

function configuredEnvironment() {
  return String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox'
}

function paypalBaseUrl() {
  return configuredEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

function paypalSdkUrl() {
  return configuredEnvironment() === 'live'
    ? 'https://www.paypal.com/web-sdk/v6/core'
    : 'https://www.sandbox.paypal.com/web-sdk/v6/core'
}

function isEnabled() {
  return String(process.env.PAYPAL_PAYMENTS_ENABLED || '').trim().toLowerCase() === 'true'
}

function isConfigured() {
  return Boolean(
    neonHelper.isConfigured
    && String(process.env.PAYPAL_CLIENT_ID || '').trim()
    && String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  )
}

function publicConfig() {
  return {
    enabled: isEnabled() && isConfigured(),
    environment: configuredEnvironment(),
    clientId: isEnabled() && isConfigured() ? String(process.env.PAYPAL_CLIENT_ID || '').trim() : '',
    currency: 'CNY',
    sdkVersion: 'v6',
    sdkUrl: paypalSdkUrl()
  }
}

function moneyValue(cents) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2)
}

function paymentId() {
  return `HGP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`.slice(0, 32)
}

function error(message, code, statusCode = 400, details = undefined) {
  return Object.assign(new Error(message), { code, statusCode, details })
}

function normalizeIdempotencyKey(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw error('支付请求标识无效，请刷新后重试', 'INVALID_IDEMPOTENCY_KEY', 400)
  }
  return normalized
}

function safeProviderSnapshot(value) {
  if (!value || typeof value !== 'object') return {}
  return {
    id: String(value.id || ''),
    status: String(value.status || ''),
    amount: value.amount ? {
      currency_code: String(value.amount.currency_code || ''),
      value: String(value.amount.value || '')
    } : undefined,
    create_time: value.create_time || null,
    update_time: value.update_time || null,
    supplementary_data: value.supplementary_data ? {
      related_ids: value.supplementary_data.related_ids || undefined
    } : undefined
  }
}

async function accessToken() {
  const environment = configuredEnvironment()
  if (accessTokenCache.environment === environment && accessTokenCache.token && accessTokenCache.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return accessTokenCache.token
  }
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) throw error('PayPal 服务端凭据尚未配置', 'PAYPAL_NOT_CONFIGURED', 503)
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    throw error('PayPal 认证失败，请稍后再试', 'PAYPAL_AUTH_FAILED', 502, { debugId: response.headers.get('paypal-debug-id') })
  }
  accessTokenCache = {
    environment,
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 300)) * 1000
  }
  return data.access_token
}

async function paypalRequest(path, { method = 'GET', body, requestId } = {}) {
  const token = await accessToken()
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.details?.[0]
    throw error(
      detail?.description || data?.message || 'PayPal 请求失败',
      detail?.issue || data?.name || 'PAYPAL_REQUEST_FAILED',
      response.status >= 500 ? 502 : response.status,
      { debugId: data?.debug_id || response.headers.get('paypal-debug-id') }
    )
  }
  return data
}

async function membershipPlans() {
  const config = normalizeMembershipPlanConfig(
    await systemSettingsService.getSetting('membership_plan_config') || getDefaultMembershipPlanConfig()
  )
  return getMembershipPlans(config)
}

function planDuration(plan) {
  const memberType = normalizeMemberType(plan.memberType)
  if (memberType === 'starter') {
    return { durationMonths: 0, durationDays: Math.max(28, Math.min(31, Number(plan.duration_days || 30))) }
  }
  return { durationMonths: memberType === 'half_year' ? 6 : 12, durationDays: 0 }
}

async function getPlan(planId) {
  const plan = (await membershipPlans()).find(item => item.id === String(planId || ''))
  const memberType = normalizeMemberType(plan?.memberType)
  if (!plan || !PAYPAL_PLAN_TYPES.has(memberType) || plan.enabled === false || plan.comingSoon) {
    throw error('该 Club 权益方案暂不支持 PayPal 购买', 'PAYPAL_PLAN_UNAVAILABLE', 400)
  }
  if (String(plan.currency || '').toUpperCase() !== 'CNY') {
    throw error('Club 权益方案币种配置无效', 'PAYPAL_PLAN_CURRENCY_INVALID', 503)
  }
  const amountCents = Math.round(Number(plan.price || 0) * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw error('Club 权益方案价格配置无效', 'PAYPAL_PLAN_PRICE_INVALID', 503)
  }
  return { ...plan, memberType, amountCents, ...planDuration({ ...plan, memberType }) }
}

function publicOrder(row) {
  if (!row) return null
  const snapshot = row.metadata?.paypal?.planSnapshot || {}
  return {
    paymentId: String(row.payment_id || ''),
    paypalOrderId: String(row.provider_order_id || ''),
    planId: String(row.plan_id || ''),
    planName: String(snapshot.name || row.plan_id || ''),
    memberType: String(snapshot.memberType || ''),
    amountCents: Number(row.expected_amount_cents || Math.round(Number(row.amount || 0) * 100)),
    refundedAmountCents: Number(row.refunded_amount_cents || 0),
    currency: String(row.currency || 'CNY'),
    status: String(row.status || 'pending'),
    providerStatus: String(row.provider_status || ''),
    createdAt: row.created_at || null,
    paidAt: row.paid_at || null,
    refundedAt: row.refunded_at || null,
    startsAt: row.entitlement_starts_at || null,
    expiresAt: row.entitlement_ends_at || null,
    refundRequestStatus: row.refund_request_status || null
  }
}

async function findOrder(paymentIdValue, { userId = null, providerOrderId = null } = {}) {
  const rows = await neonHelper.query(
    `SELECT p.*, s.starts_at AS entitlement_starts_at, s.ends_at AS entitlement_ends_at,
            r.status AS refund_request_status
       FROM payment_records p
       LEFT JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
       LEFT JOIN LATERAL (
         SELECT status FROM payment_refunds WHERE payment_id = p.payment_id ORDER BY created_at DESC LIMIT 1
       ) r ON TRUE
      WHERE p.provider = 'paypal'
        AND ($1::text IS NULL OR p.payment_id = $1)
        AND ($2::text IS NULL OR p.user_id = $2)
        AND ($3::text IS NULL OR p.provider_order_id = $3)
      ORDER BY p.created_at DESC LIMIT 1`,
    [paymentIdValue || null, userId, providerOrderId]
  )
  return rows?.[0] || null
}

async function completeVerifiedCapture(order, capture) {
  const amountCents = Math.round(Number(capture?.amount?.value || 0) * 100)
  const currency = String(capture?.amount?.currency_code || '').toUpperCase()
  if (currency !== 'CNY' || amountCents !== Number(order.expected_amount_cents || 0)) {
    throw error('PayPal 实付金额与订单不一致，已转人工核验', 'PAYPAL_CAPTURE_AMOUNT_MISMATCH', 409)
  }
  const rows = await neonHelper.query(
    `SELECT complete_paypal_payment($1, $2, $3, $4, $5::timestamptz, $6::jsonb) AS result`,
    [order.payment_id, order.provider_order_id, capture.id, amountCents, capture.create_time || new Date().toISOString(), JSON.stringify(safeProviderSnapshot(capture))]
  )
  const result = rows?.[0]?.result
  if (!result?.success) throw error('支付已确认，但会员权益发放失败，请联系客服', result?.code || 'PAYPAL_ENTITLEMENT_FAILED', 409)
  try {
    await trackServerAnalyticsEvent({
      event: 'membership_payment_success',
      properties: {
        feature_key: 'membership_payment', source_key: 'paypal_capture', entity_type: 'plan',
        entity_id: order.plan_id, payment_id: order.payment_id, payment_method: 'paypal'
      }
    }, {
      userId: order.user_id, anonymousId: `user_${order.user_id}`, pageKey: 'membership',
      module: 'membership_payment', featureKey: 'membership_payment', sourceKey: 'paypal_capture',
      entityType: 'plan', entityId: order.plan_id, flowId: order.payment_id
    })
  } catch (trackingError) {
    console.warn('[paypal-payment] Analytics tracking failed:', trackingError?.message || trackingError)
  }
  return result
}

function captureFromOrderResponse(data) {
  return data?.purchase_units?.flatMap(unit => unit?.payments?.captures || [])?.[0] || null
}

function refundEstimateFor(order, now = new Date()) {
  const gross = Math.max(0, Number(order.expected_amount_cents || 0))
  const refunded = Math.max(0, Number(order.refunded_amount_cents || 0))
  const remainingGross = Math.max(0, gross - refunded)
  const start = order.entitlement_starts_at ? new Date(order.entitlement_starts_at) : null
  const end = order.entitlement_ends_at ? new Date(order.entitlement_ends_at) : null
  if (!start || !end || !remainingGross || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  if (start > now) return remainingGross
  if (end <= now) return 0
  const totalMs = Math.max(1, end.getTime() - start.getTime())
  const remainingMs = Math.max(0, end.getTime() - now.getTime())
  return Math.min(remainingGross, Math.floor(gross * remainingMs / totalMs))
}

async function applyCompletedRefund(order, providerRefundId, amountCents, completedAt) {
  const rows = await neonHelper.query(
    'SELECT apply_paypal_refund($1, $2, $3, $4::timestamptz) AS result',
    [order.payment_id, providerRefundId, amountCents, completedAt || new Date().toISOString()]
  )
  return rows?.[0]?.result || { success: false }
}

export const paypalPaymentService = {
  publicConfig,
  isEnabled,
  isConfigured,
  moneyValue,
  refundEstimateFor,

  async createOrder({ user, userId, planId, idempotencyKey }) {
    if (!isEnabled() || !isConfigured()) throw error('PayPal 支付暂未开放', 'PAYPAL_DISABLED', 503)
    if (!userId || String(user?.status || '').toLowerCase() !== 'active') {
      throw error('当前账号暂无法购买会员权益', 'PAYPAL_USER_NOT_ELIGIBLE', 403)
    }
    const safeKey = normalizeIdempotencyKey(idempotencyKey)
    const existingRows = await neonHelper.query(
      `SELECT * FROM payment_records WHERE user_id = $1 AND provider = 'paypal' AND idempotency_key = $2 LIMIT 1`,
      [userId, safeKey]
    )
    if (existingRows?.[0]) return publicOrder(existingRows[0])

    const plan = await getPlan(planId)
    const scheduled = await neonHelper.query(
      `SELECT p.payment_id FROM payment_records p
       JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
       WHERE p.user_id = $1 AND p.provider = 'paypal' AND p.plan_id = $2
         AND p.status = 'completed' AND s.activated_at IS NULL AND s.superseded_at IS NULL LIMIT 1`,
      [userId, plan.id]
    )
    if (scheduled?.[0]) throw error('该方案已有待生效订单，无需重复购买', 'PAYPAL_PLAN_ALREADY_SCHEDULED', 409)

    const internalId = paymentId()
    const captureRequestId = crypto.randomUUID()
    const planSnapshot = {
      id: plan.id, name: plan.name, memberType: plan.memberType, amountCents: plan.amountCents,
      currency: 'CNY', durationMonths: plan.durationMonths, durationDays: plan.durationDays
    }
    const inserted = await neonHelper.query(
      `INSERT INTO payment_records (
        payment_id, user_id, amount, currency, payment_method, status, plan_id, provider,
        provider_status, expected_amount_cents, idempotency_key, expires_at, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, 'CNY', 'paypal', 'pending', $4, 'paypal', 'CREATING', $5, $6,
        NOW() + ($7::int * INTERVAL '1 hour'), $8::jsonb, NOW(), NOW())
      ON CONFLICT DO NOTHING RETURNING payment_id`,
      [internalId, userId, Number(plan.price), plan.id, plan.amountCents, safeKey, ORDER_TTL_HOURS,
        JSON.stringify({ paypal: { environment: configuredEnvironment(), createRequestId: safeKey, captureRequestId, planSnapshot } })]
    )
    if (!inserted?.[0]) {
      const retriedRows = await neonHelper.query(
        `SELECT * FROM payment_records WHERE user_id = $1 AND provider = 'paypal' AND idempotency_key = $2 LIMIT 1`,
        [userId, safeKey]
      )
      if (retriedRows?.[0]) return publicOrder(retriedRows[0])
      throw error('支付订单创建冲突，请刷新后重试', 'PAYPAL_ORDER_CONFLICT', 409)
    }
    try {
      const providerOrder = await paypalRequest('/v2/checkout/orders', {
        method: 'POST', requestId: safeKey,
        body: {
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: internalId,
            custom_id: internalId,
            invoice_id: internalId,
            description: `Haigoo Remote Club - ${String(plan.name || plan.id).slice(0, 80)}`,
            amount: { currency_code: 'CNY', value: moneyValue(plan.amountCents) }
          }],
          payment_source: undefined,
          application_context: {
            brand_name: 'Haigoo Remote Club', locale: 'zh-CN', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING'
          }
        }
      })
      const rows = await neonHelper.query(
        `UPDATE payment_records SET provider_order_id = $2, provider_status = $3,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('paypalOrder', $4::jsonb), updated_at = NOW()
         WHERE payment_id = $1 RETURNING *`,
        [internalId, providerOrder.id, providerOrder.status || 'CREATED', JSON.stringify(safeProviderSnapshot(providerOrder))]
      )
      return publicOrder(rows?.[0])
    } catch (providerError) {
      await neonHelper.query(
        `UPDATE payment_records SET status = 'failed', provider_status = 'CREATE_FAILED', failure_code = $2, updated_at = NOW() WHERE payment_id = $1`,
        [internalId, providerError?.code || 'PAYPAL_CREATE_FAILED']
      )
      throw providerError
    }
  },

  async captureOrder({ userId, paymentId: paymentIdValue, paypalOrderId }) {
    if (!isEnabled() || !isConfigured()) throw error('PayPal 支付暂未开放', 'PAYPAL_DISABLED', 503)
    const order = await findOrder(paymentIdValue, { userId })
    if (!order) throw error('支付订单不存在', 'PAYPAL_ORDER_NOT_FOUND', 404)
    if (String(order.provider_order_id || '') !== String(paypalOrderId || '')) {
      throw error('PayPal 订单与网站订单不匹配', 'PAYPAL_ORDER_MISMATCH', 409)
    }
    if (order.status === 'completed') return { order: publicOrder(order), entitlement: { success: true, alreadyCompleted: true } }
    const captureRequestId = String(order.metadata?.paypal?.captureRequestId || crypto.randomUUID())
    let data
    try {
      data = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.provider_order_id)}/capture`, {
        method: 'POST', requestId: captureRequestId, body: {}
      })
    } catch (captureError) {
      if (captureError.statusCode >= 500 || captureError.code === 'ORDER_ALREADY_CAPTURED') {
        await neonHelper.query(
          `UPDATE payment_records SET status = 'capture_pending', provider_status = 'UNKNOWN', failure_code = $2, updated_at = NOW() WHERE payment_id = $1`,
          [order.payment_id, captureError.code]
        )
        throw error('支付结果正在确认中，请勿重复付款', 'PAYPAL_CAPTURE_UNKNOWN', 202)
      }
      await neonHelper.query(
        `UPDATE payment_records SET provider_status = 'CAPTURE_FAILED', failure_code = $2, updated_at = NOW() WHERE payment_id = $1`,
        [order.payment_id, captureError.code]
      )
      throw captureError
    }
    const capture = captureFromOrderResponse(data)
    if (!capture) {
      await neonHelper.query(
        `UPDATE payment_records SET status = 'capture_pending', provider_status = 'UNKNOWN', failure_code = 'PAYPAL_CAPTURE_MISSING', updated_at = NOW() WHERE payment_id = $1`,
        [order.payment_id]
      )
      throw error('支付结果正在确认中，请勿重复付款', 'PAYPAL_CAPTURE_UNKNOWN', 202)
    }
    if (capture.status === 'PENDING') {
      await neonHelper.query(
        `UPDATE payment_records SET status = 'capture_pending', provider_status = 'PENDING',
          provider_capture_id = $2, provider_transaction_id = $2, updated_at = NOW() WHERE payment_id = $1`,
        [order.payment_id, capture.id]
      )
      return { order: publicOrder(await findOrder(order.payment_id, { userId })), pending: true }
    }
    if (capture.status !== 'COMPLETED') {
      throw error('PayPal 未完成付款，请更换付款方式后重试', 'PAYPAL_CAPTURE_NOT_COMPLETED', 409)
    }
    const entitlement = await completeVerifiedCapture(order, capture)
    return { order: publicOrder(await findOrder(order.payment_id, { userId })), entitlement }
  },

  async getOrder({ userId, paymentId: paymentIdValue }) {
    const row = await findOrder(paymentIdValue, { userId })
    if (!row) throw error('支付订单不存在', 'PAYPAL_ORDER_NOT_FOUND', 404)
    return publicOrder(row)
  },

  async listOrders({ userId, page = 1, pageSize = 10 }) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1))
    const safeSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 10)))
    const offset = (safePage - 1) * safeSize
    const rows = await neonHelper.query(
      `SELECT p.*, s.starts_at AS entitlement_starts_at, s.ends_at AS entitlement_ends_at,
        r.status AS refund_request_status, COUNT(*) OVER()::int AS total_count
       FROM payment_records p
       LEFT JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
       LEFT JOIN LATERAL (SELECT status FROM payment_refunds WHERE payment_id = p.payment_id ORDER BY created_at DESC LIMIT 1) r ON TRUE
       WHERE p.user_id = $1 AND p.provider = 'paypal'
       ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, safeSize, offset]
    )
    const total = Number(rows?.[0]?.total_count || 0)
    return { orders: (rows || []).map(publicOrder), page: safePage, pageSize: safeSize, total, hasMore: offset + (rows?.length || 0) < total }
  },

  async requestRefund({ userId, paymentId: paymentIdValue, reason }) {
    const normalizedReason = String(reason || '').trim()
    if (!normalizedReason) throw error('请填写退款原因', 'REFUND_REASON_REQUIRED', 400)
    const order = await findOrder(paymentIdValue, { userId })
    if (!order || !['completed', 'partially_refunded'].includes(order.status)) {
      throw error('该订单当前无法申请退款', 'REFUND_NOT_AVAILABLE', 409)
    }
    const estimatedAmountCents = refundEstimateFor(order)
    if (estimatedAmountCents <= 0) throw error('该订单已无可退的剩余权益', 'REFUND_AMOUNT_EMPTY', 409)
    try {
      const rows = await neonHelper.query(
        `INSERT INTO payment_refunds (payment_id, user_id, amount_cents, currency, reason, status, requested_by, metadata)
         VALUES ($1, $2, $3, 'CNY', $4, 'requested', $2, $5::jsonb) RETURNING *`,
        [order.payment_id, userId, estimatedAmountCents, normalizedReason.slice(0, 1000), JSON.stringify({ estimatedAt: new Date().toISOString() })]
      )
      return { refundId: rows[0].refund_id, status: rows[0].status, estimatedAmountCents }
    } catch (insertError) {
      if (/idx_payment_refunds_open_request_unique|duplicate key/i.test(String(insertError?.message || ''))) {
        throw error('该订单已有退款申请正在处理', 'REFUND_ALREADY_REQUESTED', 409)
      }
      throw insertError
    }
  },

  async listAdminOrders({ page = 1, pageSize = 25, status = 'all', search = '' } = {}) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1))
    const safeSize = Math.min(100, Math.max(10, Math.floor(Number(pageSize) || 25)))
    const offset = (safePage - 1) * safeSize
    const safeStatus = String(status || 'all')
    const pattern = String(search || '').trim() ? `%${String(search).trim().toLowerCase()}%` : null
    const rows = await neonHelper.query(
      `SELECT p.*, u.email AS user_email, u.username AS user_name,
        s.starts_at AS entitlement_starts_at, s.ends_at AS entitlement_ends_at,
        r.refund_id, r.status AS refund_request_status, r.reason AS refund_reason,
        r.amount_cents AS refund_requested_amount_cents, r.created_at AS refund_requested_at,
        COUNT(*) OVER()::int AS total_count
       FROM payment_records p
       LEFT JOIN users u ON u.user_id = p.user_id
       LEFT JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
       LEFT JOIN LATERAL (SELECT * FROM payment_refunds WHERE payment_id = p.payment_id ORDER BY created_at DESC LIMIT 1) r ON TRUE
       WHERE p.provider = 'paypal'
         AND ($1 = 'all' OR p.status = $1 OR r.status = $1)
         AND ($2::text IS NULL OR LOWER(COALESCE(u.email, '') || ' ' || COALESCE(u.username, '') || ' ' || p.payment_id) LIKE $2)
       ORDER BY p.created_at DESC LIMIT $3 OFFSET $4`,
      [safeStatus, pattern, safeSize, offset]
    )
    const total = Number(rows?.[0]?.total_count || 0)
    return {
      orders: (rows || []).map(row => ({
        ...publicOrder(row), userEmail: row.user_email || '', userName: row.user_name || '',
        refundId: row.refund_id || null, refundReason: row.refund_reason || '',
        refundRequestedAmountCents: Number(row.refund_requested_amount_cents || 0),
        refundRequestedAt: row.refund_requested_at || null
      })),
      page: safePage, pageSize: safeSize, total, totalPages: Math.max(1, Math.ceil(total / safeSize))
    }
  },

  async reviewRefund({ refundId, adminUserId, approve, note }) {
    const rows = await neonHelper.query(
      `SELECT r.*, p.provider_capture_id, p.expected_amount_cents, p.refunded_amount_cents,
        p.status AS payment_status, p.metadata, p.currency, p.user_id, p.payment_id,
        s.starts_at AS entitlement_starts_at, s.ends_at AS entitlement_ends_at
       FROM payment_refunds r JOIN payment_records p ON p.payment_id = r.payment_id
       LEFT JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
       WHERE r.refund_id = $1::uuid LIMIT 1`,
      [refundId]
    )
    const request = rows?.[0]
    if (!request || request.status !== 'requested') throw error('退款申请不存在或已处理', 'REFUND_REQUEST_NOT_FOUND', 404)
    if (!approve) {
      await neonHelper.query(
        `UPDATE payment_refunds SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
          metadata = metadata || jsonb_build_object('reviewNote', $3::text), updated_at = NOW() WHERE refund_id = $1::uuid`,
        [refundId, adminUserId, String(note || '').slice(0, 1000)]
      )
      return { status: 'rejected' }
    }
    const amountCents = refundEstimateFor(request)
    if (amountCents <= 0) throw error('审核时已无可退剩余权益', 'REFUND_AMOUNT_EMPTY', 409)
    await neonHelper.query(
      `UPDATE payment_refunds SET status = 'processing', amount_cents = $2, reviewed_by = $3,
        reviewed_at = NOW(), metadata = metadata || jsonb_build_object('reviewNote', $4::text), updated_at = NOW()
       WHERE refund_id = $1::uuid`,
      [refundId, amountCents, adminUserId, String(note || '').slice(0, 1000)]
    )
    try {
      const providerRefund = await paypalRequest(`/v2/payments/captures/${encodeURIComponent(request.provider_capture_id)}/refund`, {
        method: 'POST', requestId: String(request.request_id),
        body: { amount: { value: moneyValue(amountCents), currency_code: 'CNY' }, note_to_payer: 'Haigoo Remote Club 剩余权益退款' }
      })
      await neonHelper.query(
        `UPDATE payment_refunds SET provider_refund_id = $2, status = $3, amount_cents = $4,
          updated_at = NOW() WHERE refund_id = $1::uuid`,
        [refundId, providerRefund.id, providerRefund.status === 'COMPLETED' ? 'processing' : 'pending', amountCents]
      )
      if (providerRefund.status === 'COMPLETED') {
        await applyCompletedRefund(request, providerRefund.id, amountCents, providerRefund.update_time || providerRefund.create_time)
      }
      return { status: providerRefund.status === 'COMPLETED' ? 'completed' : 'pending', amountCents, providerRefundId: providerRefund.id }
    } catch (refundError) {
      const providerResultUnknown = !Number.isFinite(Number(refundError?.statusCode)) || Number(refundError.statusCode) >= 500
      await neonHelper.query(
        `UPDATE payment_refunds SET status = $2, metadata = metadata || jsonb_build_object('failureCode', $3::text), updated_at = NOW()
         WHERE refund_id = $1::uuid`,
        [refundId, providerResultUnknown ? 'pending' : 'failed', refundError?.code || 'PAYPAL_REFUND_FAILED']
      )
      if (providerResultUnknown) {
        return { status: 'pending', amountCents, providerRefundId: null, resultUncertain: true }
      }
      throw refundError
    }
  },

  async verifyWebhook(headers, event) {
    const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
    if (!webhookId) throw error('PayPal Webhook ID 尚未配置', 'PAYPAL_WEBHOOK_NOT_CONFIGURED', 503)
    const data = await paypalRequest('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'], webhook_id: webhookId, webhook_event: event
      }
    })
    return data?.verification_status === 'SUCCESS'
  },

  async processWebhook(event) {
    const eventId = String(event?.id || '')
    const eventType = String(event?.event_type || '')
    const resource = event?.resource || {}
    if (!eventId || !eventType) throw error('Webhook 事件字段不完整', 'PAYPAL_WEBHOOK_INVALID', 400)
    const orderId = String(resource?.supplementary_data?.related_ids?.order_id || resource?.id || '')
    let order = orderId ? await findOrder(null, { providerOrderId: orderId }) : null
    const relatedCaptureId = String(
      resource?.supplementary_data?.related_ids?.capture_id
      || resource?.disputed_transactions?.[0]?.seller_transaction_id
      || ''
    )
    if (!order && relatedCaptureId) {
      const captureRows = await neonHelper.query(
        `SELECT payment_id FROM payment_records WHERE provider = 'paypal' AND provider_capture_id = $1 LIMIT 1`,
        [relatedCaptureId]
      )
      if (captureRows?.[0]) order = await findOrder(captureRows[0].payment_id)
    }
    if (!order && resource?.id) {
      const captureRows = await neonHelper.query(
        `SELECT payment_id FROM payment_records WHERE provider = 'paypal' AND provider_capture_id = $1 LIMIT 1`,
        [String(resource.id)]
      )
      if (captureRows?.[0]) order = await findOrder(captureRows[0].payment_id)
    }
    const inserted = await neonHelper.query(
      `INSERT INTO payment_webhook_events (provider, event_id, event_type, resource_id, payment_id, payload)
       VALUES ('paypal', $1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [eventId, eventType, String(resource?.id || ''), order?.payment_id || null,
        JSON.stringify({ id: eventId, eventType, createTime: event?.create_time || null, resource: safeProviderSnapshot(resource) })]
    )
    if (!inserted?.[0]) {
      const existingRows = await neonHelper.query(
        `SELECT processing_status FROM payment_webhook_events WHERE provider = 'paypal' AND event_id = $1 LIMIT 1`,
        [eventId]
      )
      if (existingRows?.[0]?.processing_status !== 'failed') return { duplicate: true }
      await neonHelper.query(
        `UPDATE payment_webhook_events SET processing_status = 'received', error_code = NULL, processed_at = NULL, received_at = NOW(),
          payment_id = COALESCE($2, payment_id) WHERE provider = 'paypal' AND event_id = $1`,
        [eventId, order?.payment_id || null]
      )
    }
    try {
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        if (!order) throw error('Webhook 对应的网站订单不存在', 'PAYPAL_WEBHOOK_ORDER_NOT_FOUND', 404)
        await completeVerifiedCapture(order, resource)
      } else if (eventType === 'PAYMENT.CAPTURE.PENDING' && order) {
        await neonHelper.query(`UPDATE payment_records SET status = 'capture_pending', provider_status = 'PENDING', updated_at = NOW() WHERE payment_id = $1 AND status IN ('pending', 'capture_pending')`, [order.payment_id])
      } else if (eventType === 'PAYMENT.CAPTURE.DECLINED' && order) {
        await neonHelper.query(`UPDATE payment_records SET status = 'failed', provider_status = 'DECLINED', updated_at = NOW() WHERE payment_id = $1 AND status IN ('pending', 'capture_pending')`, [order.payment_id])
      } else if ((eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED' || eventType === 'PAYMENT.REFUND.COMPLETED') && order) {
        const reportedAmount = Math.round(Number(resource?.amount?.value || 0) * 100)
        const refundableRemainder = Math.max(0, Number(order.expected_amount_cents || 0) - Number(order.refunded_amount_cents || 0))
        const amountCents = Math.min(reportedAmount, refundableRemainder)
        if (amountCents > 0) {
          await applyCompletedRefund(order, String(resource.id || eventId), amountCents, resource.update_time || event.create_time)
        }
      } else if (eventType === 'PAYMENT.REFUND.FAILED' && order) {
        await neonHelper.query(`UPDATE payment_refunds SET status = 'failed', updated_at = NOW() WHERE payment_id = $1 AND status IN ('processing', 'pending')`, [order.payment_id])
      } else if (eventType === 'CUSTOMER.DISPUTE.RESOLVED' && order) {
        await neonHelper.query(
          `UPDATE payment_records SET status = CASE
             WHEN refunded_amount_cents >= expected_amount_cents THEN 'refunded'
             WHEN refunded_amount_cents > 0 THEN 'partially_refunded'
             ELSE 'completed'
           END, provider_status = $2, updated_at = NOW()
           WHERE payment_id = $1 AND status = 'review_required'`,
          [order.payment_id, eventType]
        )
      } else if (eventType.startsWith('CUSTOMER.DISPUTE.') && order) {
        await neonHelper.query(`UPDATE payment_records SET status = 'review_required', provider_status = $2, updated_at = NOW() WHERE payment_id = $1 AND status IN ('completed', 'partially_refunded', 'review_required')`, [order.payment_id, eventType])
      }
      await neonHelper.query(
        `UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = NOW() WHERE provider = 'paypal' AND event_id = $1`,
        [eventId]
      )
      return { duplicate: false, processed: true }
    } catch (processError) {
      await neonHelper.query(
        `UPDATE payment_webhook_events SET processing_status = 'failed', error_code = $2, processed_at = NOW() WHERE provider = 'paypal' AND event_id = $1`,
        [eventId, processError?.code || 'PAYPAL_WEBHOOK_PROCESS_FAILED']
      )
      throw processError
    }
  },

  async reconcilePendingOrders({ limit = 50 } = {}) {
    if (!isEnabled() || !isConfigured() || !neonHelper.isConfigured) {
      return { enabled: false, scanned: 0, completed: 0, failed: 0, pending: 0, entitlementAnomalies: 0 }
    }
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
    const expiredRows = await neonHelper.query(
      `UPDATE payment_records SET status = 'failed', provider_status = 'EXPIRED', failure_code = 'ORDER_EXPIRED', updated_at = NOW()
        WHERE provider = 'paypal' AND status = 'pending' AND expires_at IS NOT NULL AND expires_at <= NOW()
        RETURNING payment_id`
    )
    const rows = await neonHelper.query(
      `SELECT * FROM payment_records
        WHERE provider = 'paypal' AND status = 'capture_pending' AND updated_at <= NOW() - INTERVAL '2 minutes'
        ORDER BY updated_at ASC LIMIT $1`,
      [safeLimit]
    )
    let completed = 0
    let failed = expiredRows?.length || 0
    let pending = 0
    for (const order of rows || []) {
      try {
        let providerOrder = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.provider_order_id)}`)
        let capture = captureFromOrderResponse(providerOrder)
        if (!capture && providerOrder.status === 'APPROVED') {
          providerOrder = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.provider_order_id)}/capture`, {
            method: 'POST', requestId: String(order.metadata?.paypal?.captureRequestId || crypto.randomUUID()), body: {}
          })
          capture = captureFromOrderResponse(providerOrder)
        }
        if (capture?.status === 'COMPLETED') {
          await completeVerifiedCapture(order, capture)
          completed += 1
        } else if (capture?.status === 'DECLINED' || ['VOIDED'].includes(providerOrder.status)) {
          await neonHelper.query(
            `UPDATE payment_records SET status = 'failed', provider_status = $2, failure_code = 'RECONCILIATION_FAILED', updated_at = NOW() WHERE payment_id = $1`,
            [order.payment_id, capture?.status || providerOrder.status]
          )
          failed += 1
        } else {
          pending += 1
        }
      } catch (reconcileError) {
        pending += 1
        console.warn('[paypal-payment] Pending order reconciliation failed:', order.payment_id, reconcileError?.code || reconcileError?.message)
      }
    }
    const anomalies = await neonHelper.query(
      `SELECT COUNT(*)::int AS count FROM payment_records p
        WHERE p.provider = 'paypal' AND p.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM membership_entitlement_segments s WHERE s.source_payment_id = p.payment_id)`
    )
    return {
      enabled: true, scanned: rows?.length || 0, completed, failed, pending,
      entitlementAnomalies: Number(anomalies?.[0]?.count || 0)
    }
  }
}

export { normalizeIdempotencyKey, safeProviderSnapshot }
