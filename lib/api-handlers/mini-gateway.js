import crypto from 'crypto'
import { comparePassword, generateToken, sanitizeUser } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities, getMembershipPlans } from '../shared/membership.js'
import { systemSettingsService } from '../services/system-settings-service.js'
import { subscriptionsService } from '../services/subscriptions-service.js'
import { countJobsFromNeon, readJobsFromNeon } from './processed-jobs.js'
import freeUsageHandler from './free-usage.js'
import authHandler from '../../api/auth.js'
import userProfileHandler from './user-profile.js'
import { trackServerAnalyticsEvent } from '../services/analytics-event-service.js'
import { wechatVirtualPaymentService } from '../services/wechat-virtual-payment-service.js'
import { parseCareerResumeBuffer, CAREER_RESUME_MAX_BYTES } from '../services/career-resume-parser.js'
import {
  careerCompleteness,
  rankCareerCompanies,
  redactCareerText,
  retentionExpiry,
  userCareerResult
} from '../services/mini-career-match-service.js'
import {
  buildDeterministicCareerResult,
  buildStructuredCareerProfile,
  createApplyTicket,
  getTransientMatchRecommendations,
  getMatchFeed,
  listCompanyFollows,
  markMatchUpdatesRead,
  recordMatchFeedback,
  setCompanyFollow,
  setFollowNotifications
} from '../services/mini-company-match-service.js'

const IDENTITY_TABLE = 'mini_wechat_identities'
const FAVORITES_TABLE = 'favorites'
const RATE_LIMIT_TABLE = 'mini_rate_limits'
const CONSENTS_TABLE = 'mini_account_consents'
const IDEMPOTENCY_TABLE = 'mini_idempotency_keys'
const CONSULTATIONS_TABLE = 'member_crm_consultation_requests'
const LEARNING_AUDIO_TABLE = 'corporate_learning_audio_assets'
const CAREER_PROFILES_TABLE = 'mini_career_profiles'
const CAREER_RUNS_TABLE = 'mini_career_assessment_runs'
const CAREER_ENTITLEMENTS_TABLE = 'mini_career_entitlements'
const CAREER_PRIVACY_EVENTS_TABLE = 'mini_career_privacy_events'
const CAREER_PRIVACY_VERSION = '2026-08-14-match-v1'
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const FREE_MINI_JOB_VIEW_LIMIT = 100
const AGREEMENT_VERSION = '2026-07-29'
const PRIVACY_VERSION = '2026-07-29'

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

function scopedGatewaySecrets(action) {
  return [
    ...gatewaySecrets(),
    ...(action === 'sync' && process.env.MINI_GATEWAY_READONLY_SECRET
      ? [process.env.MINI_GATEWAY_READONLY_SECRET]
      : [])
  ]
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
  const secrets = scopedGatewaySecrets(action)
  if (!secrets.length || !Number.isFinite(timestampMs)) return false
  if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false

  const isGet = String(req.method || '').toUpperCase() === 'GET'
  const signedQuery = Object.fromEntries(Object.entries(req.query || {}).filter(([key]) => key !== 'action'))
  const signaturePayloads = isGet ? [signedQuery] : [req.body || {}]
  return secrets.some((secret) => signaturePayloads.some((signaturePayload) => {
    const expected = requestSignature(req.method, action, timestamp, signaturePayload, secret)
    return Boolean(expected)
      && received.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  }))
}

function normalizeEventId(value) {
  const input = String(value || '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) {
    return input.toLowerCase()
  }
  const hex = crypto.createHash('sha256').update(input || crypto.randomUUID()).digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function normalizeJobSnapshot(value, expectedId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = String(value.id || value.jobId || '').trim()
  if (!id || id !== String(expectedId || '').trim()) return null
  const safeUrl = (input) => {
    const url = String(input || '').trim().slice(0, 2048)
    return /^https?:\/\//i.test(url) ? url : ''
  }
  const hiringEmail = String(value.hiringEmail || '').trim().slice(0, 320)
  return {
    id,
    title: String(value.title || '').trim().slice(0, 255),
    company: String(value.company || '').trim().slice(0, 255),
    memberOnly: value.memberOnly === true,
    url: safeUrl(value.url),
    sourceUrl: safeUrl(value.sourceUrl),
    hiringEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hiringEmail) ? hiringEmail : '',
    emailType: String(value.emailType || '').trim().slice(0, 50)
  }
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
  await neonHelper.query(
    `DELETE FROM ${RATE_LIMIT_TABLE}
      WHERE updated_at < NOW() - INTERVAL '2 days'`
  )
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
  await neonHelper.query(
    `DELETE FROM ${IDEMPOTENCY_TABLE} WHERE expires_at <= NOW()`
  )
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

async function releaseIdempotencyKey(openid, action, idempotencyKey) {
  if (!isIdempotencyKey(idempotencyKey)) return
  await neonHelper.query(
    `DELETE FROM ${IDEMPOTENCY_TABLE}
      WHERE app_id = $1 AND openid = $2 AND action = $3 AND idempotency_key = $4`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, action, idempotencyKey]
  )
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

async function respondWithIdempotency(res, { openid, action, idempotencyKey }, operation) {
  const claim = await claimIdempotencyKey(openid, action, idempotencyKey)
  if (!claim.claimed) {
    const previous = await readIdempotentResult(openid, action, idempotencyKey)
    if (previous?.response_body) {
      return res.status(Number(previous.response_status || 200)).json(previous.response_body)
    }
    return res.status(409).json({
      success: false,
      code: 'REQUEST_IN_PROGRESS',
      error: '请求正在处理中，请勿重复提交'
    })
  }

  try {
    const result = await operation()
    const status = Number(result?.status || 200)
    const payload = result?.payload || { success: true }
    await saveIdempotentResult(openid, action, idempotencyKey, status, payload)
    return res.status(status).json(payload)
  } catch (error) {
    if (claim.enabled) await releaseIdempotencyKey(openid, action, idempotencyKey)
    throw error
  }
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
  res.status(503).json({ success: false, error: 'Club 权益服务暂不可用，请稍后重试' })
  return false
}

function userSummary(user) {
  const safeUser = sanitizeUser(user)
  const capabilities = deriveMembershipCapabilities(user)
  return {
    userId: safeUser?.userId || null,
    username: safeUser?.username || '',
    avatar: safeUser?.avatar || '',
    email: safeUser?.email || '',
    memberType: safeUser?.memberType || 'none',
    isMember: Boolean(capabilities.isActive),
    memberTier: capabilities.memberTier,
    memberExpireAt: safeUser?.memberExpireAt || user?.member_expire_at || null
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
    return res.status(400).json({ success: false, error: '请输入 Haigoo 账号和密码' })
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
  if (user.status !== 'active') return res.status(403).json({ success: false, error: '账号已停用' })

  const identity = await getIdentity(openid)
  if (identity?.user_id && identity.user_id !== user.user_id) {
    return res.status(409).json({ success: false, error: '该微信已绑定其他 Haigoo 账号' })
  }

  const appId = process.env.WECHAT_MINI_APP_ID || ''
  const userIdentityRows = await neonHelper.query(
    `SELECT openid
       FROM ${IDENTITY_TABLE}
      WHERE app_id = $1 AND user_id = $2
      LIMIT 1`,
    [appId, user.user_id]
  )
  if (userIdentityRows?.[0]?.openid && userIdentityRows[0].openid !== openid) {
    return res.status(409).json({ success: false, error: '该 Haigoo 账号已连接其他微信，请先解除原有连接' })
  }

  try {
    await neonHelper.query(
      `INSERT INTO ${IDENTITY_TABLE} (app_id, openid, user_id, created_at, linked_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (app_id, openid)
       DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = NOW()`,
      [appId, openid, user.user_id]
    )
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: '微信或 Haigoo 账号已连接其他账号，请刷新后重试' })
    }
    throw error
  }

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
    headers: {},
    trustedMiniGateway: true
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
  try {
    await neonHelper.query(
      `WITH linked_identity AS (
         INSERT INTO ${IDENTITY_TABLE} (app_id, openid, user_id, created_at, linked_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (app_id, openid)
         DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = NOW()
         RETURNING user_id
       )
       INSERT INTO ${CONSENTS_TABLE} (
          app_id, openid, user_id, agreement_version, privacy_version, accepted_at, created_at
       )
       SELECT $1, $2, user_id, $4, $5, NOW(), NOW()
         FROM linked_identity
       ON CONFLICT (app_id, openid, agreement_version, privacy_version)
       DO UPDATE SET user_id = EXCLUDED.user_id, accepted_at = NOW()`,
      [appId, openid, user.user_id, agreementVersion, privacyVersion]
    )
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        error: '账号已创建，但暂时无法连接当前微信，请联系客服'
      })
    }
    throw error
  }

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

  const genericPayload = {
    success: true,
    message: '如果该邮箱已注册，重置邮件将发送到您的邮箱'
  }
  try {
    const response = await invoke(authHandler, {
      method: 'POST',
      query: { action: 'request-password-reset' },
      body: { email },
      headers: {},
      trustedMiniGateway: true
    })
    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error('[mini-gateway] password reset dispatch failed', { statusCode: response.statusCode })
    }
  } catch (error) {
    console.error('[mini-gateway] password reset dispatch failed', error)
  }
  return res.status(200).json(genericPayload)
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
  const rateLimit = await consumeRateLimit(req, res, {
    action: 'unbind_wechat',
    limit: 5,
    windowSeconds: 15 * 60
  })
  if (!rateLimit.allowed) return
  if (!(await validateAccountPassword(user, String(req.body?.password || ''), res))) return

  await neonHelper.query(
    `DELETE FROM ${IDENTITY_TABLE}
      WHERE app_id = $1 AND openid = $2 AND user_id = $3`,
    [process.env.WECHAT_MINI_APP_ID || '', openid, user.user_id]
  )
  await clearRateLimit(rateLimit.keyHashes, 'unbind_wechat')
  return res.status(200).json({ success: true, message: '微信与 Haigoo 账号已解除连接' })
}

async function handleDeleteAccount(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const rateLimit = await consumeRateLimit(req, res, {
    action: 'delete_account',
    limit: 5,
    windowSeconds: 15 * 60
  })
  if (!rateLimit.allowed) return
  if (!(await validateAccountPassword(user, String(req.body?.password || ''), res))) return

  const token = generateToken({ userId: user.user_id, email: user.email })
  const response = await invoke(userProfileHandler, {
    method: 'POST',
    query: { action: 'delete_account' },
    body: {},
    headers: { authorization: `Bearer ${token}` }
  })
  if (response.statusCode >= 200 && response.statusCode < 300) {
    await clearRateLimit(rateLimit.keyHashes, 'delete_account')
  }
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
    eventId: normalizeEventId(event?.eventId),
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
    res.status(401).json({ success: false, code: 'ACCOUNT_BIND_REQUIRED', error: '请先连接 Haigoo 账号' })
    return null
  }
  return user
}

function miniViewer(user) {
  const capabilities = deriveMembershipCapabilities(user)
  return {
    bound: Boolean(user?.user_id),
    user: user ? userSummary(user) : null,
    capabilities,
    hasCompanyDirectoryAccess: Boolean(capabilities.canAccessTrustedCompaniesPage),
    hasGrowthAccess: Boolean(capabilities.canAccessCorporateEnglishVideos)
  }
}

async function resolveMiniViewer(openid) {
  if (!isOpenId(openid)) return miniViewer(null)
  const { user } = await getIdentityUser(openid)
  return miniViewer(user)
}

function safeJsonArray(value) {
  return Array.isArray(value) ? value : []
}

function safeCloudFileId(value) {
  const fileId = String(value || '').trim()
  return /^cloud:\/\/[A-Za-z0-9_.@\/-]+$/.test(fileId) ? fileId : ''
}

function safeCompanyLogoSource(value, companyId) {
  const source = String(value || '').trim()
  if (!source.startsWith('/api/company-assets?')) return ''
  try {
    const parsed = new URL(source, 'https://haigoo.invalid')
    if (parsed.pathname !== '/api/company-assets') return ''
    if (parsed.searchParams.get('companyId') !== String(companyId || '')) return ''
    if (!['', 'logo'].includes(parsed.searchParams.get('type') || '')) return ''
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return ''
  }
}

function mapMiniCompany(row) {
  const rating = Number.parseFloat(String(row.company_rating || ''))
  const companyId = String(row.company_id || '')
  const siteOrigin = String(process.env.MINI_PUBLIC_SITE_ORIGIN || 'https://www.haigooremote.com').replace(/\/+$/, '')
  return {
    id: companyId,
    name: String(row.name || ''),
    description: String(row.description || '').trim(),
    industry: String(row.industry || '').trim() || '其他',
    tags: safeJsonArray(row.tags).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
    specialties: safeJsonArray(row.specialties).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
    address: String(row.address || '').trim(),
    employeeCount: String(row.employee_count || '').trim(),
    foundedYear: String(row.founded_year || '').trim(),
    rating: Number.isFinite(rating) ? rating : null,
    logoFileId: safeCloudFileId(row.cached_logo_url),
    _logoSourcePath: safeCompanyLogoSource(row.cached_logo_url, companyId),
    updatedAt: row.updated_at || null,
    websiteUrl: companyId ? `${siteOrigin}/company/${encodeURIComponent(companyId)}` : '',
    hasPublicOpportunity: Boolean(row.has_public_opportunity),
    publicOpportunityUpdatedAt: row.public_opportunity_updated_at || null
  }
}

function mapMiniNote(row, canAccessPaidContent, { detail = false } = {}) {
  const accessTier = String(row.access_tier || 'vip') === 'free' ? 'free' : 'vip'
  const unlocked = accessTier === 'free' || canAccessPaidContent
  const noteId = String(row.note_id || row.video_id || '')
  const originType = String(row.origin_type || 'video')
  const coverOwnerType = originType === 'video' ? 'module_video' : 'growth_note'
  const coverOwnerId = originType === 'video' ? String(row.source_video_id || row.video_id || '') : noteId
  const note = {
    id: noteId,
    title: String(row.original_title || row.title || ''),
    titleZh: String(row.title || '').trim(),
    summary: String(row.summary || '').trim(),
    originType,
    authorName: String(row.author_name || '').trim(),
    sourceName: String(row.source_name || '').trim(),
    category: String(row.category || '').trim() || '远程职业准备',
    difficulty: String(row.difficulty_level || '').trim(),
    tags: safeJsonArray(row.tags).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
    accessTier,
    unlocked,
    isFeatured: Boolean(row.is_featured),
    publishedAt: row.published_at || null,
    durationMinutes: row.reading_minutes ? Math.max(1, Number(row.reading_minutes)) : null,
    updatedAt: row.updated_at || null,
    coverAspectRatio: row.cover_image_width && row.cover_image_height
      ? Number(row.cover_image_width) / Number(row.cover_image_height)
      : null,
    _coverSourcePath: row.cover_image_hash && coverOwnerId
      ? `/api/corporate-english-public?resource=cover-image&ownerType=${coverOwnerType}&ownerId=${encodeURIComponent(coverOwnerId)}&variant=thumb&v=${encodeURIComponent(String(row.cover_image_hash).slice(0, 16))}`
      : ''
  }
  if (!detail || !unlocked) return note
  return {
    ...note,
    sourceUrl: String(row.source_url || '').trim(),
    notes: safeJsonArray(row.content_blocks || row.video_notes),
    audio: safeCloudFileId(row.audio_file_id)
      ? {
          fileId: safeCloudFileId(row.audio_file_id),
          durationSeconds: Number(row.audio_duration_seconds || 0) || null
        }
      : null
  }
}

function miniPlanFeatures(memberType) {
  const base = ['全部职业笔记', '全部远程企业资料']
  if (memberType === 'half_year') return [...base, '职业方向咨询', '一对一语音咨询']
  if (memberType === 'annual') return [...base, '年度职业规划', '会员交流与长期支持']
  return [...base, '职业准备内容持续更新']
}

function miniPlanDescription(memberType) {
  if (memberType === 'half_year') return '适合正在准备远程求职，希望获得持续内容与咨询支持的人。'
  if (memberType === 'annual') return '适合长期规划远程职业方向，希望持续获得内容与顾问支持的人。'
  return '适合刚开始了解远程工作，希望系统阅读企业与职业内容的人。'
}

function mapMiniPlan(plan) {
  return {
    id: String(plan.id || ''),
    memberType: String(plan.memberType || ''),
    name: String(plan.name || ''),
    shortLabel: String(plan.shortLabel || plan.name || ''),
    price: Number(plan.price || 0),
    currency: String(plan.currency || 'CNY'),
    durationDays: Number(plan.duration_days || 0),
    durationMonths: Number(plan.duration_months || 0),
    description: miniPlanDescription(plan.memberType),
    featured: plan.memberType === 'half_year',
    features: miniPlanFeatures(plan.memberType)
  }
}

async function readMiniCompanies({ viewer, search = '', industry = '', page = 1, pageSize = 20, featured = false }) {
  const hasFullAccess = viewer.hasCompanyDirectoryAccess
  const normalizedSearch = String(search || '').trim().slice(0, 80)
  const normalizedIndustry = String(industry || '').trim().slice(0, 80)
  const effectivePage = hasFullAccess ? Math.max(1, Number(page) || 1) : 1
  const effectivePageSize = hasFullAccess
    ? Math.min(50, Math.max(1, Number(pageSize) || 20))
    : featured ? 6 : 12
  const filters = ["status = 'active'"]
  const params = []
  if (hasFullAccess && normalizedSearch) {
    params.push(`%${normalizedSearch}%`)
    filters.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length} OR industry ILIKE $${params.length})`)
  }
  if (hasFullAccess && normalizedIndustry) {
    params.push(normalizedIndustry)
    filters.push(`industry = $${params.length}`)
  }
  const where = filters.join(' AND ')
  const offset = (effectivePage - 1) * effectivePageSize
  const [rows, countRows, industryRows] = await Promise.all([
    neonHelper.query(
      `SELECT company_id, name, description, industry, tags, specialties, address,
              employee_count, founded_year, company_rating, cached_logo_url, updated_at
         FROM trusted_companies
        WHERE ${where}
        ORDER BY CASE WHEN company_rating ~ '^[0-9]+([.][0-9]+)?$' THEN company_rating::numeric ELSE 0 END DESC,
                 updated_at DESC NULLS LAST, name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, effectivePageSize, offset]
    ),
    neonHelper.query(`SELECT COUNT(*)::int AS count FROM trusted_companies WHERE ${where}`, params),
    hasFullAccess
      ? neonHelper.query(
          `SELECT industry, COUNT(*)::int AS count
             FROM trusted_companies
            WHERE status = 'active' AND COALESCE(industry, '') <> ''
            GROUP BY industry ORDER BY count DESC, industry ASC LIMIT 24`
        )
      : Promise.resolve([])
  ])
  const total = Number(countRows?.[0]?.count || 0)
  return {
    companies: (rows || []).map(mapMiniCompany),
    total,
    page: effectivePage,
    pageSize: effectivePageSize,
    hasMore: hasFullAccess && effectivePage * effectivePageSize < total,
    access: {
      fullDirectory: hasFullAccess,
      previewLimit: hasFullAccess ? null : 12,
      searchEnabled: hasFullAccess
    },
    industries: (industryRows || []).map((row) => ({ name: row.industry, count: Number(row.count || 0) }))
  }
}

async function readMiniNotes({ viewer, limit = 20, featured = false }) {
  const rows = await neonHelper.query(
    `SELECT n.*,
            COALESCE(n.cover_image_hash, v.cover_image_hash) AS cover_image_hash,
            COALESCE(n.cover_image_width, v.cover_image_width) AS cover_image_width,
            COALESCE(n.cover_image_height, v.cover_image_height) AS cover_image_height,
            GREATEST(1, CEIL(LENGTH(n.content_blocks::text) / 500.0))::int AS reading_minutes
       FROM career_growth_notes n
       LEFT JOIN corporate_english_module_videos v ON v.video_id = n.source_video_id
      WHERE n.status = 'published'
        AND jsonb_typeof(n.content_blocks) = 'array'
        AND jsonb_array_length(n.content_blocks) > 0
      ORDER BY ${featured ? 'n.is_featured DESC,' : ''} n.sort_order ASC, n.published_at DESC
      LIMIT $1`,
    [Math.min(50, Math.max(1, Number(limit) || 20))]
  )
  return (rows || []).map((row) => mapMiniNote(row, viewer.hasGrowthAccess))
}

async function handleMiniHome(req, res) {
  if (!ensureDatabase(res)) return
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const [companyResult, notesResult] = await Promise.all([
    readMiniCompanies({ viewer, featured: true }),
    readMiniNotes({ viewer, featured: true, limit: 3 }).catch((error) => {
      console.error('[mini-gateway] home notes unavailable', error)
      return []
    })
  ])
  return res.status(200).json({
    success: true,
    companies: companyResult.companies,
    notes: notesResult,
    membership: viewer.user || { isMember: false, memberType: 'none', memberTier: 'none', memberExpireAt: null },
    consultation: { enabled: true, requiresBinding: true, topics: ['career_direction', 'resume', 'remote_search', 'interview', 'membership', 'other'] }
  })
}

async function handleMiniCompanies(req, res) {
  if (!ensureDatabase(res)) return
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const result = await readMiniCompanies({
    viewer,
    search: req.query?.search,
    industry: req.query?.industry,
    page: req.query?.page,
    pageSize: req.query?.pageSize
  })
  return res.status(200).json({ success: true, ...result })
}

async function handleMiniCompany(req, res) {
  if (!ensureDatabase(res)) return
  const companyId = String(req.query?.id || '').trim()
  if (!/^[A-Za-z0-9._:-]{1,255}$/.test(companyId)) {
    return res.status(400).json({ success: false, error: '企业参数无效' })
  }
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const rows = await neonHelper.query(
    `WITH preview AS (
       SELECT company_id
         FROM trusted_companies
        WHERE status = 'active'
        ORDER BY CASE WHEN company_rating ~ '^[0-9]+([.][0-9]+)?$' THEN company_rating::numeric ELSE 0 END DESC,
                 updated_at DESC NULLS LAST, name ASC
        LIMIT 12
     )
     SELECT tc.company_id, tc.name, tc.description, tc.industry, tc.tags, tc.specialties,
            tc.address, tc.employee_count, tc.founded_year, tc.company_rating,
            tc.cached_logo_url, tc.updated_at,
            EXISTS (
              SELECT 1 FROM jobs j
               WHERE (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(BTRIM(j.company)) = LOWER(BTRIM(tc.name))))
                 AND j.status = 'active' AND j.is_approved = TRUE AND NULLIF(BTRIM(j.url), '') IS NOT NULL
            ) AS has_public_opportunity,
            (
              SELECT MAX(j.updated_at) FROM jobs j
               WHERE (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(BTRIM(j.company)) = LOWER(BTRIM(tc.name))))
                 AND j.status = 'active' AND j.is_approved = TRUE AND NULLIF(BTRIM(j.url), '') IS NOT NULL
            ) AS public_opportunity_updated_at,
            cp.culture_sections, cp.ceo_thinking_sections, cp.access_tier AS profile_access_tier
       FROM trusted_companies tc
       LEFT JOIN corporate_english_company_profiles cp
         ON cp.company_id = tc.company_id AND cp.status = 'published'
      WHERE tc.status = 'active' AND tc.company_id = $1
        AND ($2::boolean = TRUE OR EXISTS (SELECT 1 FROM preview WHERE preview.company_id = tc.company_id))
      LIMIT 1`,
    [companyId, viewer.hasCompanyDirectoryAccess]
  )
  const row = rows?.[0]
  if (!row) return res.status(404).json({ success: false, error: '企业不存在或当前账户无权查看' })
  const profileUnlocked = String(row.profile_access_tier || 'free') === 'free' || viewer.hasGrowthAccess
  const company = {
    ...mapMiniCompany(row),
    remoteWork: safeJsonArray(row.specialties),
    culture: profileUnlocked ? safeJsonArray(row.culture_sections) : [],
    ceoInsights: profileUnlocked ? safeJsonArray(row.ceo_thinking_sections) : [],
    insightsLocked: Boolean(row.profile_access_tier && !profileUnlocked)
  }
  return res.status(200).json({ success: true, company, access: { fullDirectory: viewer.hasCompanyDirectoryAccess } })
}

async function handleMiniGrowthNotes(req, res) {
  if (!ensureDatabase(res)) return
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const notes = await readMiniNotes({ viewer, limit: req.query?.pageSize || 50 })
  return res.status(200).json({ success: true, notes, total: notes.length, access: { paidContent: viewer.hasGrowthAccess } })
}

async function handleMiniGrowthNote(req, res) {
  if (!ensureDatabase(res)) return
  const noteId = String(req.query?.id || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(noteId)) return res.status(400).json({ success: false, error: '笔记参数无效' })
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const rows = await neonHelper.query(
    `SELECT n.*,
            COALESCE(n.cover_image_hash, v.cover_image_hash) AS cover_image_hash,
            COALESCE(n.cover_image_width, v.cover_image_width) AS cover_image_width,
            COALESCE(n.cover_image_height, v.cover_image_height) AS cover_image_height,
            GREATEST(1, CEIL(LENGTH(n.content_blocks::text) / 500.0))::int AS reading_minutes,
            audio.cloud_file_id AS audio_file_id, audio.duration_seconds AS audio_duration_seconds
       FROM career_growth_notes n
       LEFT JOIN corporate_english_module_videos v ON v.video_id = n.source_video_id
       LEFT JOIN LATERAL (
         SELECT cloud_file_id, duration_seconds
           FROM ${LEARNING_AUDIO_TABLE}
          WHERE video_id = n.source_video_id
            AND status = 'published'
            AND rights_status IN ('owned', 'licensed')
            AND cloud_file_id LIKE 'cloud://%'
          ORDER BY updated_at DESC LIMIT 1
       ) audio ON TRUE
      WHERE n.note_id = $1::uuid
        AND n.status = 'published'
        AND jsonb_typeof(n.content_blocks) = 'array'
        AND jsonb_array_length(n.content_blocks) > 0
      LIMIT 1`,
    [noteId]
  )
  if (!rows?.[0]) return res.status(404).json({ success: false, error: '笔记不存在或尚未发布' })
  const note = mapMiniNote(rows[0], viewer.hasGrowthAccess, { detail: true })
  return res.status(200).json({
    success: true,
    note,
    access: note.unlocked
      ? { unlocked: true }
      : { unlocked: false, code: 'MEMBERSHIP_REQUIRED', message: '开通 Haigoo 会员后可阅读完整笔记' }
  })
}

async function handleMiniMembershipPlans(req, res) {
  if (!ensureDatabase(res)) return
  const viewer = await resolveMiniViewer(String(req.query?.openid || '').trim())
  const rawConfig = await systemSettingsService.getSetting('membership_plan_config')
  const allowedIds = new Set(['club_starter_monthly', 'club_half_year', 'club_annual'])
  const plans = getMembershipPlans(rawConfig).filter((plan) => allowedIds.has(plan.id)).map(mapMiniPlan)
  return res.status(200).json({ success: true, plans, membership: viewer.user })
}

async function handleMiniConsultations(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.method === 'GET' ? req.query?.openid : req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  if (req.method === 'GET') {
    const rows = await neonHelper.query(
      `SELECT id, consultation_topic, wechat_id, question, source_page,
              source_content_id, source_company_id, status, created_at, updated_at
         FROM ${CONSULTATIONS_TABLE}
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 20`,
      [user.user_id]
    )
    return res.status(200).json({ success: true, consultations: rows || [] })
  }

  const topic = String(req.body?.topic || '').trim()
  const wechatId = String(req.body?.wechatId || '').trim()
  const question = String(req.body?.question || '').trim().slice(0, 1000)
  const sourcePage = String(req.body?.sourcePage || 'mini_consultation').trim().slice(0, 64)
  const sourceContentId = String(req.body?.sourceContentId || '').trim().slice(0, 255) || null
  const sourceCompanyId = String(req.body?.sourceCompanyId || '').trim().slice(0, 255) || null
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim()
  const privacyVersion = String(req.body?.privacyVersion || '').trim()
  const acceptedAt = new Date(req.body?.acceptedAt || '')
  const allowedTopics = new Set(['career_direction', 'resume', 'remote_search', 'interview', 'membership', 'other'])
  if (!allowedTopics.has(topic) || !/^[A-Za-z0-9_@+.-]{2,64}$/.test(wechatId) || !isIdempotencyKey(idempotencyKey)) {
    return res.status(400).json({ success: false, error: '请完整填写咨询方向和微信号' })
  }
  if (privacyVersion !== PRIVACY_VERSION || Number.isNaN(acceptedAt.getTime())) {
    return res.status(400).json({ success: false, code: 'CONSENT_REQUIRED', error: '提交前请阅读并同意隐私政策' })
  }

  return respondWithIdempotency(res, { openid, action: 'consultations', idempotencyKey }, async () => {
    await neonHelper.query(
      `INSERT INTO ${CONSENTS_TABLE} (
         app_id, openid, user_id, agreement_version, privacy_version, accepted_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (app_id, openid, agreement_version, privacy_version)
       DO UPDATE SET user_id = EXCLUDED.user_id, accepted_at = EXCLUDED.accepted_at`,
      [process.env.WECHAT_MINI_APP_ID || '', openid, user.user_id, AGREEMENT_VERSION, privacyVersion, acceptedAt.toISOString()]
    )
    const rows = await neonHelper.query(
      `INSERT INTO ${CONSULTATIONS_TABLE} (
         user_id, consultation_topic, wechat_id, question, source_page,
         source_content_id, source_company_id, status, idempotency_key, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())
       RETURNING id, consultation_topic, status, created_at`,
      [user.user_id, topic, wechatId, question, sourcePage, sourceContentId, sourceCompanyId, idempotencyKey]
    )
    const consultation = rows?.[0]
    await neonHelper.query(
      `INSERT INTO member_crm_audit_log (
         target_user_id, admin_user_id, action, entity_type, entity_id, metadata, created_at
       ) VALUES ($1, NULL, 'consultation_requested', 'consultation_request', $2, $3::jsonb, NOW())`,
      [user.user_id, consultation?.id || null, JSON.stringify({ sourcePage, sourceContentId, sourceCompanyId, privacyVersion })]
    )
    return {
      status: 201,
      payload: {
        success: true,
        consultation,
        advisor: { qrImage: '/assets/haigoo-advisor.png', message: '咨询已提交，请添加顾问微信' }
      }
    }
  })
}

function safeCareerIntake(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const text = (key, max = 500) => String(source[key] || '').trim().slice(0, max)
  return {
    location: text('location', 100),
    timezone: text('timezone', 100),
    workMode: text('workMode', 80),
    weeklyHours: Math.max(0, Math.min(168, Number(source.weeklyHours) || 0)),
    availability: text('availability', 300),
    eveningOverlap: text('eveningOverlap', 40),
    languages: text('languages', 300),
    targetRoles: text('targetRoles', 400),
    careerGoal: text('careerGoal', 800),
    constraints: text('constraints', 800)
  }
}

async function readWebsiteResumeImport(userId) {
  try {
    const rows = await neonHelper.query(
      `SELECT file_name, parse_status, parse_result, content_text, updated_at
         FROM resumes
        WHERE user_id = $1
          AND parse_status IN ('success', 'partial')
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      [userId]
    )
    const row = rows?.[0]
    if (!row) return null
    let parsed = row.parse_result
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { parsed = null }
    }
    const careerText = redactCareerText(row.content_text || parsed?.text || parsed?.content || '').slice(0, 20000)
    if (careerText.length < 80) return null
    const intake = safeCareerIntake({})
    const structured = buildStructuredCareerProfile(careerText, intake)
    return {
      sourceType: 'resume',
      filename: String(row.file_name || 'website-resume').slice(0, 160),
      careerText,
      structured: structured.structuredProfile,
      completeness: careerCompleteness(careerText, intake),
      updatedAt: row.updated_at || null
    }
  } catch (error) {
    console.warn('[mini-gateway] website resume import unavailable', error?.message || error)
    return null
  }
}

function safeClarificationAnswers(value) {
  return (Array.isArray(value) ? value : []).slice(0, 5).map((item) => ({
    question: String(item?.question || '').trim().slice(0, 300),
    answer: redactCareerText(String(item?.answer || '')).slice(0, 1000)
  })).filter((item) => item.question && item.answer)
}

async function purgeExpiredCareerData(userId = '') {
  const params = userId ? [userId] : []
  const userFilter = userId ? ' AND user_id = $1' : ''
  await neonHelper.query(
    `WITH expired AS (
       DELETE FROM ${CAREER_PROFILES_TABLE}
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()${userFilter}
       RETURNING user_id, retention_policy, expires_at, privacy_version
     )
     INSERT INTO ${CAREER_PRIVACY_EVENTS_TABLE}
       (user_id, action, retention_policy, expires_at, privacy_version, metadata)
     SELECT user_id, 'retention_expired', retention_policy, expires_at, privacy_version, '{}'::jsonb
       FROM expired`,
    params
  )
}

async function readCareerEntitlement(user) {
  const [rows, entitlementRows] = await Promise.all([
    neonHelper.query(
      `SELECT profile_id, source_type, career_text, intake, structured_profile,
              profile_hash, profile_completeness, retention_policy,
              expires_at, privacy_version, consented_at, version, updated_at
         FROM ${CAREER_PROFILES_TABLE}
        WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [user.user_id]
    ),
    neonHelper.query(
      `SELECT free_assessment_used_at FROM ${CAREER_ENTITLEMENTS_TABLE}
        WHERE user_id = $1 LIMIT 1`,
      [user.user_id]
    )
  ])
  const capabilities = deriveMembershipCapabilities(user)
  const profile = rows?.[0] || null
  const consentedAt = profile?.consented_at ? new Date(profile.consented_at).getTime() : 0
  return {
    profile,
    retentionReviewDue: Boolean(profile?.retention_policy === 'long_term' && consentedAt && Date.now() - consentedAt >= 365 * 24 * 60 * 60 * 1000),
    freeAssessmentAvailable: !entitlementRows?.[0]?.free_assessment_used_at,
    canAssess: Boolean(capabilities.isActive || !entitlementRows?.[0]?.free_assessment_used_at),
    isMember: Boolean(capabilities.isActive)
  }
}

async function handleMatchFeed(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  await purgeExpiredCareerData(user.user_id)
  const entitlement = await readCareerEntitlement(user)
  const feed = await getMatchFeed({
    user,
    profileRow: entitlement.profile,
    isMember: Boolean(entitlement.isMember)
  })
  return res.status(200).json({
    success: true,
    ...feed,
    capabilities: {
      isMember: Boolean(entitlement.isMember),
      maxRecommendations: entitlement.isMember ? 5 : 3,
      maxFollows: entitlement.isMember ? null : 3,
      wechatTemplateId: process.env.WECHAT_MINI_COMPANY_UPDATE_TEMPLATE_ID || ''
    }
  })
}

async function handleMatchFollows(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const capabilities = deriveMembershipCapabilities(user)
  if (req.method === 'GET') return res.status(200).json(await listCompanyFollows(user))
  if (req.method === 'DELETE') return res.status(200).json(await setCompanyFollow({ user, companyId: req.query?.companyId, active: false, isMember: capabilities.isActive }))
  const companyId = String(req.body?.companyId || '').trim()
  const active = req.body?.followed !== false
  return res.status(200).json(await setCompanyFollow({ user, companyId, active, isMember: capabilities.isActive }))
}

async function handleMatchFeedback(req, res) {
  if (!ensureDatabase(res)) return
  const user = await requireBoundUser(String(req.body?.openid || '').trim(), res)
  if (!user) return
  return res.status(200).json(await recordMatchFeedback({ user, companyId: req.body?.companyId, action: req.body?.action }))
}

async function handleMatchUpdates(req, res) {
  if (!ensureDatabase(res)) return
  const user = await requireBoundUser(String(req.query?.openid || req.body?.openid || '').trim(), res)
  if (!user) return
  if (req.method === 'POST') return res.status(200).json(await markMatchUpdatesRead(user, req.body?.inboxIds))
  const rows = await neonHelper.query(
    `SELECT inbox.inbox_id, inbox.status, events.company_id, companies.name AS company_name,
            events.event_type, events.occurred_at, events.has_public_opportunity
       FROM mini_company_update_inbox inbox
       JOIN mini_company_update_events events ON events.event_id = inbox.event_id
       JOIN trusted_companies companies ON companies.company_id = events.company_id
      WHERE inbox.user_id = $1 ORDER BY events.occurred_at DESC LIMIT 50`,
    [user.user_id]
  )
  return res.status(200).json({ success: true, updates: rows || [] })
}

async function handleMatchApplyTicket(req, res) {
  if (!ensureDatabase(res)) return
  const user = await requireBoundUser(String(req.body?.openid || '').trim(), res)
  if (!user) return
  return res.status(200).json(await createApplyTicket({ user, companyId: req.body?.companyId }))
}

async function handleMatchNotifications(req, res) {
  if (!ensureDatabase(res)) return
  const user = await requireBoundUser(String(req.body?.openid || '').trim(), res)
  if (!user) return
  return res.status(200).json(await setFollowNotifications({
    user,
    companyId: req.body?.companyId,
    enabled: req.body?.enabled,
    templateStatus: req.body?.templateStatus
  }))
}

async function handleCareerState(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  await purgeExpiredCareerData(user.user_id)
  const entitlement = await readCareerEntitlement(user)
  const runRows = entitlement.profile
    ? await neonHelper.query(
        `SELECT run_id, status, clarification_questions, result, company_matches, created_at
           FROM ${CAREER_RUNS_TABLE}
          WHERE user_id = $1 AND profile_id = $2
          ORDER BY created_at DESC LIMIT 1`,
        [user.user_id, entitlement.profile.profile_id]
      )
    : []
  const importedResume = entitlement.profile ? null : await readWebsiteResumeImport(user.user_id)
  return res.status(200).json({ success: true, ...entitlement, importedResume, latestRun: runRows?.[0] || null })
}

async function handleCareerResumeParse(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const filename = String(req.body?.filename || '').trim().slice(0, 160)
  const base64 = String(req.body?.fileBase64 || '')
  if (!base64 || base64.length > Math.ceil(CAREER_RESUME_MAX_BYTES * 4 / 3) + 16 || !/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    return res.status(400).json({ success: false, error: '简历文件无效或超过 2MB' })
  }
  try {
    const parsed = await parseCareerResumeBuffer({ filename, buffer: Buffer.from(base64, 'base64') })
    const careerText = redactCareerText(parsed.text)
    const structured = buildStructuredCareerProfile(careerText, {})
    return res.status(200).json({
      success: true,
      sourceType: 'resume',
      careerText,
      structured: structured.structuredProfile,
      completeness: careerCompleteness(careerText, {}),
      rawFileStored: false,
      message: '简历已读取，原文件未保存。请检查职业内容是否准确。'
    })
  } catch (error) {
    return res.status(422).json({ success: false, code: error?.code || 'RESUME_PARSE_FAILED', error: error?.message || '简历解析失败，请改用手动填写' })
  }
}

async function handleCareerProfileSave(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const retentionPolicy = String(req.body?.retentionPolicy || '')
  const sourceType = String(req.body?.sourceType || 'manual') === 'resume' ? 'resume' : 'manual'
  const careerText = redactCareerText(req.body?.careerText).slice(0, 20000)
  const intake = safeCareerIntake(req.body?.intake)
  const privacyVersion = String(req.body?.privacyVersion || '')
  const consentedAt = new Date(req.body?.consentedAt || '')
  if (!['session', '30_days', '90_days', 'long_term'].includes(retentionPolicy)) {
    return res.status(400).json({ success: false, error: '请选择职业资料保存期限' })
  }
  if (careerText.length < 80) return res.status(400).json({ success: false, error: '请补充至少一段工作或项目经历' })
  if (privacyVersion !== CAREER_PRIVACY_VERSION || Number.isNaN(consentedAt.getTime())) {
    return res.status(400).json({ success: false, code: 'CONSENT_REQUIRED', error: '请确认职业资料用途和保存期限' })
  }
  const completeness = careerCompleteness(careerText, intake)
  const structured = buildStructuredCareerProfile(careerText, intake)
  if (retentionPolicy === 'session') {
    return res.status(200).json({ success: true, stored: false, profile: { source_type: sourceType, career_text: careerText, intake, structured_profile: structured.structuredProfile, profile_hash: structured.profileHash, retention_policy: retentionPolicy }, completeness })
  }
  const expiresAt = retentionExpiry(retentionPolicy)
  const rows = await neonHelper.query(
    `INSERT INTO ${CAREER_PROFILES_TABLE} (
       user_id, source_type, career_text, intake, structured_profile, profile_hash, profile_completeness,
       retention_policy, expires_at,
       privacy_version, consented_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       source_type = EXCLUDED.source_type,
       career_text = EXCLUDED.career_text,
       intake = EXCLUDED.intake,
       structured_profile = EXCLUDED.structured_profile,
       profile_hash = EXCLUDED.profile_hash,
       profile_completeness = EXCLUDED.profile_completeness,
       retention_policy = EXCLUDED.retention_policy,
       expires_at = EXCLUDED.expires_at,
       privacy_version = EXCLUDED.privacy_version,
       consented_at = EXCLUDED.consented_at,
       version = ${CAREER_PROFILES_TABLE}.version + 1,
       updated_at = NOW(), deleted_at = NULL
     RETURNING profile_id, source_type, intake, structured_profile, profile_hash, profile_completeness, retention_policy, expires_at, version, updated_at`,
    [user.user_id, sourceType, careerText, JSON.stringify(intake), JSON.stringify(structured.structuredProfile), structured.profileHash, structured.profileCompleteness, retentionPolicy, expiresAt?.toISOString() || null, privacyVersion, consentedAt.toISOString()]
  )
  await neonHelper.query(
    `INSERT INTO ${CAREER_PRIVACY_EVENTS_TABLE} (user_id, action, retention_policy, expires_at, privacy_version, metadata)
     VALUES ($1, 'retention_selected', $2, $3, $4, $5::jsonb)`,
    [user.user_id, retentionPolicy, expiresAt?.toISOString() || null, privacyVersion, JSON.stringify({ sourceType })]
  )
  await neonHelper.query(`DELETE FROM mini_match_recommendation_runs WHERE user_id = $1`, [user.user_id])
  await neonHelper.query(`DELETE FROM ${CAREER_RUNS_TABLE} WHERE user_id = $1 AND profile_id = $2`, [user.user_id, rows?.[0]?.profile_id])
  return res.status(200).json({ success: true, stored: true, profile: rows?.[0], completeness })
}

async function handleCareerAnalyze(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  await purgeExpiredCareerData(user.user_id)
  const entitlement = await readCareerEntitlement(user)
  if (!entitlement.canAssess) {
    return res.status(403).json({ success: false, code: 'MEMBERSHIP_REQUIRED', error: '本次免费 Match 已使用，开通会员后可再次分析。' })
  }
  const retentionPolicy = String(req.body?.retentionPolicy || entitlement.profile?.retention_policy || '')
  const sessionMode = retentionPolicy === 'session'
  const careerText = redactCareerText(sessionMode ? req.body?.careerText : entitlement.profile?.career_text).slice(0, 20000)
  const intake = safeCareerIntake(sessionMode ? req.body?.intake : entitlement.profile?.intake)
  const answers = safeClarificationAnswers(req.body?.answers)
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim()
  if (careerText.length < 80 || !['session', '30_days', '90_days', 'long_term'].includes(retentionPolicy) || !isIdempotencyKey(idempotencyKey)) {
    return res.status(400).json({ success: false, error: '职业资料不完整，请返回检查后重试' })
  }
  if (!sessionMode && !entitlement.profile) return res.status(404).json({ success: false, error: '未找到已保存的职业资料' })

  if (!sessionMode) {
    const existing = await neonHelper.query(
      `SELECT status, result, company_matches, clarification_questions
         FROM ${CAREER_RUNS_TABLE} WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [user.user_id, idempotencyKey]
    )
    if (existing?.[0]?.result) return res.status(200).json({ success: true, ...existing[0].result, status: existing[0].status })
  }

  // Matching is deliberately deterministic. Optional Qwen enrichment belongs
  // outside the recommendation path and must never block a usable result.
  const result = buildDeterministicCareerResult(careerText, intake)
  const transientRecommendations = sessionMode
    ? await getTransientMatchRecommendations(careerText, intake, entitlement.isMember ? 5 : 3)
    : []
  const companies = transientRecommendations.map((company) => ({
    id: company.companyId,
    name: company.name,
    industry: company.industry,
    description: company.description,
    fitLevel: company.fitBand === 'high' ? 'current' : company.fitBand === 'notable' ? 'explore' : 'research',
    reasons: company.reasons,
    caution: '企业是否招聘及具体要求，请以官方信息为准。'
  }))
  result.companies = companies
  const highQuestions = result.clarificationQuestions.filter((item) => item.priority === 'high')
  const status = highQuestions.length && answers.length === 0 ? 'needs_clarification' : 'ready'
  const expiresAt = retentionExpiry(retentionPolicy)

  if (!sessionMode) {
    await neonHelper.query(
      `INSERT INTO ${CAREER_RUNS_TABLE} (
         profile_id, user_id, profile_version, status, clarification_questions,
         clarification_answers, result, company_matches, provider, model,
         workflow_version, prompt_version, parser_version, idempotency_key, expires_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (user_id, idempotency_key) DO UPDATE SET
         status = EXCLUDED.status, clarification_questions = EXCLUDED.clarification_questions,
         clarification_answers = EXCLUDED.clarification_answers, result = EXCLUDED.result,
         company_matches = EXCLUDED.company_matches, updated_at = NOW()`,
      [entitlement.profile.profile_id, user.user_id, entitlement.profile.version, status,
        JSON.stringify(result.clarificationQuestions), JSON.stringify(answers), JSON.stringify(result), JSON.stringify(companies),
        'deterministic', 'local-rules', 'mini-match-v1', 'none', 'resume-parser-v1', idempotencyKey, expiresAt?.toISOString() || null]
    )
  }
  if (status === 'ready') {
    await neonHelper.query(
      `INSERT INTO ${CAREER_ENTITLEMENTS_TABLE} (user_id, free_assessment_used_at, created_at, updated_at)
       VALUES ($1, NOW(), NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         free_assessment_used_at = COALESCE(${CAREER_ENTITLEMENTS_TABLE}.free_assessment_used_at, NOW()),
         updated_at = NOW()`,
      [user.user_id]
    )
  }
  return res.status(200).json({ success: true, status, result, rawFileStored: false, stored: !sessionMode })
}

async function handleCareerDelete(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const rows = await neonHelper.query(
    `DELETE FROM ${CAREER_PROFILES_TABLE} WHERE user_id = $1 RETURNING profile_id`,
    [user.user_id]
  )
  await neonHelper.query('DELETE FROM mini_match_exposures WHERE user_id = $1', [user.user_id])
  await neonHelper.query(
    `INSERT INTO ${CAREER_PRIVACY_EVENTS_TABLE} (user_id, action, metadata)
     VALUES ($1, 'career_data_deleted', $2::jsonb)`,
    [user.user_id, JSON.stringify({ deletedProfile: Boolean(rows?.[0]) })]
  )
  return res.status(200).json({ success: true, deleted: Boolean(rows?.[0]), message: '职业资料和分析结果已删除' })
}

async function handleBrowse(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobIds = [...new Set((Array.isArray(req.body?.jobIds) ? req.body.jobIds : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].slice(0, 50)
  const statusOnly = req.body?.consume === false || String(req.body?.mode || '') === 'status'
  if (!isOpenId(openid) || (!statusOnly && jobIds.length === 0)) {
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

  // Version the allowance scope so rows created by the old list-impression
  // policy never reduce the new detail-only quota. This is intentionally
  // independent of the WeChat AppID used for authentication.
  const appId = process.env.WECHAT_MINI_APP_ID || ''
  const browseScope = `${appId}:${process.env.MINI_BROWSE_QUOTA_VERSION || 'detail-v2'}`
  if (statusOnly) {
    const rows = await neonHelper.query(
      `SELECT COUNT(*)::int AS viewed_count
         FROM mini_job_views
        WHERE app_id = $1 AND openid = $2`,
      [browseScope, openid]
    )
    const viewedCount = Math.max(0, Number(rows?.[0]?.viewed_count || 0))
    return res.status(200).json({
      success: true,
      allowedJobIds: [],
      viewedCount,
      remaining: Math.max(0, FREE_MINI_JOB_VIEW_LIMIT - viewedCount),
      limited: viewedCount >= FREE_MINI_JOB_VIEW_LIMIT
    })
  }

  const rows = await neonHelper.query(
    `SELECT consume_mini_job_views($1, $2, $3::text[], $4::int) AS result`,
    [browseScope, openid, jobIds, FREE_MINI_JOB_VIEW_LIMIT]
  )
  const result = typeof rows?.[0]?.result === 'string'
    ? JSON.parse(rows[0].result)
    : rows?.[0]?.result || {}
  return res.status(200).json({
    success: true,
    allowedJobIds: Array.isArray(result.allowedJobIds) ? result.allowedJobIds : [],
    viewedCount: Math.max(0, Number(result.viewedCount || 0)),
    remaining: Math.max(0, Number(result.remaining || 0)),
    limited: Boolean(result.limited)
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
    return respondWithIdempotency(res, {
      openid,
      action: 'subscription',
      idempotencyKey: String(req.body?.idempotencyKey || '').trim()
    }, async () => {
      const subscription = await subscriptionsService.upsertForUser(user, {
        topics,
        customTopics,
        status: 'active'
      })
      return { status: 200, payload: { success: true, subscription } }
    })
  }

  const subscriptions = await subscriptionsService.getForUser(user)
  const activeSubscriptionIds = (subscriptions || [])
    .filter((subscription) => String(subscription.status || 'active') === 'active')
    .map((subscription) => String(subscription.subscription_id || '').trim())
    .filter(Boolean)
  let jobIds = []
  if (activeSubscriptionIds.length > 0) {
    const rows = await neonHelper.query(
      `WITH latest_sent_run AS (
       SELECT id
           FROM subscription_digest_runs
          WHERE status = 'sent'
            AND subscription_id = ANY($1::text[])
          ORDER BY sent_at DESC NULLS LAST, created_at DESC
          LIMIT 1
       )
       SELECT item.job_id
         FROM subscription_digest_items item
         INNER JOIN latest_sent_run run ON run.id = item.run_id
        ORDER BY item.match_score DESC NULLS LAST, item.created_at ASC, item.job_id ASC
        LIMIT 5`,
      [activeSubscriptionIds]
    )
    jobIds = (rows || []).map((row) => String(row.job_id || '').trim()).filter(Boolean)
  }
  return res.status(200).json({ success: true, subscriptions: subscriptions || [], jobIds })
}

async function handleVirtualPaymentCreate(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const planId = String(req.body?.planId || '').trim()
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim()
  const agreementVersion = String(req.body?.agreementVersion || '').trim()
  const privacyVersion = String(req.body?.privacyVersion || '').trim()
  const acceptedAt = new Date(req.body?.acceptedAt || '')
  if (
    !planId ||
    !isIdempotencyKey(idempotencyKey) ||
    agreementVersion !== AGREEMENT_VERSION ||
    privacyVersion !== PRIVACY_VERSION ||
    Number.isNaN(acceptedAt.getTime())
  ) {
    return res.status(400).json({ success: false, error: '支付订单参数无效' })
  }

  const rateLimit = await consumeRateLimit(req, res, {
    action: 'virtual_payment_create',
    limit: 10,
    windowSeconds: 60 * 60
  })
  if (!rateLimit.allowed) return

  await neonHelper.query(
    `INSERT INTO ${CONSENTS_TABLE} (
       app_id, openid, user_id, agreement_version, privacy_version, accepted_at, created_at
     ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (app_id, openid, agreement_version, privacy_version)
     DO UPDATE SET user_id = EXCLUDED.user_id, accepted_at = NOW()`,
    [
      process.env.WECHAT_MINI_APP_ID || '',
      openid,
      user.user_id,
      agreementVersion,
      privacyVersion
    ]
  )

  return respondWithIdempotency(res, {
    openid,
    action: 'virtual_payment_create',
    idempotencyKey
  }, async () => {
    const order = await wechatVirtualPaymentService.createOrder({
      user,
      userId: user.user_id,
      openid,
      planId,
      appId: process.env.WECHAT_MINI_APP_ID || '',
      virtualEnv: Number(req.body?.virtualEnv) === 1 ? 1 : 0
    })
    return { status: 201, payload: { success: true, order } }
  })
}

async function handleVirtualPaymentStatus(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const paymentId = String(req.query?.paymentId || '').trim()
  if (!/^[A-Za-z0-9_*-]{6,32}$/.test(paymentId)) {
    return res.status(400).json({ success: false, error: '支付订单号无效' })
  }
  const order = await wechatVirtualPaymentService.getOrder(paymentId, {
    userId: user.user_id,
    openid
  })
  return res.status(200).json({ success: true, order })
}

async function handleVirtualPaymentList(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return
  const page = Math.max(1, Math.floor(Number(req.query?.page) || 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(req.query?.pageSize) || 20)))
  const result = await wechatVirtualPaymentService.listOrders({
    userId: user.user_id,
    openid,
    page,
    pageSize
  })
  return res.status(200).json({ success: true, ...result })
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
    return respondWithIdempotency(res, {
      openid,
      action: 'favorite',
      idempotencyKey: String(req.body?.idempotencyKey || '').trim()
    }, async () => {
      if (!favorite) {
        await neonHelper.query(
          `DELETE FROM ${FAVORITES_TABLE} WHERE user_id = $1 AND job_id = $2`,
          [user.user_id, jobId]
        )
        return { status: 200, payload: { success: true, jobId, favorite: false } }
      }

      const job = normalizeJobSnapshot(req.body?.jobSnapshot, jobId) || await getJob(jobId)
      await neonHelper.query(
        `INSERT INTO ${FAVORITES_TABLE} (
            user_id, job_id, job_title_snapshot, company_name_snapshot, created_at
         ) VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, job_id) DO NOTHING`,
        [user.user_id, jobId, job?.title || '', job?.company || '']
      )
      return { status: 200, payload: { success: true, jobId, favorite: true } }
    })
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
        AND uji.interaction_type IN ('apply', 'apply_redirect', 'pending_apply', 'email')
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
  const interactionType = type === 'website' ? 'apply_redirect' : 'email'
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

async function readUsage(user, type) {
  const token = generateToken({ userId: user.user_id, email: user.email })
  return invoke(freeUsageHandler, {
    method: 'GET',
    url: `/api/users?resource=free-usage&type=${encodeURIComponent(type)}`,
    headers: { authorization: `Bearer ${token}` }
  })
}

async function handleApplicationUsage(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.query?.openid || '').trim()
  const user = await requireBoundUser(openid, res)
  if (!user) return

  const [website, email] = await Promise.all([
    readUsage(user, 'website-apply'),
    readUsage(user, 'email-apply')
  ])
  const failed = [website, email].find((result) => result.statusCode < 200 || result.statusCode >= 300)
  if (failed) {
    return res.status(failed.statusCode).json(failed.payload || {
      success: false,
      error: '申请额度暂时无法读取'
    })
  }

  return res.status(200).json({
    success: true,
    isMember: Boolean(website.payload?.isMember || email.payload?.isMember),
    website: website.payload,
    email: email.payload
  })
}

async function handleApplication(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobId = String(req.body?.jobId || '').trim()
  const type = String(req.body?.type || '').trim()
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim()
  if (!isOpenId(openid) || !jobId || !['website', 'email'].includes(type)) {
    return res.status(400).json({ success: false, error: '申请参数无效' })
  }

  const identity = await getIdentity(openid)
  const user = identity?.user_id ? await userHelper.getUserById(identity.user_id) : null
  if (!user) return res.status(401).json({ success: false, code: 'ACCOUNT_BIND_REQUIRED', error: '请先连接 Haigoo 账号' })

  const job = normalizeJobSnapshot(req.body?.jobSnapshot, jobId) || await getJob(jobId)
  if (!job) return res.status(404).json({ success: false, error: '岗位不存在或已下线' })
  if (job.memberOnly && !deriveMembershipCapabilities(user).isActive) {
    return res.status(404).json({ success: false, code: 'JOB_UNAVAILABLE', error: '岗位不存在或已下线' })
  }

  const hasWebsiteApply = Boolean(job.url || job.sourceUrl)
  const hasEmailApply = Boolean(job.hiringEmail)
  if (type === 'email' && !hasEmailApply) {
    return res.status(400).json({ success: false, error: '该岗位未配置邮箱申请入口' })
  }
  if (type === 'website' && !hasWebsiteApply) {
    return res.status(400).json({ success: false, error: '该岗位未配置官网申请入口' })
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

  try {
    const usageType = type === 'website' ? 'website-apply' : 'email-apply'
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
      if (claim.enabled) await releaseIdempotencyKey(openid, 'application', idempotencyKey)
      return res.status(usage.statusCode).json(usage.payload || { success: false, error: '申请服务暂不可用' })
    }

    await recordApplicationInteraction(user, job, type)

    if (type === 'website') {
      const payload = { success: true, type, applicationStatus: 'entry_opened', websiteUrl: job.url || job.sourceUrl || '', usage: usage.payload }
      await saveIdempotentResult(openid, 'application', idempotencyKey, 200, payload)
      return res.status(200).json(payload)
    }
    const payload = { success: true, type, applicationStatus: 'entry_opened', hiringEmail: job.hiringEmail || '', emailType: job.emailType || '', usage: usage.payload }
    await saveIdempotentResult(openid, 'application', idempotencyKey, 200, payload)
    return res.status(200).json(payload)
  } catch (error) {
    if (claim.enabled) await releaseIdempotencyKey(openid, 'application', idempotencyKey)
    throw error
  }
}

async function handleApplicationStatus(req, res) {
  if (!ensureDatabase(res)) return
  const openid = String(req.body?.openid || '').trim()
  const jobId = String(req.body?.jobId || '').trim()
  const type = String(req.body?.type || '').trim()
  const status = String(req.body?.status || '').trim()
  if (!isOpenId(openid) || !jobId || !['website', 'email'].includes(type) || status !== 'applied') {
    return res.status(400).json({ success: false, error: '申请状态参数无效' })
  }
  const user = await requireBoundUser(openid, res)
  if (!user) return
  return respondWithIdempotency(res, {
    openid,
    action: 'application_status',
    idempotencyKey: String(req.body?.idempotencyKey || '').trim()
  }, async () => {
    const interactionType = type === 'website' ? 'apply_redirect' : 'email'
    const rows = await neonHelper.query(
      `UPDATE user_job_interactions
          SET status = 'applied', updated_at = NOW()
        WHERE user_id = $1 AND job_id = $2 AND interaction_type = $3
        RETURNING id`,
      [user.user_id, jobId, interactionType]
    )
    if (!rows?.[0]) {
      return { status: 404, payload: { success: false, error: '请先打开申请入口' } }
    }
    return { status: 200, payload: { success: true, jobId, type, status: 'applied' } }
  })
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
  const openid = String(req.query?.openid || '').trim()
  const identity = isOpenId(openid) ? await getIdentity(openid) : null
  const user = identity?.user_id ? await userHelper.getUserById(identity.user_id) : null
  const canAccessMemberOnly = Boolean(user && deriveMembershipCapabilities(user).isActive)
  const query = {
    sortBy: requestedSort === 'default' ? undefined : requestedSort || 'recent',
    canAccessMemberOnly,
    trustedCompaniesOnly: true,
    ...(cursor ? { updatedSince: cursor } : {}),
    ...(id ? { id } : {}),
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    ...(isFeatured === 'true' ? { isHotApplication: 'true' } : {})
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
    'content_home', 'companies', 'company', 'growth_notes', 'growth_note',
    'membership_plans', 'consultations',
    'career_state', 'career_resume_parse', 'career_profile', 'career_analyze', 'career_delete',
    'match_feed', 'match_follows', 'match_feedback', 'match_updates', 'match_apply_ticket', 'match_notifications',
    'feedback', 'events', 'browse', 'subscriptions', 'favorites', 'applications',
    'application', 'application_usage', 'application_status',
    'virtual_payment_create', 'virtual_payment_status', 'virtual_payment_list', 'sync'
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
    if (action === 'content_home' && req.method === 'GET') return await handleMiniHome(req, res)
    if (action === 'companies' && req.method === 'GET') return await handleMiniCompanies(req, res)
    if (action === 'company' && req.method === 'GET') return await handleMiniCompany(req, res)
    if (action === 'growth_notes' && req.method === 'GET') return await handleMiniGrowthNotes(req, res)
    if (action === 'growth_note' && req.method === 'GET') return await handleMiniGrowthNote(req, res)
    if (action === 'membership_plans' && req.method === 'GET') return await handleMiniMembershipPlans(req, res)
    if (action === 'consultations' && ['GET', 'POST'].includes(req.method)) return await handleMiniConsultations(req, res)
    if (action === 'career_state' && req.method === 'GET') return await handleCareerState(req, res)
    if (action === 'career_resume_parse' && req.method === 'POST') return await handleCareerResumeParse(req, res)
    if (action === 'career_profile' && req.method === 'PUT') return await handleCareerProfileSave(req, res)
    if (action === 'career_analyze' && req.method === 'POST') return await handleCareerAnalyze(req, res)
    if (action === 'career_delete' && req.method === 'DELETE') return await handleCareerDelete(req, res)
    if (action === 'match_feed' && req.method === 'GET') return await handleMatchFeed(req, res)
    if (action === 'match_follows' && ['GET', 'POST', 'DELETE'].includes(req.method)) return await handleMatchFollows(req, res)
    if (action === 'match_feedback' && req.method === 'POST') return await handleMatchFeedback(req, res)
    if (action === 'match_updates' && ['GET', 'POST'].includes(req.method)) return await handleMatchUpdates(req, res)
    if (action === 'match_apply_ticket' && req.method === 'POST') return await handleMatchApplyTicket(req, res)
    if (action === 'match_notifications' && req.method === 'POST') return await handleMatchNotifications(req, res)
    if (action === 'feedback' && req.method === 'POST') return await handleFeedback(req, res)
    if (action === 'events' && req.method === 'POST') return await handleEvents(req, res)
    if (action === 'browse' && req.method === 'POST') return await handleBrowse(req, res)
    if (action === 'subscriptions' && ['GET', 'POST'].includes(req.method)) return await handleSubscriptions(req, res)
    if (action === 'virtual_payment_create' && req.method === 'POST') return await handleVirtualPaymentCreate(req, res)
    if (action === 'virtual_payment_status' && req.method === 'GET') return await handleVirtualPaymentStatus(req, res)
    if (action === 'virtual_payment_list' && req.method === 'GET') return await handleVirtualPaymentList(req, res)
    if (action === 'favorites' && ['GET', 'POST'].includes(req.method)) return await handleFavorites(req, res)
    if (action === 'applications' && req.method === 'GET') return await handleApplications(req, res)
    if (action === 'application' && req.method === 'POST') return await handleApplication(req, res)
    if (action === 'application_usage' && req.method === 'GET') return await handleApplicationUsage(req, res)
    if (action === 'application_status' && req.method === 'POST') return await handleApplicationStatus(req, res)
    if (action === 'sync' && req.method === 'GET') return await handleSync(req, res)
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[mini-gateway] request failed', error)
    const statusCode = Number(error?.statusCode || error?.status || 500)
    const errorCode = String(error?.code || '')
    const safeVirtualPaymentError = errorCode.startsWith('VIRTUAL_PAYMENT_')
    return res.status(statusCode >= 400 && statusCode <= 599 ? statusCode : 500).json({
      success: false,
      ...(errorCode ? { code: errorCode } : {}),
      error: safeVirtualPaymentError
        ? error.message
        : statusCode === 503
          ? '服务繁忙，请稍后重试'
          : '当前服务暂时不可用，请稍后重试'
    })
  }
}

export {
  gatewaySecrets,
  hasGatewaySignature,
  mapMiniCompany,
  mapMiniNote,
  mapMiniPlan,
  normalizeEventId,
  normalizeJobSnapshot,
  requestSignature,
  safeCloudFileId,
  stableJson
}
