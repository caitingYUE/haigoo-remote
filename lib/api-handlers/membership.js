
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { paymentService } from '../services/payment-service.js'

// Simple UUID generator if uuid package is not available or I don't want to add dep
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const PLANS = [
  {
    id: 'club_go_yearly',
    name: '俱乐部Go会员',
    price: 299,
    currency: 'CNY',
    duration_days: 365,
    features: [
      '全部岗位的内推',
      'AI简历优化',
      '参与俱乐部所有活动',
      '后续的高级功能'
    ]
  },
  {
    id: 'goo_plus_yearly',
    name: 'Goo+会员',
    price: 999,
    currency: 'CNY',
    duration_days: 365,
    features: [
      '包含Go会员所有权益',
      '支持成为俱乐部城市主理人',
      '通过举办活动、分享帖子获得收入',
      '权益持续补充中'
    ]
  }
]

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
      return res.status(200).json({
        success: true,
        plans: PLANS
      })
    }

    // 2. Get User Status
    if (req.method === 'GET' && action === 'status') {
      const user = await getUser()
      if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      const isAdmin = user.roles?.admin === true;
      const isMemberActive = (user.memberStatus === 'active' && user.memberExpireAt ? new Date(user.memberExpireAt) > new Date() : false);

      return res.status(200).json({
        success: true,
        membership: {
          level: isMemberActive ? (user.membershipLevel || 'haigoo_member') : 'none',
          status: user.memberStatus || 'free',
          expireAt: user.memberExpireAt || null,
          isActive: isMemberActive
        }
      })
    }

    // New Action: Claim Payment (Manual)
    if (req.method === 'POST' && action === 'claim_payment') {
        const user = await getUser();
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { planId, paymentMethod, amount, email } = req.body;
        
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
      const plan = PLANS.find(p => p.id === planId)
      
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid plan' })
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
              instruction: '请点击跳转完成支付'
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
          instruction: '请点击链接跳转至小红书店铺购买，购买后请联系客服开通。'
        }
      } else if (paymentMethod === 'wechat_transfer') {
        paymentInfo = {
          type: 'qrcode',
          imageUrl: '/assets/payment/wechat-pay-qr.jpg', // Need to add this asset
          instruction: '请扫描二维码支付，支付备注您的注册邮箱。'
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
      // Allow unauthenticated calls if it's a webhook (in future), but for now mock gateway is client-side triggered or public
      // If we want to secure it, we should check payment secret or user auth
      // For now, let's allow authenticated user to confirm their OWN payment or admin to confirm ANY
      
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' })
      
      const { paymentId } = req.body
      if (!paymentId) return res.status(400).json({ success: false, error: 'Missing paymentId' })

      try {
        const result = await paymentService.confirmPayment(paymentId)
        return res.status(200).json(result)
      } catch (e) {
        console.error('Payment confirmation failed:', e)
        return res.status(500).json({ success: false, error: e.message })
      }
    }

    return res.status(404).json({ success: false, error: 'Action not found' })

  } catch (error) {
    console.error('[Membership API] Error:', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}
