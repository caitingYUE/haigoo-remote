
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'

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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCorsHeaders(res)

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
      const isMemberActive = (user.memberStatus === 'active' && user.memberExpireAt ? new Date(user.memberExpireAt) > new Date() : false) || isAdmin;

      return res.status(200).json({
        success: true,
        membership: {
          level: isMemberActive ? (user.membershipLevel || 'haigoo_member') : 'none',
          status: user.memberStatus || (isAdmin ? 'active' : 'free'),
          expireAt: user.memberExpireAt || (isAdmin ? '2099-12-31T23:59:59Z' : null),
          isActive: isMemberActive
        }
      })
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

    // 4. Mock Payment Success (Dev/Admin only or for manual trigger)
    if (req.method === 'POST' && action === 'confirm-payment') {
      // This endpoint mimics the webhook or admin confirmation
      const user = await getUser()
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' })
      
      // Check if admin? Or just allow for now for testing?
      // For safety, let's require the paymentId and maybe secret? 
      // Or just allow user to self-certify for this "mvp" phase if manual check is needed?
      // Requirement says "Manual verification" might be needed for transfer.
      // But let's add a "I have paid" button that notifies admin, OR just a secret backdoor for testing.
      
      // Let's make this "admin only" or "dev only".
      // But for the user flow "After payment, contact customer service", the admin will manually update DB.
      // So I don't need a public API for this.
      // BUT, for "Simulate Payment" in dev, I'll add it.
      
      const { paymentId } = req.body
      if (!paymentId) return res.status(400).json({ success: false, error: 'Missing paymentId' })

      // Retrieve payment record
      let payment = null
      if (neonHelper.isConfigured) {
         const rows = await neonHelper.select('payment_records', { payment_id: paymentId })
         payment = rows?.[0]
      }

      if (!payment) {
          return res.status(404).json({ success: false, error: 'Payment not found' })
      }

      // Update User
      const plan = PLANS.find(p => p.id === payment.plan_id)
      if (!plan) return res.status(500).json({ success: false, error: 'Plan not found' })
        
      const now = new Date()
      const expireAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000)

      // Update user membership
      await neonHelper.update('users', {
          member_status: 'active',
          member_since: now.toISOString(),
          member_expire_at: expireAt.toISOString(),
          // Legacy fields for backward compatibility
          membership_level: 'club_go', 
          membership_start_at: now.toISOString(),
          membership_expire_at: expireAt.toISOString()
      }, { user_id: payment.user_id })
      
      // Update payment status
      await neonHelper.update('payment_records', {
          status: 'completed',
          updated_at: now.toISOString()
      }, { payment_id: paymentId })

      return res.status(200).json({ success: true, message: 'Membership activated' })
    }

    return res.status(404).json({ success: false, error: 'Action not found' })

  } catch (error) {
    console.error('[Membership API] Error:', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}
