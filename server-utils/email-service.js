/**
 * 邮件发送服务 — Resend API
 * 支持邮箱验证、密码重置、每日岗位推送等场景
 */

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
export async function sendAdminDailyFeaturedJobsEmail(to, jobs, options = {}) {
  if (!jobs || jobs.length === 0) return false

  const siteUrl = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
  const batchLabel = options.batchLabel || options.batchDate || new Date().toISOString().slice(0, 10)
  const subject = options.subject || `Haigoo 每日精选岗位 ${batchLabel}`
  const featuredCount = Number(options.featuredCount || 0)
  const fallbackCount = Number(options.fallbackCount || 0)
  const recentExcludedCount = Number(options.recentExcludedCount || 0)

  const jobsHtml = jobs.map((job, index) => {
    const jobId = encodeURIComponent(job.id)
    const detailUrl = `${siteUrl}/job/${jobId}`
    const externalUrl = String(job.url || '').trim()
    const badgeLabel = job.sourceBucket === 'featured' ? '精选池' : '普通池补位'
    const badgeBg = job.sourceBucket === 'featured' ? '#eef2ff' : '#ecfeff'
    const badgeColor = job.sourceBucket === 'featured' ? '#4338ca' : '#155e75'
    const description = truncateText(job.description, 180)
    const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean).slice(0, 4) : []

    return `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 22px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
          <div style="font-size: 12px; color: #6b7280; font-weight: 600;">#${index + 1}</div>
          <span style="display: inline-block; background: ${badgeBg}; color: ${badgeColor}; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700;">${badgeLabel}</span>
        </div>
        <h3 style="margin: 0 0 10px; font-size: 20px; line-height: 1.4;">
          <a href="${detailUrl}" style="color: #111827; text-decoration: none;">${escapeHtml(job.title)}</a>
        </h3>
        <div style="margin-bottom: 12px; color: #4338ca; font-size: 15px; font-weight: 700;">${escapeHtml(job.company)}</div>
        <div style="margin-bottom: 14px; color: #4b5563; font-size: 13px; line-height: 1.8;">
          <span style="display: inline-block; margin-right: 10px;">地点: ${escapeHtml(job.location || 'Remote')}</span>
          <span style="display: inline-block; margin-right: 10px;">薪资: ${escapeHtml(job.salary || '薪资面议')}</span>
          ${job.category ? `<span style="display: inline-block; margin-right: 10px;">分类: ${escapeHtml(job.category)}</span>` : ''}
          ${job.jobType ? `<span style="display: inline-block; margin-right: 10px;">类型: ${escapeHtml(job.jobType)}</span>` : ''}
          ${job.experienceLevel ? `<span style="display: inline-block;">级别: ${escapeHtml(job.experienceLevel)}</span>` : ''}
        </div>
        ${description ? `<p style="margin: 0 0 14px; color: #374151; font-size: 14px; line-height: 1.7;">${escapeHtml(description)}</p>` : ''}
        ${tags.length ? `<div style="margin-bottom: 14px;">${tags.map((tag) => `<span style="display: inline-block; margin: 0 8px 8px 0; padding: 4px 10px; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: 12px;">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div style="padding-top: 14px; border-top: 1px solid #f3f4f6;">
          <a href="${detailUrl}" style="color: #4f46e5; text-decoration: none; font-size: 14px; font-weight: 700; margin-right: 16px;">站内详情</a>
          ${externalUrl ? `<a href="${externalUrl}" style="color: #0f766e; text-decoration: none; font-size: 14px; font-weight: 700;">原始链接</a>` : ''}
        </div>
      </div>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background: #f4f7fb; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 720px; margin: 0 auto; padding: 24px; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #ffffff; border-radius: 20px 20px 0 0; padding: 32px 28px; }
    .content { background: #ffffff; border-radius: 0 0 20px 20px; padding: 28px; }
    .meta { display: inline-block; margin: 0 12px 12px 0; padding: 8px 12px; background: rgba(255,255,255,0.12); border-radius: 999px; font-size: 12px; font-weight: 600; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; margin-bottom: 10px;">Haigoo Admin Digest</div>
      <div style="font-size: 28px; font-weight: 800; line-height: 1.3; margin-bottom: 10px;">${escapeHtml(batchLabel)} 每日岗位精选</div>
      <div style="font-size: 15px; line-height: 1.7; opacity: 0.92;">优先发送精选岗位，不足时自动从非精选岗位补位。近 5 天内已发送过的岗位不会重复进入本批次。</div>
      <div style="margin-top: 18px;">
        <span class="meta">共 ${jobs.length} 条</span>
        <span class="meta">精选 ${featuredCount} 条</span>
        <span class="meta">补位 ${fallbackCount} 条</span>
        <span class="meta">避开近 5 天重复 ${recentExcludedCount} 条</span>
      </div>
    </div>
    <div class="content">
      ${jobsHtml}
      <div style="text-align: center; margin-top: 10px;">
        <a href="${siteUrl}/jobs" style="display: inline-block; padding: 14px 26px; border-radius: 999px; background: #111827; color: #ffffff; font-weight: 700; text-decoration: none;">打开岗位库</a>
      </div>
    </div>
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
