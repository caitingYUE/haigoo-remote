import crypto from 'crypto'
import { comparePassword, generateToken, sanitizeUser } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'
import { subscriptionsService } from '../services/subscriptions-service.js'
import { countJobsFromNeon, readJobsFromNeon } from './processed-jobs.js'
import freeUsageHandler from './free-usage.js'
import authHandler from '../../api/auth.js'
import userProfileHandler from './user-profile.js'
import { trackServerAnalyticsEvent } from '../services/analytics-event-service.js'

const IDENTITY_TABLE = 'mini_wechat_identities'
const MINI_JOB_VIEWS_TABLE = 'mini_job_views'
const FAVORITES_TABLE = 'favorites'
const RATE_LIMIT_TABLE = 'mini_rate_limits'
const CONSENTS_TABLE = 'mini_account_consents'
const IDEMPOTENCY_TABLE = 'mini_idempotency_keys'
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const FREE_MINI_JOB_VIEW_LIMIT = 100
const AGREEMENT_VERSION = '2026-07-23'
const PRIVACY_VERSION = '2026-07-23'

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function gatewaySecrets() {
  return [...new Set([
    process.env.MINI_GATEWAY_SHARED_SECRET,
    process.env.MINI_GATEWAY_PRODUCTION_SECRET
  ].filter(Boolean))]
}

function requestSignature(method, action, timestamp, body, secret = process.env.MINI_GATEWAY_SHARED_SECRET) {
  if (!secret) return ''
  const bodyHash = crypto.createHash('sha256').update(stableJson(body || {})).digest('hex')
  return crypto
    .createHmac('sha256', secret)
    .update(`${String(method || '').toUpperCase()}:${action}:${timestamp}:${bodyHash}`)
    .digest('hex')
}

function hasGatewaySignature(req, action) {
  const timestamp = String(req.headers['x-haigoo-mini-timestamp'] || '')
  const received = String(req.headers['x-haigoo-mini-signature'] || '')
  const timestampMs = Number(timestamp)
  const secrets = gatewaySecrets()
  if (!secrets.length || !Number.isFinite(timestampMs)) return false
  if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false

  const isGet = String(req.method || '').toUpperCase() === 'GET'
  const signedQuery = Object.fromEntries(Object.entries(req.query || {}).filter(([key]) => key !== 'action'))
  // Keep accepting the legacy empty-body GET signature during the rolling deployment.
  // All newly deployed CloudRun services sign the complete query payload.
  const signaturePayloads = isGet ? [signedQuery, {}] : [req.body || {}]
  return secrets.some((secret) => signaturePayloads.some((signaturePayload) => {
    const expected = requestSignature(req.method, action, timestamp, signaturePayload, secret)
    return Boolean(expected)
      && received.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  }))
}

function isOpenId(value) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(String(value || ''))
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isIdempotencyKey(value) {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(String(value || ''))
}

function rateLimitKeys(req, action) {
  const openid = String(req.body?.openid || '').trim()
  const email = normalizeEmail(req.body?.email)
  const clientKey = String(req.body?.clientKey || '').trim().slice(0, 128)
  const dimensions = [
    ['openid', openid],
    ['email', email],
    ['client', clientKey]
  ].filter(([, value]) => value)
  if (!dimensions.length) dimensions.push(['fallback', 'unknown'])
  return dimensions.map(([dimension, value]) => (
    crypto.createHash('sha256').update(`${action}:${dimension}:${value}`).digest('hex')
  ))
}

async function consumeRateLimit(req, res, { action, limit, windowSeconds }) {
  const keyHashes = rateLimitKeys(req, action)
  const results = await Promise.all(keyHashes.map((keyHash) => neonHelper.query(
    `INSERT INTO ${RATE_LIMIT_TABLE} (
        key_hash, action, attempts, window_started_at, updated_at
     ) VALUES ($1, $2, 1, NOW(), NOW())
     ON CONFLICT (key_hash, action)
     DO UPDATE SET
       attempts = CASE
         WHEN ${RATE_LIMIT_TABLE}.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN 1
         ELSE ${RATE_LIMIT_TABLE}.attempts + 1
       END,
       window_started_at = CASE
         WHEN ${RATE_LIMIT_TABLE}.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN NOW()
         ELSE ${RATE_LIMIT_TABLE}.window_started_at
       END,
       updated_at = NOW()
     RETURNING attempts, window_started_at`,
    [keyHash, action, windowSeconds]
  )))
  const exceeded = results
    .map((rows, index) => ({
      attempts: Number(rows?.[0]?.attempts || 1),
      windowStartedAt: new Date(rows?.[0]?.window_started_at || Date.now()).getTime(),
      keyHash: keyHashes[index]
    }))
    .filter((entry) => entry.attempts > limit)
  if (!exceeded.length) return { allowed: true, keyHashes }

  const windowStartedAt = Math.min(...exceeded.map((entry) => entry.windowStartedAt))
  const retryAfter = Math.max(1, Math.ceil((windowStartedAt + windowSeconds * 1000 - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfter))
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    error: '操作过于频繁，请稍后再试',
    retryAfter
  })
  return { allowed: false, keyHashes }
}

async function clearRateLimit(keyHashes, action) {
  if (!keyHashes?.length) return
  await neonHelper.query(
    `DELETE FROM ${RATE_LIMIT_TABLE} WHERE key_hash = ANY($1::text[]) AND action = $2`,
    [keyHashes, action]
  )
}

async function readIdempotentResult(openid, action, idempotencyKey) {
  if (!isIdempotencyKey(idempotencyKey)) return null
  const rows = await neonHelper.query(
    `SELECT response_status, response_body
       FROM ${IDEMPOTENCY_TABLE}
      WHERE app_id = $1 AND openid = $2 AND action = $3 AND idempotency_key = $4
      LIMIT 1`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, action, idempotencyKey]
  )
  return rows?.[0] || null
}

async function claimIdempotencyKey(openid, action, idempotencyKey) {
  if (!isIdempotencyKey(idempotencyKey)) return { claimed: true, enabled: false }
  const rows = await neonHelper.query(
    `INSERT INTO ${IDEMPOTENCY_TABLE} (
        app_id, openid, action, idempotency_key, created_at, expires_at
     ) VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')
     ON CONFLICT (app_id, openid, action, idempotency_key) DO NOTHING
     RETURNING idempotency_key`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, action, idempotencyKey]
  )
  return { claimed: Boolean(rows?.[0]), enabled: true }
}

async function saveIdempotentResult(openid, action, idempotencyKey, status, payload) {
  if (!isIdempotencyKey(idempotencyKey)) return
  await neonHelper.query(
    `UPDATE ${IDEMPOTENCY_TABLE}
        SET response_status = $5, response_body = $6::jsonb, completed_at = NOW()
      WHERE app_id = $1 AND openid = $2 AND action = $3 AND idempotency_key = $4`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, action, idempotencyKey, status, JSON.stringify(payload || {})]
  )
}

function captureResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
    end(payload) {
      this.payload = payload
      return this
    }
  }
}

async function invoke(handler, request) {
  const response = captureResponse()
  await handler(request, response)
  return response
}

async function getIdentity(openid) {
  const rows = await neonHelper.query(
    `SELECT app_id, openid, user_id, created_at, linked_at
       FROM ${IDENTITY_TABLE}
      WHERE app_id = $1 AND openid = $2
      LIMIT 1`,
    [process.env.WECHAT_MINI_APP_ID || '', openid]
  )
  return rows?.[0] || null
}

function ensureDatabase(res) {
  if (neonHelper.isConfigured) return true
  res.status(503).json({ success: false, error: '会员服务暂不可用，请稍后重试' })
  return false
}

function userSummary(user) {
  const safeUser = sanitizeUser(user)
  return {
    userId: safeUser?.userId || null,
    username: safeUser?.username || '',
    avatar: safeUser?.avatar || '',
    email: safeUser?.email || '',
    memberType: safeUser?.memberType || 'none',
    isMember: Boolean(safeUser?.membershipCapabilities?.isActive)
  }
}

async function handleSession(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  if (!isOpenId(openid)) return res.status(400).json({ success: false, error: '无效的微信登录凭证' })

  const identity = await getIdentity(openid)
  const user = identity?.user_id ? await userHelper.getUserById(identity.user_id) : null
  return res.status(200).json({
    success: true,
    openid,
    bound: Boolean(user),
    user: user ? userSummary(user) : null
  })
}

async function handleBind(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  if (!isOpenId(openid) || !email || !password) {
    return res.status(400).json({ success: false, error: '请填写网站账号邮箱和密码' })
  }

  const rateLimit = await consumeRateLimit(req, res, {
    action: 'bind',
    limit: 5,
    windowSeconds: 15 * 60
  })
  if (!rateLimit.allowed) return

  const user = await userHelper.getUserByEmail(email)
  const passwordHash = user?.passwordHash || user?.password_hash
  if (!user || !passwordHash || !(await comparePassword(password, passwordHash))) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
  }
  if (user.status !== 'active') return res.status(403).json({ success: false, error: '账户已被停用' })

  const identity = await getIdentity(openid)
  if (identity?.user_id && identity.user_id !== user.user_id) {
    return res.status(409).json({ success: false, error: '该微信已绑定其他 Haigoo 账号' })
  }

  const appId = process.env.WECHAT_MINI_APP_ID || ''
  await neonHelper.query(
    `INSERT INTO ${IDENTITY_TABLE} (app_id, openid, user_id, created_at, linked_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (app_id, openid)
     DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = NOW()`,
    [appId, openid, user.user_id]
  )

  await clearRateLimit(rateLimit.keyHashes, 'bind')

  return res.status(200).json({ success: true, bound: true, user: userSummary(user) })
}

async function handleRegister(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const username = String(req.body?.username || '').trim()
  const agreementVersion = String(req.body?.agreementVersion || '').trim()
  const privacyVersion = String(req.body?.privacyVersion || '').trim()
  const acceptedAt = new Date(req.body?.acceptedAt || '')
  if (!isOpenId(openid) || !email || !password) {
    return res.status(400).json({ success: false, error: '请填写邮箱和密码' })
  }
  if (
    agreementVersion !== AGREEMENT_VERSION ||
    privacyVersion !== PRIVACY_VERSION ||
    Number.isNaN(acceptedAt.getTime())
  ) {
    return res.status(400).json({
      success: false,
      code: 'CONSENT_REQUIRED',
      error: '请先阅读并同意用户服务协议和隐私政策'
    })
  }

  const rateLimit = await consumeRateLimit(req, res, {
    action: 'register',
    limit: 3,
    windowSeconds: 60 * 60
  })
  if (!rateLimit.allowed) return

  const identity = await getIdentity(openid)
  if (identity?.user_id) {
    return res.status(409).json({ success: false, error: '当前微信已绑定 Haigoo 账号，无需重复注册' })
  }

  // Keep account creation in the existing auth handler, so password policies,
  // mail verification and abuse protections stay identical to the website.
  const registration = await invoke(authHandler, {
    method: 'POST',
    query: { action: 'register' },
    body: { email, password, username: username || undefined },
    headers: {}
  })
  if (registration.statusCode < 200 || registration.statusCode >= 300) {
    return res.status(registration.statusCode).json(registration.payload || {
      success: false,
      error: '注册服务暂时不可用'
    })
  }

  const user = await userHelper.getUserByEmail(email)
  if (!user?.user_id) {
    return res.status(500).json({ success: false, error: '账号已创建，但暂时无法完成微信绑定' })
  }

  const appId = process.env.WECHAT_MINI_APP_ID || ''
  await neonHelper.query(
    `INSERT INTO ${IDENTITY_TABLE} (app_id, openid, user_id, created_at, linked_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (app_id, openid)
     DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = NOW()`,
    [appId, openid, user.user_id]
  )

  await neonHelper.query(
    `INSERT INTO ${CONSENTS_TABLE} (
        app_id, openid, user_id, agreement_version, privacy_version, accepted_at, created_at
     ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (app_id, openid, agreement_version, privacy_version)
     DO UPDATE SET user_id = EXCLUDED.user_id, accepted_at = NOW()`,
    [appId, openid, user.user_id, agreementVersion, privacyVersion]
  )

  return res.status(201).json({
    success: true,
    bound: true,
    user: userSummary(user),
    message: registration.payload?.message || '账号已创建，请前往邮箱完成验证'
  })
}

async function handleRequestPasswordReset(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const email = normalizeEmail(req.body?.email)
  if (!isOpenId(openid) || !email) {
    return res.status(400).json({ success: false, error: '请输入有效的注册邮箱' })
  }

  const rateLimit = await consumeRateLimit(req, res, {
    action: 'request_password_reset',
    limit: 3,
    windowSeconds: 60 * 60
  })
  if (!rateLimit.allowed) return

  const response = await invoke(authHandler, {
    method: 'POST',
    query: { action: 'request-password-reset' },
    body: { email },
    headers: {}
  })
  return res.status(response.statusCode).json(response.payload || {
    success: false,
    error: '密码重置服务暂时不可用'
  })
}

async function validateAccountPassword(user, password, res) {
  const passwordHash = user?.passwordHash || user?.password_hash
  if (!password || !passwordHash || !(await comparePassword(password, passwordHash))) {
    res.status(401).json({ success: false, error: '账号密码验证失败' })
    return false
  }
  return true
}

async function handleUnbind(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  if (!(await validateAccountPassword(user, String(req.body?.password || ''), res))) return

  await neonHelper.query(
    `DELETE FROM ${IDENTITY_TABLE}
      WHERE app_id = $1 AND openid = $2 AND user_id = $3`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, user.user_id]
  )
  return res.status(200).json({ success: true, message: '微信与网站账号已解除绑定' })
}

async function handleDeleteAccount(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  if (!(await validateAccountPassword(user, String(req.body?.password || ''), res))) return

  const token = generateToken({ userId: user.user_id, email: user.email })
  const response = await invoke(userProfileHandler, {
    method: 'POST',
    query: { action: 'delete_account' },
    body: {},
    headers: { authorization: `Bearer ${token}` }
  })
  return res.status(response.statusCode).json(response.payload || {
    success: false,
    error: '账号注销服务暂时不可用'
  })
}

async function handleFeedback(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const content = String(req.body?.content || '').trim().slice(0, 1000)
  if (content.length < 5) {
    return res.status(400).json({ success: false, error: '请至少输入 5 个字的问题或建议' })
  }

  const token = generateToken({ userId: user.user_id, email: user.email })
  const response = await invoke(userProfileHandler, {
    method: 'POST',
    query: { action: 'submit_feedback' },
    body: {
      content,
      contact: user.email || '',
      source: 'mini_program_launch',
      sourceUrl: 'mini://pages/account-settings/index'
    },
    headers: { authorization: `Bearer ${token}` }
  })
  return res.status(response.statusCode).json(response.payload || {
    success: false,
    error: '反馈提交失败，请稍后重试'
  })
}

async function handleEvents(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  if (!isOpenId(openid)) return res.status(400).json({ success: false, error: '事件身份无效' })
  const { user } = await getIdentityUser(openid)
  const events = (Array.isArray(req.body?.events) ? req.body.events : []).slice(0, 20)
  const anonymousId = `mini_${crypto.createHash('sha256').update(openid).digest('hex').slice(0, 24)}`

  await Promise.all(events.map((event) => trackServerAnalyticsEvent({
    eventId: String(event?.eventId || crypto.randomUUID()),
    eventName: String(event?.eventName || 'mini_unknown_event').slice(0, 80),
    properties: event?.properties && typeof event.properties === 'object' ? event.properties : {},
    url: String(event?.path || '/mini').slice(0, 240),
    sentAt: event?.sentAt || new Date().toISOString()
  }, {
    user,
    userId: user?.user_id || null,
    anonymousId,
    sourceKey: 'wechat_mini_program',
    releaseVersion: String(req.body?.releaseVersion || '').slice(0, 80)
  })))
  return res.status(202).json({ success: true, accepted: events.length })
}

async function getIdentityUser(openid) {
  const identity = await getIdentity(openid)
  const user = identity?.user_id ? await userHelper.getUserById(identity.user_id) : null
  return { identity, user }
}

async function requireBoundUser(openid, res) {
  if (!isOpenId(openid)) {
    res.status(400).json({ success: false, error: '无效的微信登录凭证' })
    return null
  }
  const { user } = await getIdentityUser(openid)
  if (!user?.user_id) {
    res.status(401).json({ success: false, code: 'ACCOUNT_BIND_REQUIRED', error: '请先绑定 Haigoo 网站账号' })
    return null
  }
  return user
}

async function handleBrowse(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobIds = [...new Set((Array.isArray(req.body?.jobIds) ? req.body.jobIds : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].slice(0, 50)
  if (!isOpenId(openid) || jobIds.length === 0) {
    return res.status(400).json({ success: false, error: '岗位浏览参数无效' })
  }

  const { user } = await getIdentityUser(openid)
  if (user && deriveMembershipCapabilities(user).isActive) {
    return res.status(200).json({
      success: true,
      allowedJobIds: jobIds,
      viewedCount: 0,
      remaining: null,
      limited: false
    })
  }

  const appId = process.env.WECHAT_MINI_APP_ID || ''
  const [existingRows, countRows] = await Promise.all([
    neonHelper.query(
      `SELECT job_id FROM ${MINI_JOB_VIEWS_TABLE}
        WHERE app_id = $1 AND openid = $2 AND job_id = ANY($3::text[])`,
      [appId, openid, jobIds]
    ),
    neonHelper.query(
      `SELECT COUNT(*)::int AS count FROM ${MINI_JOB_VIEWS_TABLE}
        WHERE app_id = $1 AND openid = $2`,
      [appId, openid]
    )
  ])
  const viewedJobIds = new Set((existingRows || []).map((row) => String(row.job_id || '')))
  const viewedCount = Math.max(0, Number(countRows?.[0]?.count || 0))
  const remainingBefore = Math.max(0, FREE_MINI_JOB_VIEW_LIMIT - viewedCount)
  const newJobIds = jobIds.filter((jobId) => !viewedJobIds.has(jobId)).slice(0, remainingBefore)
  const allowedJobIds = jobIds.filter((jobId) => viewedJobIds.has(jobId) || newJobIds.includes(jobId))

  if (newJobIds.length > 0) {
    await neonHelper.query(
      `INSERT INTO ${MINI_JOB_VIEWS_TABLE} (app_id, openid, job_id, first_viewed_at, last_viewed_at)
       SELECT $1, $2, job_id, NOW(), NOW()
         FROM UNNEST($3::text[]) AS job_id
       ON CONFLICT (app_id, openid, job_id)
       DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at`,
      [appId, openid, newJobIds]
    )
  }

  const nextViewedCount = Math.min(FREE_MINI_JOB_VIEW_LIMIT, viewedCount + newJobIds.length)
  return res.status(200).json({
    success: true,
    allowedJobIds,
    viewedCount: nextViewedCount,
    remaining: Math.max(0, FREE_MINI_JOB_VIEW_LIMIT - nextViewedCount),
    limited: nextViewedCount >= FREE_MINI_JOB_VIEW_LIMIT
  })
}

async function handleSubscriptions(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.method === 'GET' ? req.query?.openid : req.body?.openid || '').trim()
  if (!isOpenId(openid)) return res.status(400).json({ success: false, error: '无效的微信登录凭证' })

  const { user } = await getIdentityUser(openid)
  if (!user || !deriveMembershipCapabilities(user).isActive) {
    return res.status(403).json({ success: false, error: '岗位订阅仅向有效会员开放' })
  }

  if (req.method === 'POST') {
    const topics = Array.isArray(req.body?.topics) ? req.body.topics : []
    const customTopics = Array.isArray(req.body?.customTopics) ? req.body.customTopics : []
    const subscription = await subscriptionsService.upsertForUser(user, {
      topics,
      customTopics,
      status: 'active'
    })
    return res.status(200).json({ success: true, subscription })
  }

  const subscriptions = await subscriptionsService.getForUser(user)
  const activeSubscriptionIds = (subscriptions || [])
    .filter((subscription) => String(subscription.status || 'active') === 'active')
    .map((subscription) => String(subscription.subscription_id || '').trim())
    .filter(Boolean)
  let jobIds = []
  if (activeSubscriptionIds.length > 0) {
    const rows = await neonHelper.query(
      `SELECT job_id, MAX(created_at) AS delivered_at
         FROM subscription_digest_items
        WHERE user_id = $1 OR subscription_id = ANY($2::text[])
        GROUP BY job_id
        ORDER BY delivered_at DESC
        LIMIT 18`,
      [user.user_id, activeSubscriptionIds]
    )
    jobIds = (rows || []).map((row) => String(row.job_id || '').trim()).filter(Boolean)
  }
  return res.status(200).json({ success: true, subscriptions: subscriptions || [], jobIds })
}

async function handleFavorites(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.method === 'GET' ? req.query?.openid : req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return

  if (req.method === 'POST') {
    const jobId = String(req.body?.jobId || '').trim()
    const favorite = req.body?.favorite !== false
    if (!jobId) return res.status(400).json({ success: false, error: '岗位参数无效' })

    if (!favorite) {
      await neonHelper.query(
        `DELETE FROM ${FAVORITES_TABLE} WHERE user_id = $1 AND job_id = $2`,
        [user.user_id, jobId]
      )
      return res.status(200).json({ success: true, jobId, favorite: false })
    }

    const job = await getJob(jobId)
    await neonHelper.query(
      `INSERT INTO ${FAVORITES_TABLE} (
          user_id, job_id, job_title_snapshot, company_name_snapshot, created_at
       ) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, job_id) DO NOTHING`,
      [user.user_id, jobId, job?.title || '', job?.company || '']
    )
    return res.status(200).json({ success: true, jobId, favorite: true })
  }

  const rows = await neonHelper.query(
    `SELECT job_id, created_at
       FROM ${FAVORITES_TABLE}
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 year'
      ORDER BY created_at DESC`,
    [user.user_id]
  )
  return res.status(200).json({
    success: true,
    favorites: (rows || []).map((row) => ({
      jobId: String(row.job_id || ''),
      createdAt: row.created_at || null
    })).filter((item) => item.jobId)
  })
}

async function handleApplications(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return

  const rows = await neonHelper.query(
    `SELECT uji.id, uji.job_id, uji.interaction_type, uji.status, uji.notes,
            uji.application_source, uji.updated_at,
            COALESCE(j.title, uji.job_title_snapshot, '职位已失效') AS job_title,
            COALESCE(j.company, uji.company_name_snapshot, '未知企业') AS company
       FROM user_job_interactions uji
       LEFT JOIN jobs j ON j.job_id = uji.job_id
      WHERE uji.user_id = $1
        AND uji.interaction_type IN ('apply', 'referral', 'apply_redirect', 'pending_apply', 'email')
      ORDER BY uji.updated_at DESC`,
    [user.user_id]
  )
  return res.status(200).json({
    success: true,
    applications: (rows || []).map((row) => ({
      id: row.id,
      jobId: String(row.job_id || ''),
      interactionType: row.interaction_type,
      status: row.status || 'entry_opened',
      notes: row.notes || '',
      jobTitle: row.job_title || '职位已失效',
      company: row.company || '未知企业',
      applicationSource: row.application_source || null,
      updatedAt: row.updated_at || null
    })).filter((item) => item.jobId)
  })
}

async function getJob(jobId) {
  const jobs = await readJobsFromNeon({ id: jobId, sortBy: 'recent' }, { page: 1, limit: 1 })
  return jobs?.[0] || null
}

async function recordApplicationInteraction(user, job, type) {
  const interactionType = type === 'website' ? 'apply_redirect' : type === 'email' ? 'email' : 'referral'
  await neonHelper.query(
    `INSERT INTO user_job_interactions (
        user_id, job_id, interaction_type, notes, application_source, updated_at,
        job_title_snapshot, company_name_snapshot, status
     ) VALUES ($1, $2, $3, '', $4, NOW(), $5, $6, 'entry_opened')
     ON CONFLICT (user_id, job_id, interaction_type)
     DO UPDATE SET
       updated_at = NOW(),
       application_source = EXCLUDED.application_source,
       job_title_snapshot = COALESCE(EXCLUDED.job_title_snapshot, user_job_interactions.job_title_snapshot),
       company_name_snapshot = COALESCE(EXCLUDED.company_name_snapshot, user_job_interactions.company_name_snapshot),
       status = CASE
         WHEN user_job_interactions.status = 'applied' THEN 'applied'
         ELSE 'entry_opened'
       END`,
    [user.user_id, job.id || job.jobId, interactionType, type, job.title || '', job.company || '']
  )
}

async function consumeUsage(user, type, body) {
  const token = generateToken({ userId: user.user_id, email: user.email })
  const response = await invoke(freeUsageHandler, {
    method: 'POST',
    url: `/api/users?resource=free-usage&type=${encodeURIComponent(type)}`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body
  })
  return response
}

async function handleApplication(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobId = String(req.body?.jobId || '').trim()
  const type = String(req.body?.type || '').trim()
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim()
  if (!isOpenId(openid) || !jobId || !['website', 'email', 'referral'].includes(type)) {
    return res.status(400).json({ success: false, error: '申请参数无效' })
  }

  const identity = await getIdentity(openid)
  const user = identity?.user_id ? await userHelper.getUserById(identity.user_id) : null
  if (!user) return res.status(401).json({ success: false, code: 'ACCOUNT_BIND_REQUIRED', error: '请先绑定 Haigoo 网站账号' })

  const job = await getJob(jobId)
  if (!job) return res.status(404).json({ success: false, error: '岗位不存在或已下线' })
  if (job.memberOnly && !deriveMembershipCapabilities(user).isActive) {
    return res.status(403).json({ success: false, code: 'MEMBER_REQUIRED', error: '该岗位仅向 Club 会员开放' })
  }

  const claim = await claimIdempotencyKey(openid, 'application', idempotencyKey)
  if (!claim.claimed) {
    const previous = await readIdempotentResult(openid, 'application', idempotencyKey)
    if (previous?.response_body) {
      return res.status(Number(previous.response_status || 200)).json(previous.response_body)
    }
    return res.status(409).json({
      success: false,
      code: 'REQUEST_IN_PROGRESS',
      error: '申请入口正在处理中，请勿重复点击'
    })
  }

  const usageType = type === 'website' ? 'website-apply' : type === 'email' ? 'email-apply' : 'referral'
  const usage = await consumeUsage(user, usageType, {
    jobId,
    companyName: job.company,
    page_key: 'mini_job_detail',
    source_key: `mini_job_${usageType}`,
    entity_type: type === 'email' ? 'company' : 'job',
    entity_id: type === 'email' ? job.company : jobId,
    flow_id: `mini_${usageType}_${jobId}`
  })
  if (usage.statusCode < 200 || usage.statusCode >= 300) {
    if (claim.enabled) {
      await neonHelper.query(
        `DELETE FROM ${IDEMPOTENCY_TABLE}
          WHERE app_id = $1 AND openid = $2 AND action = 'application' AND idempotency_key = $3`,
        [process.env.WECHAT_MINI_APP_ID || '', openid, idempotencyKey]
      )
    }
    return res.status(usage.statusCode).json(usage.payload || { success: false, error: '申请服务暂不可用' })
  }

  await recordApplicationInteraction(user, job, type)

  if (type === 'website') {
    const payload = { success: true, type, applicationStatus: 'entry_opened', websiteUrl: job.url || job.sourceUrl || '', usage: usage.payload }
    await saveIdempotentResult(openid, 'application', idempotencyKey, 200, payload)
    return res.status(200).json(payload)
  }
  if (type === 'email') {
    const payload = { success: true, type, applicationStatus: 'entry_opened', hiringEmail: job.hiringEmail || '', emailType: job.emailType || '', usage: usage.payload }
    await saveIdempotentResult(openid, 'application', idempotencyKey, 200, payload)
    return res.status(200).json(payload)
  }
  const payload = {
    success: true,
    type,
    applicationStatus: 'entry_opened',
    websiteUrl: `${process.env.PUBLIC_APP_ORIGIN || 'https://haigooremote.com'}/jobs?jobId=${encodeURIComponent(jobId)}`,
    usage: usage.payload
  }
  await saveIdempotentResult(openid, 'application', idempotencyKey, 200, payload)
  return res.status(200).json(payload)
}

async function handleApplicationStatus(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobId = String(req.body?.jobId || '').trim()
  const type = String(req.body?.type || '').trim()
  const status = String(req.body?.status || '').trim()
  if (!isOpenId(openid) || !jobId || !['website', 'email', 'referral'].includes(type) || status !== 'applied') {
    return res.status(400).json({ success: false, error: '申请状态参数无效' })
  }
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const interactionType = type === 'website' ? 'apply_redirect' : type === 'email' ? 'email' : 'referral'
  const rows = await neonHelper.query(
    `UPDATE user_job_interactions
        SET status = 'applied', updated_at = NOW()
      WHERE user_id = $1 AND job_id = $2 AND interaction_type = $3
      RETURNING id`,
    [user.user_id, jobId, interactionType]
  )
  if (!rows?.[0]) {
    return res.status(404).json({ success: false, error: '请先打开申请入口' })
  }
  return res.status(200).json({ success: true, jobId, type, status: 'applied' })
}

async function handleSync(req, res) {
  const cursor = String(req.query?.cursor || '').trim()
  const page = Math.max(1, Number(req.query?.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 100))
  const id = String(req.query?.id || '').trim()
  const search = String(req.query?.search || '').trim()
  const category = String(req.query?.category || '').trim()
  const isFeatured = String(req.query?.featured || '').trim()
  const requestedSort = String(req.query?.sortBy || '').trim()
  if (!ensureDatabase(res)) return
  const query = {
    sortBy: requestedSort === 'default' ? undefined : requestedSort || 'recent',
    ...(cursor ? { updatedSince: cursor } : {}),
    ...(id ? { id } : {}),
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    ...(isFeatured === 'true' ? { isFeatured: 'true' } : {})
  }
  const [jobs, total] = await Promise.all([
    readJobsFromNeon(query, { page, limit }),
    countJobsFromNeon(query)
  ])
  const newestCursor = jobs.reduce((latest, job) => {
    const value = String(job?.updatedAt || job?.updated_at || latest || '')
    return value > latest ? value : latest
  }, cursor)
  return res.status(200).json({
    success: true,
    jobs,
    total: Number(total || 0),
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / limit)),
    nextCursor: newestCursor || null,
    hasMore: page < Math.max(1, Math.ceil(Number(total || 0) / limit))
  })
}

export default async function miniGatewayHandler(req, res) {
  const action = String(req.query?.action || '').trim()
  if (![
    'session', 'bind', 'register', 'request_password_reset', 'unbind_wechat', 'delete_account',
    'feedback', 'events', 'browse', 'subscriptions', 'favorites', 'applications',
    'application', 'application_status', 'sync'
  ].includes(action)) {
    return res.status(404).json({ success: false, error: 'Unknown mini gateway action' })
  }
  if (!hasGatewaySignature(req, action)) {
    return res.status(401).json({ success: false, error: 'Unauthorized gateway request' })
  }

  try {
    if (action === 'session' && req.method === 'POST') return await handleSession(req, res)
    if (action === 'bind' && req.method === 'POST') return await handleBind(req, res)
    if (action === 'register' && req.method === 'POST') return await handleRegister(req, res)
    if (action === 'request_password_reset' && req.method === 'POST') return await handleRequestPasswordReset(req, res)
    if (action === 'unbind_wechat' && req.method === 'POST') return await handleUnbind(req, res)
    if (action === 'delete_account' && req.method === 'POST') return await handleDeleteAccount(req, res)
    if (action === 'feedback' && req.method === 'POST') return await handleFeedback(req, res)
    if (action === 'events' && req.method === 'POST') return await handleEvents(req, res)
    if (action === 'browse' && req.method === 'POST') return await handleBrowse(req, res)
    if (action === 'subscriptions' && ['GET', 'POST'].includes(req.method)) return await handleSubscriptions(req, res)
    if (action === 'favorites' && ['GET', 'POST'].includes(req.method)) return await handleFavorites(req, res)
    if (action === 'applications' && req.method === 'GET') return await handleApplications(req, res)
    if (action === 'application' && req.method === 'POST') return await handleApplication(req, res)
    if (action === 'application_status' && req.method === 'POST') return await handleApplicationStatus(req, res)
    if (action === 'sync' && req.method === 'GET') return await handleSync(req, res)
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[mini-gateway] request failed', error)
    const statusCode = Number(error?.statusCode || error?.status || 500)
    return res.status(statusCode >= 400 && statusCode <= 599 ? statusCode : 500).json({
      success: false,
      error: statusCode === 503 ? '上游服务暂时不可用，请稍后重试' : '小程序服务暂时不可用'
    })
  }
}

export { gatewaySecrets, hasGatewaySignature, requestSignature, stableJson }
