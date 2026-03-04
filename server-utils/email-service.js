/**
 * 邮件发送服务 — Resend API
 * 支持邮箱验证、密码重置、每日岗位推送等场景
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@haigooremote.com'
const FROM_NAME = process.env.FROM_NAME || 'Haigoo'

const RESEND_CONFIGURED = !!RESEND_API_KEY

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
