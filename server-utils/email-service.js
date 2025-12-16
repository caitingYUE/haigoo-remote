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
  const verificationLink = `${process.env.SITE_URL || 'http://localhost:3000'}/verify-email?token=${token}&email=${encodeURIComponent(to)}`
  
  const subject = '验证您的 Haigoo 账户'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>欢迎加入 Haigoo！</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${username}</strong>，</p>
      <p>感谢您注册 Haigoo 远程工作助手！</p>
      <p>请点击下方按钮验证您的邮箱地址：</p>
      <center>
        <a href="${verificationLink}" class="button">验证邮箱</a>
      </center>
      <p>或者复制以下链接到浏览器中打开：</p>
      <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
      <p><strong>注意：</strong>此验证链接将在 15 分钟后过期。</p>
      <p>如果您没有注册 Haigoo 账户，请忽略此邮件。</p>
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
 * 发送密码重置邮件
 * @param {string} to - 收件人邮箱
 * @param {string} username - 用户名
 * @param {string} token - 重置令牌
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendPasswordResetEmail(to, username, token) {
  const resetLink = `${process.env.SITE_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(to)}`
  
  const subject = '重置您的 Haigoo 密码'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>重置密码</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${username}</strong>，</p>
      <p>我们收到了您重置 Haigoo 账户密码的请求。</p>
      <p>请点击下方按钮重置密码：</p>
      <center>
        <a href="${resetLink}" class="button">重置密码</a>
      </center>
      <p>或者复制以下链接到浏览器中打开：</p>
      <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
      <p><strong>注意：</strong>此重置链接将在 15 分钟后过期。</p>
      <p>如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
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
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
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
    <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
      <h3 style="margin: 0 0 5px;"><a href="${process.env.SITE_URL || 'http://localhost:3000'}/job/${job.id}" style="text-decoration: none; color: #667eea;">${job.title}</a></h3>
      <p style="margin: 0 0 5px; font-weight: bold; color: #555;">${job.company}</p>
      <p style="margin: 0 0 5px; color: #777; font-size: 14px;">📍 ${job.location || 'Remote'} | 💰 ${job.salary || '薪资面议'}</p>
      <p style="margin: 0; color: #666; font-size: 14px;">${(job.description || '').substring(0, 150)}...</p>
    </div>
  `).join('')

  const subject = `🔥 Haigoo 每日精选：${label} 相关的远程机会`
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    .btn { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>今日推荐</h1>
    </div>
    <div class="content">
      <p>Hi,</p>
      <p>这是为您精选的 <strong>${label}</strong> 相关远程工作机会：</p>
      
      ${jobsHtml}
      
      <center>
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/jobs" class="btn">查看更多机会</a>
      </center>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Haigoo. All rights reserved.</p>
      <p>Go Higher with Haigoo</p>
      <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(to)}" style="color: #999;">取消订阅</a></p>
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

