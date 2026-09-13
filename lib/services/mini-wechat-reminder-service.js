import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'

let wechatAccessTokenCache = { token: '', expiresAt: 0 }
const wechatTemplateFieldsCache = new Map()

async function getWechatAccessToken() {
  if (wechatAccessTokenCache.token && wechatAccessTokenCache.expiresAt > Date.now() + 60_000) return wechatAccessTokenCache.token
  const appid = String(process.env.WECHAT_MINI_APP_ID || '').trim()
  const secret = String(process.env.WECHAT_MINI_APP_SECRET || '').trim()
  if (!appid || !secret) return ''
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new Error(`微信访问凭证获取失败 (${result.errcode || response.status})`)
  wechatAccessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in || 7200) - 120) * 1000
  }
  return result.access_token
}

async function getWechatTemplateFields(accessToken, templateId) {
  const cached = wechatTemplateFieldsCache.get(templateId)
  if (cached) return cached
  const response = await fetch(`https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate?access_token=${encodeURIComponent(accessToken)}`, {
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json()
  const template = (result.data || []).find((item) => item.priTmplId === templateId)
  if (!response.ok || !template) throw new Error(`微信订阅模板不可用 (${result.errcode || response.status})`)
  const fields = [...String(template.content || '').matchAll(/([^{}\n]+)\{\{([A-Za-z]+\d+)\.DATA\}\}/g)]
    .map((match) => ({ label: match[1].replace(/[：:\s]+$/g, '').trim(), key: match[2] }))
  if (!fields.length) throw new Error('微信订阅模板没有可用字段')
  wechatTemplateFieldsCache.set(templateId, fields)
  return fields
}

function wechatTemplateFieldValue(field, row) {
  const label = field.label
  const key = field.key.toLowerCase()
  const occurredAt = new Date(row.occurred_at || Date.now())
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt).replace(/\//g, '-')
  let value = '请进入小程序查看'
  if (/企业.*名称|招聘企业/.test(label)) value = row.company_name || 'Haigoo Remote'
  else if (/职位|岗位/.test(label)) value = row.job_title || '请进入小程序查看'
  else if (/行业/.test(label)) value = row.industry || '请进入小程序查看'
  else if (/地点|地区|位置/.test(label)) value = row.job_location || '请进入小程序查看'
  else if (/工作类型|职位类型|用工类型/.test(label)) value = row.job_type || '请进入小程序查看'
  else if (/时间|日期/.test(label) || key.startsWith('time') || key.startsWith('date')) value = time
  else if (/方案/.test(label)) value = '海狗远程企业机会'
  if (key.startsWith('thing')) value = [...String(value)].slice(0, 20).join('')
  return { value }
}

export function wechatMiniProgramState() {
  const configured = String(process.env.WECHAT_MINI_PROGRAM_STATE || '').trim().toLowerCase()
  if (['developer', 'trial', 'formal'].includes(configured)) return configured
  if (process.env.VERCEL_ENV === 'production') return 'formal'
  if (process.env.VERCEL_ENV === 'preview') return 'trial'
  return 'developer'
}

// Only explicit WeChat rejection codes known to be transient are retried.
// A timeout, invalid JSON or missing errcode may already have consumed a credit.
export async function sendWechatReminder(row, accessToken, templateId, fields) {
  let result
  try {
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: row.openid, template_id: templateId,
        page: `pages/company-detail/index?id=${encodeURIComponent(row.company_id)}`,
        miniprogram_state: wechatMiniProgramState(), lang: 'zh_CN',
        data: Object.fromEntries(fields.map(field => [field.key, wechatTemplateFieldValue(field, row)]))
      }), signal: AbortSignal.timeout(10_000)
    })
    result = await response.json()
    if (!Number.isInteger(result?.errcode)) return { status: 'unknown', error: 'invalid_response' }
    if (result.errcode === 0) {
      return response.ok
        ? { status: 'sent', error: null, messageId: result.msgid ? String(result.msgid) : null }
        : { status: 'unknown', error: 'inconsistent_http_status' }
    }
  } catch {
    return { status: 'unknown', error: 'transport_result_unknown' }
  }
  const code = result.errcode
  if ([40001, 40014, 42001].includes(code)) wechatAccessTokenCache = { token: '', expiresAt: 0 }
  return { status: [-1, 40001, 40014, 42001, 45009].includes(code) ? 'pending' : 'failed', error: String(code) }
}

export async function runWechatReminderDelivery({ maxMs = 200_000, maxMessages = 500 } = {}) {
  if (String(process.env.MINI_WECHAT_REMINDERS_ENABLED || '').toLowerCase() !== 'true') return { skipped: 'disabled' }
  const appId = String(process.env.WECHAT_MINI_APP_ID || '').trim()
  const templateId = String(process.env.WECHAT_MINI_COMPANY_UPDATE_TEMPLATE_ID || '').trim()
  if (!appId || !templateId || !process.env.WECHAT_MINI_APP_SECRET) throw new Error('WeChat reminder configuration missing')
  const started = Date.now()
  const deadline = started + Math.min(200_000, Math.max(0, maxMs))
  const worker = crypto.randomUUID()
  // ponytail: one sender per database; a partitioned queue is only needed if this
  // bounded worker cannot drain normal traffic. Lease exceeds Vercel's 300s limit.
  const lock = await neonHelper.query(
    `INSERT INTO mini_reminder_worker_lease(name,token,expires_at) VALUES('wechat',$1,NOW()+INTERVAL '330 seconds')
      ON CONFLICT(name) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at
        WHERE mini_reminder_worker_lease.expires_at<NOW() RETURNING token`, [worker])
  if (!lock?.length) return { skipped: 'worker_busy' }
  const summary = { prepared: 0, sent: 0, retry: 0, failed: 0, unknown: 0, cancelled: 0 }
  try {
    // A dead process may have sent before persisting its result. Never resend it.
    const interrupted = await neonHelper.query(
      `SELECT attempt_id FROM mini_company_update_inbox WHERE notification_status='processing'`)
    for (const row of interrupted) {
      await neonHelper.query(`SELECT mini_finish_reminder($1,'unknown','worker_interrupted',NULL)`, [row.attempt_id])
      summary.unknown++
    }
    const { prepareCompanyUpdateEvents } = await import('./mini-company-match-service.js')
    summary.prepared = await prepareCompanyUpdateEvents({ limit: 100 })
    const cancelled = await neonHelper.query(
      `UPDATE mini_company_update_inbox i SET notification_status='not_requested',last_error='authorization_or_opportunity_changed'
        WHERE i.notification_status='pending' AND NOT EXISTS
          (SELECT 1 FROM mini_reminder_deliverable d WHERE d.inbox_id=i.inbox_id AND d.app_id=$1)
        RETURNING inbox_id`, [appId])
    summary.cancelled = cancelled.length
    // Read metadata before claiming: a configuration outage leaves durable work pending.
    let accessToken = await getWechatAccessToken()
    const fields = await getWechatTemplateFields(accessToken, templateId)
    for (let n = 0; n < Math.min(500, maxMessages) && Date.now() + 15_000 < deadline; n++) {
      if (!wechatAccessTokenCache.token) accessToken = await getWechatAccessToken()
      const rows = await neonHelper.query('SELECT mini_claim_reminder($1,$2) AS item', [worker, appId])
      const row = rows?.[0]?.item
      if (!row) break
      const result = await sendWechatReminder(row, accessToken, templateId, fields)
      // If this write fails, leave processing for conservative recovery on the next run.
      await neonHelper.query('SELECT mini_finish_reminder($1,$2,$3,$4)', [row.attempt_id, result.status, result.error, result.messageId || null])
      summary[result.status === 'pending' ? 'retry' : result.status]++
    }
    const counts = await neonHelper.query(
      `SELECT COUNT(*) FILTER(WHERE notification_status='pending')::int AS pending,
        COUNT(*) FILTER(WHERE notification_status='unknown')::int AS unresolved
        FROM mini_company_update_inbox`)
    return { ...summary, ...counts[0] }
  } finally {
    await neonHelper.query('DELETE FROM mini_reminder_worker_lease WHERE name=\'wechat\' AND token=$1', [worker])
  }
}
