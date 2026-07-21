import crypto from 'crypto'
import { comparePassword, generateToken, sanitizeUser } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'
import { countJobsFromNeon, readJobsFromNeon } from './processed-jobs.js'
import freeUsageHandler from './free-usage.js'

const IDENTITY_TABLE = 'mini_wechat_identities'
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function requestSignature(method, action, timestamp, body) {
  const secret = process.env.MINI_GATEWAY_SHARED_SECRET
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
  if (!process.env.MINI_GATEWAY_SHARED_SECRET || !Number.isFinite(timestampMs)) return false
  if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false

  const expected = requestSignature(req.method, action, timestamp, req.body || {})
  if (!expected || received.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

function isOpenId(value) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(String(value || ''))
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
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!isOpenId(openid) || !email || !password) {
    return res.status(400).json({ success: false, error: '请填写网站账号邮箱和密码' })
  }

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

  return res.status(200).json({ success: true, bound: true, user: userSummary(user) })
}

async function getJob(jobId) {
  const jobs = await readJobsFromNeon({ id: jobId, sortBy: 'recent' }, { page: 1, limit: 1 })
  return jobs?.[0] || null
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
    return res.status(usage.statusCode).json(usage.payload || { success: false, error: '申请服务暂不可用' })
  }

  if (type === 'website') {
    return res.status(200).json({ success: true, type, websiteUrl: job.url || job.sourceUrl || '', usage: usage.payload })
  }
  if (type === 'email') {
    return res.status(200).json({ success: true, type, hiringEmail: job.hiringEmail || '', emailType: job.emailType || '', usage: usage.payload })
  }
  return res.status(200).json({
    success: true,
    type,
    websiteUrl: `${process.env.PUBLIC_APP_ORIGIN || 'https://haigooremote.com'}/jobs?jobId=${encodeURIComponent(jobId)}`,
    usage: usage.payload
  })
}

async function handleSync(req, res) {
  const cursor = String(req.query?.cursor || '').trim()
  const page = Math.max(1, Number(req.query?.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 100))
  if (!ensureDatabase(res)) return
  const query = { sortBy: 'recent', ...(cursor ? { updatedSince: cursor } : {}) }
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
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / limit)),
    nextCursor: newestCursor || null,
    hasMore: page < Math.max(1, Math.ceil(Number(total || 0) / limit))
  })
}

export default async function miniGatewayHandler(req, res) {
  const action = String(req.query?.action || '').trim()
  if (!['session', 'bind', 'application', 'sync'].includes(action)) {
    return res.status(404).json({ success: false, error: 'Unknown mini gateway action' })
  }
  if (!hasGatewaySignature(req, action)) {
    return res.status(401).json({ success: false, error: 'Unauthorized gateway request' })
  }

  try {
    if (action === 'session' && req.method === 'POST') return await handleSession(req, res)
    if (action === 'bind' && req.method === 'POST') return await handleBind(req, res)
    if (action === 'application' && req.method === 'POST') return await handleApplication(req, res)
    if (action === 'sync' && req.method === 'GET') return await handleSync(req, res)
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[mini-gateway] request failed', error)
    return res.status(500).json({ success: false, error: '小程序服务暂时不可用' })
  }
}

export { requestSignature, stableJson }
