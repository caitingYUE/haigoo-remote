import crypto from 'node:crypto'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { paymentService } from '../services/payment-service.js'
import { systemSettingsService } from '../services/system-settings-service.js'
import {
  deriveMembershipCapabilities,
  getDefaultMembershipPlanConfig,
  getMembershipPlans,
  normalizeMembershipPlanConfig
} from '../shared/membership.js'
import { trackServerAnalyticsEvent } from '../services/analytics-event-service.js'
import { notifyMembershipActivated } from '../services/membership-notification-service.js'
import {
  getUpcomingMembershipEntitlements,
  isMembershipRedemptionReady,
  reconcileUserMembershipEntitlements,
  redeemMembershipCode
} from '../services/membership-redemption-code-service.js'

// Simple UUID generator if uuid package is not available or I don't want to add dep
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function getMembershipPlanConfig() {
  const config = await systemSettingsService.getSetting('membership_plan_config')
  return normalizeMembershipPlanConfig(config || getDefaultMembershipPlanConfig())
}

function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://haigoo-admin.vercel.app',
    'https://www.haigooremote.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

import { sendEmail } from '../../server-utils/email-service.js'

const REDEMPTION_RATE_LIMIT = 10
const REDEMPTION_RATE_WINDOW_SECONDS = 15 * 60

function redemptionRateLimitKeys(req, userId) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  const client = forwarded || String(req.headers?.['x-real-ip'] || '').trim()
  const rateLimitSecret = String(process.env.MEMBERSHIP_REDEMPTION_CODE_KEY || '')
  return [
    ['user', userId],
    ['client', client]
  ]
    .filter(([, value]) => value)
    .map(([dimension, value]) => crypto
      .createHmac('sha256', rateLimitSecret)
      .update(`membership-code-redeem:${dimension}:${value}`)
      .digest('hex'))
}

async function consumeRedemptionRateLimit(req, res, userId) {
  if (!neonHelper.isConfigured) return true
  const keyHashes = redemptionRateLimitKeys(req, userId)
  if (!keyHashes.length) return true
  const results = await Promise.all(keyHashes.map(keyHash => neonHelper.query(
    `INSERT INTO mini_rate_limits (
       key_hash, action, attempts, window_started_at, updated_at
     ) VALUES ($1, 'membership_code_redeem', 1, NOW(), NOW())
     ON CONFLICT (key_hash, action)
     DO UPDATE SET
       attempts = CASE
         WHEN mini_rate_limits.window_started_at <= NOW() - ($2::int * INTERVAL '1 second') THEN 1
         ELSE mini_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN mini_rate_limits.window_started_at <= NOW() - ($2::int * INTERVAL '1 second') THEN NOW()
         ELSE mini_rate_limits.window_started_at
       END,
       updated_at = NOW()
     RETURNING attempts, window_started_at`,
    [keyHash, REDEMPTION_RATE_WINDOW_SECONDS]
  )))
  const exceeded = results.map(rows => rows?.[0]).filter(row => Number(row?.attempts || 0) > REDEMPTION_RATE_LIMIT)
  if (!exceeded.length) return true
  const oldestWindow = Math.min(...exceeded.map(row => new Date(row.window_started_at).getTime()))
  const retryAfter = Math.max(1, Math.ceil((oldestWindow + REDEMPTION_RATE_WINDOW_SECONDS * 1000 - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfter))
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    error: '尝试次数过多，请稍后再试',
    retryAfter
  })
  return false
}

const REDEMPTION_ERROR_MESSAGES = {
  INVALID_CODE: '兑换码无效，请检查后重试',
  CODE_USED: '该兑换码已被使用',
  CODE_EXPIRED: '该兑换码已过期',
  CODE_VOIDED: '该兑换码已作废',
  MEMBERSHIP_NOT_ELIGIBLE: '当前账号无法使用兑换码，请联系 Haigoo 顾问处理',
  FEATURE_DISABLED: '会员兑换码功能暂未开放',
  USER_NOT_FOUND: '用户不存在',
  REDEMPTION_FAILED: '兑换失败，请稍后重试'
}

async function trackMembershipEventSafely(payload, context) {
  try {
    await trackServerAnalyticsEvent(payload, context)
  } catch (error) {
    console.warn('[Membership API] Analytics tracking failed:', error?.message || error)
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res, req)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Helper to get user from token
  const getUser = async () => {
    const token = extractToken(req)
    if (!token) return null
    const payload = verifyToken(token)
    if (!payload?.userId) return null
    return await userHelper.getUserById(payload.userId)
  }

  try {
    const { action } = req.query

    // 1. Get Plans
    if (req.method === 'GET' && (!action || action === 'plans')) {
      const planConfig = await getMembershipPlanConfig()
      const redemptionEnabled = await isMembershipRedemptionReady()
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      return res.status(200).json({
        success: true,
        plans: getMembershipPlans(planConfig),
        redemptionEnabled
      })
    }

    // 2. Get User Status
    if (req.method === 'GET' && action === 'status') {
      let user = await getUser()
      if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      const userId = user.userId || user.user_id
      const reconciliation = await reconcileUserMembershipEntitlements(userId)
      if (reconciliation?.activated) {
        user = await userHelper.getUserById(userId)
        try {
          await notifyMembershipActivated(user)
        } catch (error) {
          console.error('[Membership API] Failed to send scheduled activation notification:', error?.message || error)
        }
      }

      const capabilities = deriveMembershipCapabilities(user)
      const upcomingEntitlements = await getUpcomingMembershipEntitlements(userId)

      res.setHeader('Cache-Control', 'no-store, max-age=0')
      return res.status(200).json({
        success: true,
        membership: {
          level: capabilities.isActive ? (user.membershipLevel || 'haigoo_member') : 'none',
          status: user.memberStatus || 'free',
          expireAt: capabilities.isActive ? (user.memberExpireAt || null) : null,
          isActive: capabilities.isActive,
          memberType: capabilities.isActive ? capabilities.memberType : 'none',
          memberTier: capabilities.isActive ? capabilities.memberTier : 'none',
          capabilities,
          redemptionEnabled: await isMembershipRedemptionReady(),
          upcomingEntitlements
        }
      })
    }

    if (req.method === 'POST' && action === 'redeem_code') {
      const user = await getUser()
      if (!user) return res.status(401).json({ success: false, error: '请先登录后再兑换', code: 'UNAUTHORIZED' })
      if (String(user.status || '').toLowerCase() !== 'active') {
        return res.status(403).json({
          success: false,
          code: 'MEMBERSHIP_NOT_ELIGIBLE',
          error: REDEMPTION_ERROR_MESSAGES.MEMBERSHIP_NOT_ELIGIBLE
        })
      }
      const userId = user.userId || user.user_id
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      if (!(await isMembershipRedemptionReady())) {
        return res.status(503).json({
          success: false,
          code: 'FEATURE_DISABLED',
          error: REDEMPTION_ERROR_MESSAGES.FEATURE_DISABLED
        })
      }
      if (!(await consumeRedemptionRateLimit(req, res, userId))) {
        await trackMembershipEventSafely({
          event: 'membership_code_redeem_failed',
          properties: {
            feature_key: 'membership_redemption_code',
            source_key: req.body?.source_key || 'profile_membership_tab',
            error_code: 'RATE_LIMITED'
          }
        }, {
          user,
          userId,
          anonymousId: req.body?.anonymous_id || null,
          pageKey: req.body?.page_key || 'membership',
          module: 'membership_redemption',
          featureKey: 'membership_redemption_code',
          sourceKey: req.body?.source_key || 'profile_membership_tab'
        })
        return
      }

      let result
      try {
        result = await redeemMembershipCode({ code: req.body?.code, userId })
      } catch (error) {
        console.error('[Membership API] Redemption failed:', error?.code || error?.message || error)
        result = { success: false, code: error?.code || 'REDEMPTION_FAILED' }
      }

      await trackMembershipEventSafely({
        event: result?.success ? 'membership_code_redeem_success' : 'membership_code_redeem_failed',
        properties: {
          feature_key: 'membership_redemption_code',
          source_key: req.body?.source_key || 'profile_membership_tab',
          member_type: result?.memberType || null,
          activation_state: result?.activationState || null,
          error_code: result?.success ? null : result?.code || 'REDEMPTION_FAILED'
        }
      }, {
        user,
        userId,
        anonymousId: req.body?.anonymous_id || null,
        pageKey: req.body?.page_key || 'membership',
        module: 'membership_redemption',
        featureKey: 'membership_redemption_code',
        sourceKey: req.body?.source_key || 'profile_membership_tab'
      })

      if (!result?.success) {
        const code = result?.code || 'REDEMPTION_FAILED'
        const status = code === 'FEATURE_DISABLED'
          ? 503
          : code === 'USER_NOT_FOUND'
            ? 404
            : code === 'INVALID_CODE'
              ? 400
              : code === 'CODE_EXPIRED' || code === 'CODE_VOIDED'
                ? 410
                : 409
        return res.status(status).json({
          success: false,
          code,
          error: REDEMPTION_ERROR_MESSAGES[code] || REDEMPTION_ERROR_MESSAGES.REDEMPTION_FAILED
        })
      }

      if (result.activationState === 'active') {
        const updatedUser = await userHelper.getUserById(userId)
        try {
          await notifyMembershipActivated(updatedUser)
        } catch (error) {
          console.error('[Membership API] Failed to send redemption activation notification:', error?.message || error)
        }
      }

      return res.status(200).json({ success: true, redemption: result })
    }

    // New Action: Claim Payment (Manual)
    if (req.method === 'POST' && action === 'claim_payment') {
        const user = await getUser();
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { planId, paymentMethod, amount, email } = req.body;
        const planConfig = await getMembershipPlanConfig()
        const plan = getMembershipPlans(planConfig).find(p => p.id === planId)
        if (!plan) {
          return res.status(400).json({ success: false, error: 'Invalid plan' })
        }
        if (plan.comingSoon) {
          return res.status(400).json({ success: false, error: '该会员方案暂未开放' })
        }
        
        // Save to DB
        const paymentId = `manual_${generateId()}`;
        if (neonHelper.isConfigured) {
            await neonHelper.insert('payment_records', {
                payment_id: paymentId,
                user_id: user.userId || user.user_id,
                amount: amount || 0,
                currency: 'CNY',
                payment_method: paymentMethod || 'manual',
                status: 'manual_claim',
                plan_id: planId || 'unknown',
                metadata: JSON.stringify({ email_remark: email })
            });
        }

        await trackServerAnalyticsEvent({
          event: 'membership_payment_claim',
          properties: {
            feature_key: 'membership_payment',
            source_key: req.body?.source_key || 'membership_claim',
            entity_type: 'plan',
            entity_id: planId,
            payment_method: paymentMethod || 'manual',
            flow_id: req.body?.flow_id || null,
          }
        }, {
          user,
          userId: user.userId || user.user_id,
          anonymousId: req.body?.anonymous_id || null,
          pageKey: req.body?.page_key || 'membership',
          module: 'membership_payment',
          featureKey: 'membership_payment',
          sourceKey: req.body?.source_key || 'membership_claim',
          entityType: 'plan',
          entityId: planId,
          flowId: req.body?.flow_id || null,
        });

        // Notify Admin
        const adminEmail = process.env.ADMIN_EMAIL || 'caitlinyct@gmail.com';
        const subject = `[Payment Claim] User ${user.username || user.email} claims to have paid`;
        const html = `
            <h2>New Payment Claim</h2>
            <p><strong>User:</strong> ${user.username} (${user.email})</p>
            <p><strong>Plan:</strong> ${planId}</p>
            <p><strong>Amount:</strong> ¥${amount}</p>
            <p><strong>Method:</strong> ${paymentMethod}</p>
            <p><strong>Remark Email:</strong> ${email}</p>
            <p>Please check WeChat/Alipay and verify.</p>
        `;
        
        // Fire and forget email
        sendEmail(adminEmail, subject, html).catch(err => console.error('Failed to send admin notification', err));

        return res.status(200).json({ success: true });
    }

    // 3. Checkout (Create Payment Intent)
    if (req.method === 'POST' && action === 'checkout') {
      const user = await getUser()
      if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      const { planId, paymentMethod } = req.body
      const planConfig = await getMembershipPlanConfig()
      const plan = getMembershipPlans(planConfig).find(p => p.id === planId)
      
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid plan' })
      }
      if (plan.comingSoon) {
        return res.status(400).json({ success: false, error: '该会员方案暂未开放' })
      }

      // New Payment Service Flow
      if (paymentMethod === 'wechat' || paymentMethod === 'alipay') {
        try {
          const paymentId = await paymentService.createPaymentRecord({
            userId: user.userId || user.user_id,
            planId,
            amount: plan.price,
            currency: plan.currency,
            paymentMethod
          })
          
          const paymentUrl = await paymentService.generatePaymentUrl(paymentId, plan.price, paymentMethod)
          
          return res.status(200).json({
            success: true,
            paymentId,
            paymentInfo: {
              type: 'url',
              url: paymentUrl,
              instruction: '请添加顾问了解会员服务'
            }
          })
        } catch (error) {
          console.error('Payment creation failed:', error)
          return res.status(500).json({ success: false, error: 'Payment creation failed' })
        }
      }

      // Legacy/Manual Flow
      const paymentId = `pay_${generateId()}`
      
      // Save payment record
      if (neonHelper.isConfigured) {
        await neonHelper.insert('payment_records', {
          payment_id: paymentId,
          user_id: user.userId || user.user_id,
          amount: plan.price,
          currency: plan.currency,
          payment_method: paymentMethod,
          status: 'pending',
          plan_id: planId
        })
      }

      // Return payment info
      // In a real app, we would call Xiaohongshu/WeChat API here.
      // For now, we return static links/QR codes.
      
      let paymentInfo = {}
      if (paymentMethod === 'xiaohongshu') {
        paymentInfo = {
          type: 'link',
          url: 'https://www.xiaohongshu.com/user/profile/5f5e4b6e0000000001005b6e', // Example link
          instruction: '请添加顾问了解会员服务，确认加入后由顾问协助开通。'
        }
      } else if (paymentMethod === 'wechat_transfer') {
        paymentInfo = {
          type: 'qrcode',
          imageUrl: '/wechatpay.png',
          instruction: '请添加顾问并发送注册邮箱，顾问确认后开通对应权限。'
        }
      }

      return res.status(200).json({
        success: true,
        paymentId,
        paymentInfo
      })
    }

    // 4. Mock Payment Success / Callback
    if (req.method === 'POST' && action === 'confirm-payment') {
      const user = await getUser()
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const isAdmin = !!user.roles?.admin
      if (process.env.NODE_ENV === 'production' && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Production payments can only be confirmed by a verified provider callback'
        })
      }
      
      const { paymentId } = req.body
      if (!paymentId) return res.status(400).json({ success: false, error: 'Missing paymentId' })

      try {
        const result = await paymentService.confirmPayment(paymentId, {
          requesterUserId: user.userId || user.user_id,
          requesterIsAdmin: isAdmin
        })
        return res.status(200).json(result)
      } catch (e) {
        console.error('Payment confirmation failed:', e)
        const status = e.message === 'Forbidden' ? 403 : 500
        return res.status(status).json({ success: false, error: e.message })
      }
    }

    return res.status(404).json({ success: false, error: 'Action not found' })

  } catch (error) {
    console.error('[Membership API] Error:', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}
