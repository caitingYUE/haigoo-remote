/**
 * 邮件发送服务
 * 支持邮箱验证、密码重置等场景
 * 使用 Nodemailer + Gmail SMTP 或其他 SMTP 服务
 */

import nodemailer from 'nodemailer'

// SMTP 配置（从环境变量读取）
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER // 发件人邮箱
const SMTP_PASS = process.env.SMTP_PASS // 发件人密码或应用专用密码
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@haigoo.com'
const FROM_NAME = process.env.FROM_NAME || 'Haigoo Team'

// 检查 SMTP 是否配置
const SMTP_CONFIGURED = !!(SMTP_USER && SMTP_PASS)

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
 * 创建 Nodemailer transporter
 */
function createTransporter() {
  if (!SMTP_CONFIGURED) {
    console.warn('[email-service] SMTP not configured, emails will not be sent')
    return null
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  })
}

/**
 * 发送邮件（通用）
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - HTML 正文
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendEmail(to, subject, html) {
  if (!SMTP_CONFIGURED) {
    console.log(`[email-service] SMTP not configured, skipping email to ${to}`)
    console.log(`[email-service] Subject: ${subject}`)
    console.log(`[email-service] Content preview: ${html.substring(0, 200)}...`)
    return false
  }

  try {
    const transporter = createTransporter()
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html
    })
    console.log(`[email-service] Email sent to ${to}: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`[email-service] Failed to send email to ${to}:`, error.message)
    return false
  }
}

/**
 * 发送邮箱验证邮件
 * @param {string} to - 收件人邮箱
 * @param {string} username - 用户名
 * @param {string} token - 验证令牌
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendVerificationEmail(to, username, token) {
  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const verificationLink = `${siteUrl}/verify-email?token=${token}&email=${encodeURIComponent(to)}`

  const subject = '验证您的 Haigoo 账户'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { height: 40px; margin-bottom: 10px; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; transition: background-color 0.2s; }
    .button:hover { background-color: #4338CA; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
    .link { color: #4F46E5; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>验证您的邮箱地址</h2>
    </div>
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
 * @param {string} to - 收件人邮箱
 * @param {string} username - 用户名
 * @param {string} token - 重置令牌
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendPasswordResetEmail(to, username, token) {
  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const resetLink = `${siteUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`

  const subject = '重置您的 Haigoo 密码'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; transition: background-color 0.2s; }
    .button:hover { background-color: #4338CA; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
    .link { color: #4F46E5; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>重置密码</h2>
    </div>
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
 * @param {string} to - 收件人邮箱
 * @param {string} topic - 订阅主题
 * @returns {Promise<boolean>} 是否发送成功
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
    <div class="header">
      <h1>订阅成功！</h1>
    </div>
    <div class="content">
      <p>Hi,</p>
      <p>恭喜您成功订阅 Haigoo 的岗位推送服务！</p>
      <p>您关注的主题是：<strong>${label}</strong></p>
      <p>我们将每天为您精选最匹配的 5 个远程工作机会，发送到您的邮箱。</p>
      <p>如果这不是您的操作，请忽略此邮件。</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
      <p>Go Higher with Haigoo</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return sendEmail(to, subject, html)
}

/**
 * 发送每日岗位推荐邮件
 * @param {string} to - 收件人
 * @param {Array} jobs - 岗位列表
 * @param {string} topic - 主题
 */
export async function sendDailyDigestEmail(to, jobs, topic) {
  if (!jobs || jobs.length === 0) return false

  const label = getTopicLabel(topic)
  const jobsHtml = jobs.map(job => `
    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
      <h3 style="margin: 0 0 10px; font-size: 18px;">
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/job/${job.id}" style="text-decoration: none; color: #1a1a1a; font-weight: 700;">${job.title}</a>
      </h3>
      <div style="margin-bottom: 12px; font-weight: 600; color: #4F46E5; font-size: 15px;">${job.company}</div>
      <div style="margin-bottom: 12px; color: #666; font-size: 14px; display: flex; align-items: center; gap: 10px;">
        <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 6px;">📍 ${job.location || 'Remote'}</span>
        <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 6px;">💰 ${job.salary || '薪资面议'}</span>
      </div>
      <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">${(job.description || '').substring(0, 160)}...</p>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f0f0f0;">
         <a href="${process.env.SITE_URL || 'http://localhost:3000'}/job/${job.id}" style="text-decoration: none; color: #4F46E5; font-size: 14px; font-weight: 600;">查看详情 →</a>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f6f8fc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #818cf8 0%, #4F46E5 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
    .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 10px; display: block; text-decoration: none; color: white; }
    .subtitle { font-size: 16px; opacity: 0.9; font-weight: 500; }
    .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .footer { text-align: center; color: #9ca3af; font-size: 13px; margin-top: 30px; padding-bottom: 20px; }
    .btn-primary { display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; transition: all 0.2s; margin-top: 20px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); }
    .greeting { font-size: 18px; color: #1f2937; margin-bottom: 24px; }
    .intro { color: #4b5563; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Haigoo</div>
      <div class="subtitle">连接全球优质远程工作机会</div>
    </div>
    <div class="content">
      <div class="greeting">Hi,</div>
      <div class="intro">这是为您精选的 <strong>${label}</strong> 相关远程工作机会：</div>
      
      ${jobsHtml}
      
      <center>
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/jobs" class="btn-primary">查看更多机会</a>
      </center>
    </div>
    <div class="footer">
      <p style="margin-bottom: 10px;">&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
      <p style="margin-bottom: 20px;">Go Higher with Haigoo</p>
      <p>
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(to)}" style="color: #9ca3af; text-decoration: underline;">管理订阅设置</a>
      </p>
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
  return SMTP_CONFIGURED
}

