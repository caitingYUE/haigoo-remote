/**
 * 邮件发送服务 — Resend API
 * 支持邮箱验证、密码重置、每日岗位推送等场景
 */

import { getPlanConfigByType, normalizeMemberType } from '../lib/shared/membership.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@haigooremote.com'
const FROM_NAME = process.env.FROM_NAME || 'Haigoo'

const RESEND_CONFIGURED = !!RESEND_API_KEY

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateText(value, limit = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}

function getTopicLabel(topic) {
  const map = {
    'all': '全部岗位',
    'development': '技术开发',
    'product': '产品设计',
    'operations': '运营市场',
    'data': '数据分析',
    'function': '职能支持',
    'ops_qa': '运维测试'
  }
  return map[topic] || topic
}

function formatEmailDate(value) {
  if (!value) return '待确认'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待确认'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 发送邮件（通用）via Resend API
 */
export async function sendEmail(to, subject, html) {
  if (!RESEND_CONFIGURED) {
    console.warn(`[email-service] RESEND_API_KEY not set, skipping email to ${to}`)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error(`[email-service] Resend API error (${res.status}):`, JSON.stringify(data))
      return false
    }

    console.log(`[email-service] Email sent to ${to}: id=${data.id}`)
    return true
  } catch (error) {
    console.error(`[email-service] Failed to send email to ${to}:`, error.message)
    return false
  }
}

/**
 * 发送邮箱验证邮件
 */
export async function sendVerificationEmail(to, username, token) {
  const siteUrl = (process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const verificationLink = `${siteUrl}/verify-email?token=${token}&email=${encodeURIComponent(to)}`

  const subject = '验证您的 Haigoo 账户'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
    .link { color: #4F46E5; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <h2>验证您的邮箱地址</h2>
    <p>亲爱的 ${username}，</p>
    <p>感谢您注册 Haigoo！请点击下方按钮验证您的邮箱地址：</p>
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button">验证邮箱</a>
    </div>
    <p>或者复制以下链接到浏览器打开：</p>
    <p><a href="${verificationLink}" class="link">${verificationLink}</a></p>
    <p>此链接将在 24 小时后失效。</p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  return await sendEmail(to, subject, html)
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(to, username, token) {
  const siteUrl = (process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const resetLink = `${siteUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`

  const subject = '重置您的 Haigoo 密码'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
    .link { color: #4F46E5; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <h2>重置密码</h2>
    <p>亲爱的 ${username}，</p>
    <p>我们收到了您重置密码的请求。如果您没有发起此请求，请忽略此邮件。</p>
    <p>请点击下方按钮重置您的密码：</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">重置密码</a>
    </div>
    <p>或者复制以下链接到浏览器打开：</p>
    <p><a href="${resetLink}" class="link">${resetLink}</a></p>
    <p>此链接将在 1 小时后失效。</p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  return await sendEmail(to, subject, html)
}

/**
 * 发送会员生效通知邮件
 */
export async function sendMembershipActivatedEmail({
  to,
  username,
  accountEmail,
  memberType,
  memberStartAt,
  memberExpireAt
}) {
  const normalizedType = normalizeMemberType(memberType)
  const plan = getPlanConfigByType(normalizedType)
  const siteUrl = (process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const displayName = escapeHtml(username || '你好')
  const displayEmail = escapeHtml(accountEmail || to)
  const displayMemberType = escapeHtml(plan?.name || '海狗远程俱乐部会员')
  const effectiveAt = formatEmailDate(memberStartAt)
  const expireAt = formatEmailDate(memberExpireAt)
  const benefits = (plan?.features || [
    'AI 简历优化与求职辅助',
    '邮箱直申与关键人脉能力',
    '更多远程岗位与企业信息查看'
  ]).slice(0, 5)

  const subject = `你的 ${plan?.shortLabel || 'Haigoo'} 会员已生效`
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f6f8fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
    .wrapper { max-width: 640px; margin: 0 auto; padding: 28px 16px; }
    .shell { overflow: hidden; border-radius: 24px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 20px 60px -42px rgba(15, 23, 42, 0.2); }
    .hero { padding: 28px 28px 24px; background: linear-gradient(180deg, #eef2ff 0%, #ffffff 100%); border-bottom: 1px solid #e2e8f0; }
    .brand { font-size: 12px; font-weight: 800; letter-spacing: 0.18em; color: #4f46e5; text-transform: uppercase; }
    .title { margin: 12px 0 8px; font-size: 28px; line-height: 1.2; font-weight: 800; color: #0f172a; }
    .subtitle { margin: 0; font-size: 15px; line-height: 1.8; color: #475569; }
    .content { padding: 28px; }
    .panel { border: 1px solid #e2e8f0; border-radius: 20px; background: #f8fafc; padding: 18px 18px 14px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .row:last-child { border-bottom: none; padding-bottom: 0; }
    .label { font-size: 13px; color: #64748b; }
    .value { font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; }
    .section-title { margin: 24px 0 12px; font-size: 16px; font-weight: 800; color: #0f172a; }
    .benefit { padding: 11px 0; border-bottom: 1px solid #eef2f7; font-size: 14px; line-height: 1.7; color: #334155; }
    .benefit:last-child { border-bottom: none; }
    .cta { display: inline-block; margin-top: 24px; padding: 13px 24px; border-radius: 999px; background: #4f46e5; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; }
    .foot { margin-top: 24px; font-size: 13px; line-height: 1.8; color: #64748b; }
    .support { color: #4f46e5; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="shell">
      <div class="hero">
        <div class="brand">Haigoo Remote Club</div>
        <h1 class="title">会员权益已生效</h1>
        <p class="subtitle">Hi，${displayName}。您的会员已经开通成功，现在可以开始使用更完整的求职能力了。</p>
      </div>
      <div class="content">
        <div class="panel">
          <div class="row">
            <div class="label">会员类型</div>
            <div class="value">${displayMemberType}</div>
          </div>
          <div class="row">
            <div class="label">生效时间</div>
            <div class="value">${escapeHtml(effectiveAt)}</div>
          </div>
          <div class="row">
            <div class="label">失效时间</div>
            <div class="value">${escapeHtml(expireAt)}</div>
          </div>
          <div class="row">
            <div class="label">昵称</div>
            <div class="value">${displayName}</div>
          </div>
          <div class="row">
            <div class="label">注册账户</div>
            <div class="value">${displayEmail}</div>
          </div>
        </div>

        <div class="section-title">当前可使用的会员权益</div>
        <div class="panel" style="background:#ffffff;">
          ${benefits.map((item) => `<div class="benefit">${escapeHtml(item)}</div>`).join('')}
        </div>

        <a class="cta" href="${siteUrl}/membership">前往海狗会员中心</a>

        <div class="foot">
          如果您在使用过程中有任何问题，欢迎随时联系官方支持邮箱：
          <a class="support" href="mailto:hi@haigooremote.com">hi@haigooremote.com</a><br />
          海狗网站：<a class="support" href="${siteUrl}">${siteUrl}</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail(to, subject, html)
}

/**
 * 发送会员失效通知邮件
 */
export async function sendMembershipExpiredEmail({
  to,
  username,
  accountEmail,
  memberType,
  memberExpireAt
}) {
  const normalizedType = normalizeMemberType(memberType)
  const plan = getPlanConfigByType(normalizedType)
  const siteUrl = (process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const displayName = escapeHtml(username || '你好')
  const displayEmail = escapeHtml(accountEmail || to)
  const displayMemberType = escapeHtml(plan?.name || '海狗远程俱乐部会员')
  const expireAt = formatEmailDate(memberExpireAt)
  const fallbackBenefits = [
    '您的账号权益已退回免费用户版本',
    '仍可继续浏览和使用免费用户可用功能',
    '如需恢复会员权益，可前往会员中心重新开通'
  ]

  const subject = `你的 ${plan?.shortLabel || 'Haigoo'} 会员已到期`
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f6f8fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
    .wrapper { max-width: 640px; margin: 0 auto; padding: 28px 16px; }
    .shell { overflow: hidden; border-radius: 24px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 20px 60px -42px rgba(15, 23, 42, 0.2); }
    .hero { padding: 28px 28px 24px; background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); border-bottom: 1px solid #e2e8f0; }
    .brand { font-size: 12px; font-weight: 800; letter-spacing: 0.18em; color: #ea580c; text-transform: uppercase; }
    .title { margin: 12px 0 8px; font-size: 28px; line-height: 1.2; font-weight: 800; color: #0f172a; }
    .subtitle { margin: 0; font-size: 15px; line-height: 1.8; color: #475569; }
    .content { padding: 28px; }
    .panel { border: 1px solid #fed7aa; border-radius: 20px; background: #fff7ed; padding: 18px 18px 14px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #fdba74; }
    .row:last-child { border-bottom: none; padding-bottom: 0; }
    .label { font-size: 13px; color: #9a3412; }
    .value { font-size: 14px; font-weight: 700; color: #7c2d12; text-align: right; }
    .section-title { margin: 24px 0 12px; font-size: 16px; font-weight: 800; color: #0f172a; }
    .benefit { padding: 11px 0; border-bottom: 1px solid #ffedd5; font-size: 14px; line-height: 1.7; color: #7c2d12; }
    .benefit:last-child { border-bottom: none; }
    .cta { display: inline-block; margin-top: 24px; padding: 13px 24px; border-radius: 999px; background: #ea580c; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; }
    .foot { margin-top: 24px; font-size: 13px; line-height: 1.8; color: #64748b; }
    .support { color: #ea580c; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="shell">
      <div class="hero">
        <div class="brand">Haigoo Remote Club</div>
        <h1 class="title">会员权益已失效</h1>
        <p class="subtitle">Hi，${displayName}。您的会员已到期，账号权益已退回免费用户版本，如需恢复会员权益，可前往会员中心重新开通。</p>
      </div>
      <div class="content">
        <div class="panel">
          <div class="row">
            <div class="label">会员类型</div>
            <div class="value">${displayMemberType}</div>
          </div>
          <div class="row">
            <div class="label">失效时间</div>
            <div class="value">${escapeHtml(expireAt)}</div>
          </div>
          <div class="row">
            <div class="label">昵称</div>
            <div class="value">${displayName}</div>
          </div>
          <div class="row">
            <div class="label">注册账户</div>
            <div class="value">${displayEmail}</div>
          </div>
        </div>

        <div class="section-title">当前说明</div>
        <div class="panel" style="background:#ffffff;border-color:#e2e8f0;">
          ${fallbackBenefits.map((item) => `<div class="benefit">${escapeHtml(item)}</div>`).join('')}
        </div>

        <a class="cta" href="${siteUrl}/membership">前往会员中心重新开通</a>

        <div class="foot">
          如需恢复全部会员权益，可随时重新开通会员。若有疑问，欢迎联系：
          <a class="support" href="mailto:hi@haigooremote.com">hi@haigooremote.com</a><br />
          海狗网站：<a class="support" href="${siteUrl}">${siteUrl}</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail(to, subject, html)
}

/**
 * 发送订阅欢迎邮件
 */
export async function sendSubscriptionWelcomeEmail(to, topic) {
  const label = getTopicLabel(topic)
  const subject = '订阅成功！欢迎加入 Haigoo 岗位推送'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #818cf8 0%, #4F46E5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>订阅成功！</h1></div>
    <div class="content">
      <p>Hi,</p>
      <p>恭喜您成功订阅 Haigoo 的岗位推送服务！</p>
      <p>您关注的主题是：<strong>${label}</strong></p>
      <p>我们将每天为您精选最匹配的 5 个远程工作机会，发送到您的邮箱。</p>
      <p>如果这不是您的操作，请忽略此邮件。</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
  return sendEmail(to, subject, html)
}

/**
 * 发送每日岗位推荐邮件
 */
export async function sendDailyDigestEmail(to, jobs, topic) {
  if (!jobs || jobs.length === 0) return false

  const label = getTopicLabel(topic)
  const siteUrl = process.env.SITE_URL || 'https://haigooremote.com'

  const jobsHtml = jobs.map(job => `
    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
      <h3 style="margin: 0 0 10px; font-size: 18px;">
        <a href="${siteUrl}/job/${job.id}" style="text-decoration: none; color: #1a1a1a; font-weight: 700;">${job.title}</a>
      </h3>
      <div style="margin-bottom: 12px; font-weight: 600; color: #4F46E5; font-size: 15px;">${job.company}</div>
      <div style="margin-bottom: 12px; color: #666; font-size: 14px;">
        <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 6px; margin-right: 8px;">📍 ${job.location || 'Remote'}</span>
        <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 6px;">💰 ${job.salary || '薪资面议'}</span>
      </div>
      <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">${(job.description || '').substring(0, 160)}...</p>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f0f0f0;">
        <a href="${siteUrl}/job/${job.id}" style="text-decoration: none; color: #4F46E5; font-size: 14px; font-weight: 600;">查看详情 →</a>
      </div>
    </div>
  `).join('')

  const subject = `🔥 Haigoo 每日精选：${label} 相关远程机会`
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f6f8fc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #818cf8 0%, #4F46E5 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
    .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; }
    .footer { text-align: center; color: #9ca3af; font-size: 13px; margin-top: 30px; padding-bottom: 20px; }
    .btn-primary { display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">Haigoo</div>
      <div style="font-size: 15px; opacity: 0.9;">连接全球优质远程工作机会</div>
    </div>
    <div class="content">
      <div style="font-size: 18px; color: #1f2937; margin-bottom: 24px;">Hi,</div>
      <div style="color: #4b5563; margin-bottom: 30px;">这是为您精选的 <strong>${label}</strong> 相关远程工作机会：</div>
      ${jobsHtml}
      <center>
        <a href="${siteUrl}/jobs" class="btn-primary">查看更多机会</a>
      </center>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
      <p><a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(to)}" style="color: #9ca3af;">管理订阅设置</a></p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail(to, subject, html)
}

/**
 * 发送管理员每日精选岗位邮件
 */
export async function sendAdminDailyFeaturedJobsEmail(to, digest) {
  const audiences = digest?.audiences || {}
  const publicAudience = audiences.public
  const memberAudience = audiences.member

  if (!publicAudience?.jobCount && !memberAudience?.jobCount) return false

  const siteUrl = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const batchLabel = digest?.batchLabel || digest?.batchDate || new Date().toISOString().slice(0, 10)
  const subject = digest?.subject || `海狗远程俱乐部 ${batchLabel} 社群推送`
  const adminPreviewUrl = `${siteUrl}/admin_team?tab=social-push`

  const renderAudienceSection = (audience, accentColor) => {
    if (!audience) return ''

    return `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 24px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;">
          <h2 style="margin: 0; font-size: 20px; line-height: 1.4; color: #111827;">${escapeHtml(audience.title || '')}</h2>
          <span style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${accentColor}; color: #ffffff; font-size: 12px; font-weight: 700;">${escapeHtml(audience.groupLabel || '')}</span>
        </div>
        <div style="margin-bottom: 14px; color: #4b5563; font-size: 13px; line-height: 1.7;">
          <div>${escapeHtml(audience.ruleSummary || '')}</div>
          <div style="margin-top: 6px;">本批次 ${audience.jobCount || 0} 条，优先池 ${audience.preferredCount || 0} 条，补位 ${audience.fallbackCount || 0} 条，避开近 ${audience.repeatWindowDays || 0} 天重复 ${audience.recentExcludedCount || 0} 条。</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #0f172a; font-size: 14px; line-height: 1.8; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">${escapeHtml(audience.copyText || '')}</pre>
        </div>
      </div>
    `
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background: #f3f6fb; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 820px; margin: 0 auto; padding: 24px; }
    .hero { background: linear-gradient(135deg, #082f49 0%, #1d4ed8 100%); color: #ffffff; border-radius: 22px; padding: 30px 28px; margin-bottom: 20px; }
    .button { display: inline-block; padding: 12px 20px; border-radius: 999px; background: #111827; color: #ffffff !important; text-decoration: none; font-weight: 700; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.82; margin-bottom: 10px;">Haigoo Social Push</div>
      <div style="font-size: 28px; font-weight: 800; line-height: 1.35; margin-bottom: 10px;">${escapeHtml(batchLabel)} 管理员社群推送预览</div>
      <div style="font-size: 15px; line-height: 1.75; opacity: 0.94;">邮件内已切换为便于复制转发的中文文案。若要一键复制，请直接打开管理后台的社群推送模块。</div>
      <div style="margin-top: 18px;">
        <a href="${adminPreviewUrl}" class="button">打开后台一键复制</a>
      </div>
    </div>

    ${renderAudienceSection(publicAudience, '#0f766e')}
    ${renderAudienceSection(memberAudience, '#4338ca')}

    <div class="footer">
      <div>${escapeHtml(FROM_NAME)} · ${escapeHtml(FROM_EMAIL)}</div>
      <div style="margin-top: 6px;">Generated at ${escapeHtml(new Date().toISOString())}</div>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail(to, subject, html)
}

/**
 * 检查邮件服务是否已配置
 */
export function isEmailServiceConfigured() {
  return RESEND_CONFIGURED
}

/**
 * 测试 Resend 连接并发送测试邮件
 */
export async function sendTestEmail(to) {
  console.log('[email-service] ── Resend Test Start ──')
  console.log(`[email-service] RESEND_API_KEY: ${RESEND_API_KEY ? '(set, length=' + RESEND_API_KEY.length + ')' : '(NOT SET)'}`)
  console.log(`[email-service] FROM_EMAIL: ${FROM_EMAIL}`)
  console.log(`[email-service] RESEND_CONFIGURED: ${RESEND_CONFIGURED}`)

  if (!RESEND_CONFIGURED) {
    return { success: false, error: 'RESEND_API_KEY not set' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: '[Haigoo] SMTP 测试邮件',
        html: `<p>如果您收到这封邮件，说明 Resend 配置正确！<br>发件账号：${FROM_EMAIL}<br>时间：${new Date().toISOString()}</p>`
      })
    })

    const data = await res.json()
    console.log('[email-service] Resend response:', JSON.stringify(data))

    if (!res.ok) {
      return { success: false, error: data.message || JSON.stringify(data), status: res.status }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('[email-service] Resend test FAILED:', error.message)
    return { success: false, error: error.message }
  }
}
