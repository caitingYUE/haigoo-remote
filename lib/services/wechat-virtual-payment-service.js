import crypto from 'crypto'
import {
  notifyWechatMembershipPurchased,
  notifyWechatMembershipRefunded
} from './membership-notification-service.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  deriveMembershipCapabilities,
  normalizeMemberType,
  resolveMemberTypeFromUser
} from '../shared/membership.js'
import { trackServerAnalyticsEvent } from './analytics-event-service.js'
import { ensureHalfYearServiceEntitlements } from './mini-member-service.js'

const VIRTUAL_PAYMENT_PRODUCTS = {
  club_starter_monthly: {
    productId: 'club_starter_monthly',
    amountCents: 9900,
    memberType: 'starter',
    durationMonths: 1,
    durationDays: 0,
    name: '月度会员',
    shortLabel: '月度会员',
    description: '适合按月体验完整企业与岗位数据。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    featured: false,
    features: ['浏览在招远程企业', '按方向接收岗位更新', '查看已收录联系人']
  },
  mini_club_quarter_2026: {
    productId: 'club_quarter',
    amountCents: 19900,
    memberType: 'quarter',
    durationMonths: 3,
    durationDays: 0,
    name: '季度会员',
    shortLabel: '季度会员',
    description: '持续获取匹配企业与公开岗位更新。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    featured: true,
    features: ['浏览在招远程企业', '按方向接收岗位更新', '查看已收录联系人']
  },
  mini_club_half_year_2026: {
    productId: 'club_half_year',
    amountCents: 69900,
    memberType: 'half_year',
    durationMonths: 6,
    durationDays: 0,
    name: '半年会员',
    shortLabel: '半年会员',
    description: '持续获取企业动态，并完善职业方向与申请材料。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    featured: false,
    features: [
      '浏览在招远程企业并接收方向更新',
      '查看已收录联系人',
      '职业方向诊断指导 1 次',
      '中英文简历优化 1 次',
      '定制求职材料包 1 次'
    ]
  }
}
const ALLOWED_PLAN_IDS = new Set(Object.keys(VIRTUAL_PAYMENT_PRODUCTS))
const EXPECTED_PLAN_AMOUNTS = Object.fromEntries(
  Object.entries(VIRTUAL_PAYMENT_PRODUCTS).map(([planId, product]) => [planId, product.amountCents])
)

function parseProductMap() {
  const raw = String(process.env.WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    throw Object.assign(new Error('微信虚拟支付商品映射配置无效'), {
      statusCode: 503,
      code: 'VIRTUAL_PAYMENT_CONFIG_INVALID'
    })
  }
}

function paymentId() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(7).toString('hex').toUpperCase()
  return `HG${timestamp}${random}`.slice(0, 32)
}

function ensurePurchaseEligible(user, plan) {
  const currentMemberType = resolveMemberTypeFromUser(user)
  const isActive = deriveMembershipCapabilities(user).isActive
  if (isActive && currentMemberType === 'half_year' && plan.memberType === 'half_year') {
    throw Object.assign(new Error('你的半年会员仍在有效期内，无需重复购买。如有需要，请咨询顾问。'), {
      statusCode: 409, code: 'VIRTUAL_PAYMENT_HALF_YEAR_ALREADY_ACTIVE'
    })
  }
  if (isActive && currentMemberType !== plan.memberType) {
    throw Object.assign(
      new Error('当前有效 Club 权益仅支持同方案续费；如需变更方案，请在到期后购买或联系客服'),
      {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_PLAN_CHANGE_NOT_SUPPORTED'
      }
    )
  }
}

function publicOrder(row) {
  if (!row) return null
  return {
    paymentId: String(row.payment_id || ''),
    planId: String(row.plan_id || ''),
    productId: String(row.product_id || ''),
    amountCents: Math.max(0, Number(row.expected_amount_cents || 0)),
    currency: String(row.currency || 'CNY'),
    status: String(row.status || 'pending'),
    refundedAmountCents: Math.max(0, Number(row.refunded_amount_cents || 0)),
    refundStatus: row.refund_status || null,
    createdAt: row.created_at || null,
    paidAt: row.paid_at || null
  }
}

async function getPlan(planId) {
  const product = VIRTUAL_PAYMENT_PRODUCTS[String(planId || '')]
  if (!product) {
    throw Object.assign(new Error('该 Club 权益方案暂不支持小程序内购买'), {
      statusCode: 400,
      code: 'VIRTUAL_PAYMENT_PLAN_UNAVAILABLE'
    })
  }
  const productId = String(parseProductMap()[planId] || product.productId).trim()
  if (productId !== product.productId) {
    throw Object.assign(new Error('微信虚拟支付商品映射与服务端白名单不一致'), {
      statusCode: 503,
      code: 'VIRTUAL_PAYMENT_CONFIG_INVALID'
    })
  }
  if (normalizeMemberType(product.memberType) !== product.memberType) {
    throw Object.assign(new Error('Club 权益方案类型配置无效'), {
      statusCode: 503,
      code: 'VIRTUAL_PAYMENT_CONFIG_INVALID'
    })
  }
  return { id: planId, price: product.amountCents / 100, currency: 'CNY', ...product, productId }
}

async function findOrder(paymentIdValue, { userId = null, openid = null } = {}) {
  const rows = await neonHelper.query(
    `SELECT payment_id, user_id, amount, currency, payment_method, status, plan_id,
            provider, provider_transaction_id, provider_status, app_id, openid,
            product_id, expected_amount_cents, paid_amount_cents, paid_at,
            callback_received_at, refunded_amount_cents, refund_status, refunded_at,
            metadata, created_at, updated_at
       FROM payment_records
      WHERE payment_id = $1
        AND ($2::text IS NULL OR user_id = $2)
        AND ($3::text IS NULL OR openid = $3)
      LIMIT 1`,
    [String(paymentIdValue || ''), userId, openid]
  )
  return rows?.[0] || null
}

export const wechatVirtualPaymentService = {
  async createOrder({ user, userId, openid, planId, appId, virtualEnv = 0 }) {
    const plan = await getPlan(planId)
    ensurePurchaseEligible(user, plan)
    const orderId = paymentId()
    const attach = JSON.stringify({ v: 1, p: plan.id })
    const rows = await neonHelper.query(
      `INSERT INTO payment_records (
          payment_id, user_id, amount, currency, payment_method, status, plan_id,
          provider, provider_status, app_id, openid, product_id,
          expected_amount_cents, metadata, created_at, updated_at
       ) VALUES (
          $1, $2, $3, $4, 'wechat_virtual', 'pending', $5,
          'wechat_virtual', 'created', $6, $7, $8,
          $9, $10::jsonb, NOW(), NOW()
       )
       RETURNING *`,
      [
        orderId,
        userId,
        Number(plan.price),
        String(plan.currency || 'CNY'),
        plan.id,
        String(appId || ''),
        openid,
        plan.productId,
        plan.amountCents,
        JSON.stringify({
          virtualPayment: {
            env: Number(virtualEnv) === 1 ? 1 : 0,
            quantity: 1,
            attach,
            planSnapshot: {
              memberType: plan.memberType,
              durationMonths: plan.durationMonths,
              durationDays: plan.durationDays
            }
          }
        })
      ]
    )
    const order = publicOrder(rows?.[0])
    if (!order) throw new Error('微信虚拟支付订单创建失败')
    return { ...order, attach }
  },

  async getOrder(paymentIdValue, { userId, openid }) {
    const row = await findOrder(paymentIdValue, { userId, openid })
    if (!row) {
      throw Object.assign(new Error('支付订单不存在'), {
        statusCode: 404,
        code: 'VIRTUAL_PAYMENT_ORDER_NOT_FOUND'
      })
    }
    return publicOrder(row)
  },

  async listOrders({ userId, openid, page = 1, pageSize = 20 }) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1))
    const safePageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 20)))
    const offset = (safePage - 1) * safePageSize
    const rows = await neonHelper.query(
      `SELECT payment_id, plan_id, product_id, expected_amount_cents, currency,
              status, paid_at, created_at, updated_at, refunded_amount_cents, refund_status, metadata,
              COUNT(*) OVER()::int AS total_count
         FROM payment_records
        WHERE user_id = $1
          AND openid = $2
          AND provider = 'wechat_virtual'
        ORDER BY created_at DESC, payment_id DESC
        LIMIT $3 OFFSET $4`,
      [userId, openid, safePageSize, offset]
    )
    await Promise.all((rows || [])
      .filter((row) => row.status === 'refunded' && String(row.refund_status || '').toUpperCase() === 'COMPLETED'
        && row.metadata?.membershipRefundEmail && !row.metadata.membershipRefundEmail.sentAt)
      .slice(0, 3)
      .map((row) => notifyWechatMembershipRefunded(row.payment_id).catch((error) => {
        console.warn('[wechat-virtual-payment] Refund email retry deferred:', error?.message || error)
      })))
    const total = Math.max(0, Number(rows?.[0]?.total_count || 0))
    return {
      orders: (rows || []).map(publicOrder),
      page: safePage,
      pageSize: safePageSize,
      total,
      hasMore: offset + (rows?.length || 0) < total
    }
  },

  async updateClientStatus(paymentIdValue, { userId, openid, status }) {
    const nextStatus = String(status || '')
    if (!['cancelled', 'failed'].includes(nextStatus)) {
      throw Object.assign(new Error('支付状态无效'), { statusCode: 400, code: 'VIRTUAL_PAYMENT_STATUS_INVALID' })
    }
    const rows = await neonHelper.query(
      `UPDATE payment_records
          SET status = $4,
              provider_status = CASE WHEN $4 = 'cancelled' THEN 'client_cancelled' ELSE 'client_failed' END,
              metadata = COALESCE(metadata, '{}'::jsonb)
                || jsonb_build_object('clientResult', jsonb_build_object('status', $4, 'recordedAt', NOW())),
              updated_at = NOW()
        WHERE payment_id = $1 AND user_id = $2 AND openid = $3
          AND provider = 'wechat_virtual' AND status = 'pending'
        RETURNING *`,
      [String(paymentIdValue || ''), userId, openid, nextStatus]
    )
    if (rows?.[0]) return publicOrder(rows[0])
    const existing = await findOrder(paymentIdValue, { userId, openid })
    if (!existing) {
      throw Object.assign(new Error('支付订单不存在'), { statusCode: 404, code: 'VIRTUAL_PAYMENT_ORDER_NOT_FOUND' })
    }
    return publicOrder(existing)
  },

  async completeOrder(notification) {
    const paymentIdValue = String(notification?.OutTradeNo || '').trim()
    const transactionId = String(notification?.WeChatPayInfo?.TransactionId || '').trim()
    const openid = String(notification?.OpenId || '').trim()
    const productId = String(notification?.GoodsInfo?.ProductId || '').trim()
    const quantity = Number(notification?.GoodsInfo?.Quantity || 0)
    const paidAmountCents = Number(notification?.GoodsInfo?.ActualPrice ?? notification?.GoodsInfo?.OrigPrice)
    const env = Number(notification?.Env)
    if (!paymentIdValue || !transactionId || !openid || !productId || quantity !== 1 || !Number.isSafeInteger(paidAmountCents)) {
      throw Object.assign(new Error('微信虚拟支付通知字段不完整'), {
        statusCode: 400,
        code: 'INVALID_VIRTUAL_PAYMENT_NOTIFICATION'
      })
    }

    const payment = await findOrder(paymentIdValue)
    if (!payment) {
      throw Object.assign(new Error('微信虚拟支付订单不存在'), {
        statusCode: 404,
        code: 'VIRTUAL_PAYMENT_ORDER_NOT_FOUND'
      })
    }
    if (['completed', 'partially_refunded', 'refunded'].includes(payment.status)) {
      const completedEnv = Number(payment.metadata?.virtualPayment?.env || 0)
      if (
        payment.payment_method !== 'wechat_virtual' ||
        String(payment.app_id || '') !== String(process.env.WECHAT_MINI_APP_ID || '') ||
        String(payment.provider_transaction_id || '') !== transactionId ||
        String(payment.openid || '') !== openid ||
        String(payment.product_id || '') !== productId ||
        Number(payment.paid_amount_cents || 0) !== paidAmountCents ||
        completedEnv !== env
      ) {
        throw Object.assign(new Error('重复通知与原支付订单不一致'), {
          statusCode: 409,
          code: 'VIRTUAL_PAYMENT_NOTIFICATION_CONFLICT'
        })
      }
      if (payment.status === 'completed') await notifyWechatMembershipPurchased(paymentIdValue)
      return { completed: true, alreadyCompleted: true, order: publicOrder(payment) }
    }
    const configuredEnv = Number(payment.metadata?.virtualPayment?.env || 0)
    if (
      payment.payment_method !== 'wechat_virtual' ||
      !['pending', 'cancelled', 'failed'].includes(payment.status) ||
      String(payment.app_id || '') !== String(process.env.WECHAT_MINI_APP_ID || '') ||
      String(payment.openid || '') !== openid ||
      String(payment.product_id || '') !== productId ||
      Number(payment.expected_amount_cents || 0) !== paidAmountCents ||
      env !== configuredEnv
    ) {
      throw Object.assign(new Error('微信虚拟支付通知与订单不匹配'), {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_ORDER_MISMATCH'
      })
    }

    const planSnapshot = payment.metadata?.virtualPayment?.planSnapshot || {}
    const memberType = normalizeMemberType(planSnapshot.memberType)
    const durationMonths = Math.max(0, Number(planSnapshot.durationMonths || 0))
    const durationDays = durationMonths > 0 ? 0 : Math.max(1, Number(planSnapshot.durationDays || 0))
    const catalogPlan = VIRTUAL_PAYMENT_PRODUCTS[String(payment.plan_id || '')]
    if (
      !catalogPlan ||
      !ALLOWED_PLAN_IDS.has(String(payment.plan_id || '')) ||
      String(payment.product_id || '') !== catalogPlan.productId ||
      Number(payment.expected_amount_cents || 0) !== catalogPlan.amountCents ||
      memberType !== catalogPlan.memberType ||
      durationMonths !== catalogPlan.durationMonths ||
      durationDays !== catalogPlan.durationDays
    ) {
      throw Object.assign(new Error('微信虚拟支付订单权益快照无效，请人工核验'), {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_PLAN_SNAPSHOT_INVALID'
      })
    }
    const notificationSnapshot = {
      Event: String(notification.Event || ''),
      OpenId: openid,
      OutTradeNo: paymentIdValue,
      WeChatPayInfo: {
        MchOrderNo: String(notification?.WeChatPayInfo?.MchOrderNo || ''),
        TransactionId: transactionId,
        PaidTime: Number(notification?.WeChatPayInfo?.PaidTime || 0)
      },
      Env: env,
      GoodsInfo: {
        ProductId: productId,
        Quantity: quantity,
        OrigPrice: Number(notification?.GoodsInfo?.OrigPrice || 0),
        ActualPrice: paidAmountCents,
        Attach: String(notification?.GoodsInfo?.Attach || '').slice(0, 256)
      }
    }

    const rows = await neonHelper.query(
      `SELECT complete_wechat_virtual_payment($1, $2, $3, $4::jsonb, $5) AS result`,
      [paymentIdValue, transactionId, paidAmountCents, JSON.stringify(notificationSnapshot), process.env.WECHAT_MINI_APP_ID]
    )
    const result = rows?.[0]?.result
    if (!result?.success) {
      throw Object.assign(new Error('微信虚拟支付权益发放失败'), {
        statusCode: 409, code: result?.code || 'VIRTUAL_PAYMENT_COMPLETION_FAILED'
      })
    }

    if (memberType === 'half_year') {
      try {
        await ensureHalfYearServiceEntitlements(payment.user_id)
      } catch (error) {
        console.error('[wechat-virtual-payment] Failed to provision half-year services:', error?.message || error)
      }
    }

    await notifyWechatMembershipPurchased(paymentIdValue)

    try {
      await trackServerAnalyticsEvent({
        event: 'membership_payment_success',
        properties: {
          feature_key: 'membership_payment',
          source_key: 'wechat_virtual_payment',
          entity_type: 'plan',
          entity_id: payment.plan_id,
          payment_id: paymentIdValue,
          payment_method: 'wechat_virtual'
        }
      }, {
        userId: payment.user_id,
        anonymousId: `user_${payment.user_id}`,
        pageKey: 'membership',
        module: 'membership_payment',
        featureKey: 'membership_payment',
        sourceKey: 'wechat_virtual_payment',
        entityType: 'plan',
        entityId: payment.plan_id,
        flowId: paymentIdValue
      })
    } catch (error) {
      console.warn('[wechat-virtual-payment] Analytics tracking failed:', error?.message || error)
    }
    return { completed: true, alreadyCompleted: false, order: publicOrder(await findOrder(paymentIdValue)) }
  },

  async getRefundEnvironment(notification) {
    const order = await findOrder(String(notification?.MchOrderId || notification?.OutTradeNo || '').trim())
    const rawEnv = order?.metadata?.virtualPayment?.env
    if (rawEnv == null || String(rawEnv).trim() === '' || ![0, 1].includes(Number(rawEnv))) return null
    return Number(rawEnv)
  },

  async reconcileRefund({ paymentId: paymentIdValue, userId, openid, env, providerStatus, paidFee, leftFee, queriedAt }) {
    const status = Number(providerStatus)
    const paidAmountCents = Number(paidFee)
    const remainingAmountCents = Number(leftFee)
    if (
      !String(paymentIdValue || '').trim() || !String(userId || '').trim() || !String(openid || '').trim() ||
      ![0, 1].includes(Number(env)) || !Number.isSafeInteger(status) || status < 0 || status > 8 ||
      !Number.isSafeInteger(paidAmountCents) || !Number.isSafeInteger(remainingAmountCents) ||
      paidAmountCents <= 0 || remainingAmountCents < 0 || remainingAmountCents > paidAmountCents
    ) {
      throw Object.assign(new Error('微信虚拟支付主动对账字段无效'), {
        statusCode: 400,
        code: 'INVALID_VIRTUAL_PAYMENT_REFUND_RECONCILIATION'
      })
    }
    const payment = await findOrder(paymentIdValue, { userId, openid })
    const configuredEnv = Number(payment?.metadata?.virtualPayment?.env)
    if (
      !payment || payment.payment_method !== 'wechat_virtual' ||
      !['completed', 'partially_refunded', 'refunded'].includes(String(payment.status || '')) ||
      String(payment.app_id || '') !== String(process.env.WECHAT_MINI_APP_ID || '') ||
      String(payment.currency || '') !== 'CNY' || configuredEnv !== Number(env) ||
      Number(payment.paid_amount_cents || 0) !== paidAmountCents
    ) {
      throw Object.assign(new Error('微信虚拟支付主动对账与订单不匹配'), {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_REFUND_RECONCILIATION_MISMATCH'
      })
    }
    const cumulativeRefundCents = paidAmountCents - remainingAmountCents
    const snapshot = {
      Event: 'xpay_query_order_reconcile',
      OpenId: String(openid),
      MchOrderId: String(paymentIdValue),
      ProviderStatus: status,
      PaidFee: paidAmountCents,
      LeftFee: remainingAmountCents,
      ProviderRefundTotal: cumulativeRefundCents,
      QueriedAt: String(queriedAt || new Date().toISOString()),
      Env: Number(env)
    }
    const rows = await neonHelper.query(
      `SELECT reconcile_wechat_virtual_refund_total($1, $2, $3::jsonb, NOW()) AS result`,
      [String(paymentIdValue), cumulativeRefundCents, JSON.stringify(snapshot)]
    )
    const result = rows?.[0]?.result || rows?.[0]
    if (!result?.success) {
      throw Object.assign(new Error('微信虚拟支付主动对账失败'), {
        statusCode: 409,
        code: String(result?.code || 'VIRTUAL_PAYMENT_REFUND_RECONCILIATION_FAILED')
      })
    }
    await notifyWechatMembershipRefunded(paymentIdValue)
    return result
  },

  async applyRefund(notification) {
    const paymentIdValue = String(notification?.MchOrderId || notification?.OutTradeNo || '').trim()
    const refundId = String(notification?.WxRefundId || notification?.MchRefundId || '').trim()
    const openid = String(notification?.OpenId || '').trim()
    const rawRetCode = notification?.RetCode
    const retCode = Number(rawRetCode)
    const hasRefundAmount = notification?.RefundFee != null && String(notification.RefundFee).trim() !== ''
    const refundAmountCents = hasRefundAmount ? Number(notification.RefundFee) : 0
    if (!paymentIdValue || !refundId || !openid || !hasRefundAmount || rawRetCode == null || String(rawRetCode).trim() === '' || !Number.isSafeInteger(retCode) || notification?.Env != null && ![0, 1].includes(Number(notification.Env)) || !Number.isSafeInteger(refundAmountCents) || refundAmountCents < 0 || retCode === 0 && refundAmountCents <= 0) {
      throw Object.assign(new Error('微信虚拟支付退款通知字段不完整'), {
        statusCode: 400,
        code: 'INVALID_VIRTUAL_PAYMENT_REFUND_NOTIFICATION'
      })
    }
    const payment = await findOrder(paymentIdValue)
    if (!payment || payment.payment_method !== 'wechat_virtual') {
      throw Object.assign(new Error('微信虚拟支付退款订单不存在'), {
        statusCode: 404,
        code: 'VIRTUAL_PAYMENT_ORDER_NOT_FOUND'
      })
    }
    const rawConfiguredEnv = payment.metadata?.virtualPayment?.env
    if (rawConfiguredEnv == null || String(rawConfiguredEnv).trim() === '' || ![0, 1].includes(Number(rawConfiguredEnv))) {
      throw Object.assign(new Error('微信虚拟支付退款订单缺少环境标识'), {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_REFUND_ORDER_ENVIRONMENT_MISSING'
      })
    }
    const configuredEnv = Number(rawConfiguredEnv)
    const env = notification?.Env == null ? configuredEnv : Number(notification.Env)
    if (String(payment.app_id || '') !== String(process.env.WECHAT_MINI_APP_ID || '') || String(payment.openid || '') !== openid || env !== configuredEnv || String(payment.currency || '') !== 'CNY') {
      throw Object.assign(new Error('微信虚拟支付退款通知与订单不匹配'), {
        statusCode: 409,
        code: 'VIRTUAL_PAYMENT_REFUND_ORDER_MISMATCH'
      })
    }
    const notificationSnapshot = {
      Event: String(notification?.Event || 'xpay_refund_notify'),
      OpenId: openid,
      MchOrderId: paymentIdValue,
      WxRefundId: refundId,
      MchRefundId: String(notification?.MchRefundId || ''),
      WxOrderId: String(notification?.WxOrderId || ''),
      RefundFee: refundAmountCents,
      RetCode: retCode,
      RetMsg: String(notification?.RetMsg || ''),
      RefundSuccTimestamp: Number(notification?.RefundSuccTimestamp || 0),
      Env: env
    }
    const rows = await neonHelper.query(
      `SELECT apply_wechat_virtual_refund_v2($1, $2, $3, $4, $5::jsonb,
          NOW()) AS result`,
      [paymentIdValue, refundId, refundAmountCents, retCode === 0, JSON.stringify(notificationSnapshot)]
    )
    const result = rows?.[0]?.result || rows?.[0]
    if (!result?.success) {
      throw Object.assign(new Error('微信虚拟支付退款处理失败'), {
        statusCode: 409,
        code: String(result?.code || 'VIRTUAL_PAYMENT_REFUND_FAILED')
      })
    }
    await notifyWechatMembershipRefunded(paymentIdValue)
    return result
  }
}

export {
  ALLOWED_PLAN_IDS,
  EXPECTED_PLAN_AMOUNTS,
  VIRTUAL_PAYMENT_PRODUCTS,
  ensurePurchaseEligible,
  parseProductMap
}
