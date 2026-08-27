import crypto from 'crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  deriveMembershipCapabilities,
  getLegacyMembershipLevel,
  normalizeMemberType,
  resolveMemberTypeFromUser
} from '../shared/membership.js'
import { trackServerAnalyticsEvent } from './analytics-event-service.js'
import { rebasePendingMembershipEntitlements } from './membership-redemption-code-service.js'
import { ensureHalfYearServiceEntitlements } from './mini-member-service.js'

const VIRTUAL_PAYMENT_PRODUCTS = {
  mini_club_quarter_2026: {
    productId: 'club_quarter',
    amountCents: 19900,
    memberType: 'quarter',
    durationMonths: 3,
    durationDays: 0,
    name: '季度会员',
    shortLabel: '季度会员',
    description: '持续获取匹配企业与公开岗位更新。',
    featured: false,
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
    description: '持续获取企业动态，并完善职业方向与申请材料。',
    featured: true,
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
  const productId = String(parseProductMap()[planId] || '').trim()
  if (!productId) {
    throw Object.assign(new Error('微信虚拟支付商品尚未配置'), {
      statusCode: 503,
      code: 'VIRTUAL_PAYMENT_NOT_CONFIGURED'
    })
  }
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
            callback_received_at, metadata, created_at, updated_at
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
              status, paid_at, created_at, updated_at,
              COUNT(*) OVER()::int AS total_count
         FROM payment_records
        WHERE user_id = $1
          AND openid = $2
          AND provider = 'wechat_virtual'
        ORDER BY created_at DESC, payment_id DESC
        LIMIT $3 OFFSET $4`,
      [userId, openid, safePageSize, offset]
    )
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
    if (payment.status === 'completed') {
      const completedEnv = Number(payment.metadata?.virtualPayment?.env || 0)
      if (
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
    const legacyLevel = getLegacyMembershipLevel(memberType)
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
      `WITH completed_payment AS (
         UPDATE payment_records
            SET status = 'completed',
                provider_status = 'paid',
                provider_transaction_id = $2,
                paid_amount_cents = $3,
                paid_at = COALESCE(
                  TO_TIMESTAMP(NULLIF($4::bigint, 0)),
                  NOW()
                ),
                callback_received_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_build_object('wechatNotification', $5::jsonb),
                updated_at = NOW()
          WHERE payment_id = $1
            AND status IN ('pending', 'cancelled', 'failed')
            AND payment_method = 'wechat_virtual'
            AND openid = $6
            AND product_id = $7
            AND expected_amount_cents = $3
            AND EXISTS (
              SELECT 1 FROM users
               WHERE users.user_id = payment_records.user_id
            )
          RETURNING user_id, payment_id, plan_id, paid_at
       ),
       updated_user AS (
         UPDATE users AS target
            SET member_status = 'active',
                member_since = COALESCE(target.member_since, NOW()),
                member_cycle_start_at = CASE
                  WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                    THEN target.member_expire_at
                  ELSE NOW()
                END,
                member_expire_at = (
                  CASE
                    WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                      THEN target.member_expire_at
                    ELSE NOW()
                  END
                  + make_interval(months => $8::int, days => $9::int)
                ),
                membership_expire_at = (
                  CASE
                    WHEN target.member_expire_at IS NOT NULL AND target.member_expire_at > NOW()
                      THEN target.member_expire_at
                    ELSE NOW()
                  END
                  + make_interval(months => $8::int, days => $9::int)
                ),
                member_type = $10,
                membership_level = $11
           FROM completed_payment
          WHERE target.user_id = completed_payment.user_id
          RETURNING target.user_id, target.member_status, target.member_type,
                    target.member_expire_at, target.member_cycle_start_at
       )
       SELECT completed_payment.payment_id, completed_payment.plan_id,
              updated_user.user_id, updated_user.member_status,
              updated_user.member_type, updated_user.member_expire_at,
              updated_user.member_cycle_start_at
         FROM completed_payment
         INNER JOIN updated_user ON TRUE`,
      [
        paymentIdValue,
        transactionId,
        paidAmountCents,
        Number(notification?.WeChatPayInfo?.PaidTime || 0),
        JSON.stringify(notificationSnapshot),
        openid,
        productId,
        durationMonths,
        durationDays,
        memberType,
        legacyLevel
      ]
    )
    if (!rows?.[0]) {
      const latest = await findOrder(paymentIdValue)
      if (latest?.status === 'completed') {
        const latestEnv = Number(latest.metadata?.virtualPayment?.env || 0)
        if (
          String(latest.provider_transaction_id || '') !== transactionId ||
          String(latest.openid || '') !== openid ||
          String(latest.product_id || '') !== productId ||
          Number(latest.paid_amount_cents || 0) !== paidAmountCents ||
          latestEnv !== env
        ) {
          throw Object.assign(new Error('并发重复通知与已完成订单不一致'), {
            statusCode: 409,
            code: 'VIRTUAL_PAYMENT_NOTIFICATION_CONFLICT'
          })
        }
        return { completed: true, alreadyCompleted: true, order: publicOrder(latest) }
      }
      throw new Error('微信虚拟支付权益发放失败')
    }

    try {
      await rebasePendingMembershipEntitlements(rows[0].user_id, rows[0].member_expire_at)
    } catch (error) {
      console.error('[wechat-virtual-payment] Failed to rebase pending redemption entitlements:', error?.message || error)
    }

    if (memberType === 'half_year') {
      try {
        await ensureHalfYearServiceEntitlements(rows[0].user_id, rows[0].member_expire_at)
      } catch (error) {
        console.error('[wechat-virtual-payment] Failed to provision half-year services:', error?.message || error)
      }
    }

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
  }
}

export {
  ALLOWED_PLAN_IDS,
  EXPECTED_PLAN_AMOUNTS,
  VIRTUAL_PAYMENT_PRODUCTS,
  ensurePurchaseEligible,
  parseProductMap
}
