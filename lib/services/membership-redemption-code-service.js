import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_BODY_LENGTH = 16
const MAX_BATCH_SIZE = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const READINESS_CACHE_MS = 30_000
let readinessCache = { checkedAt: 0, ready: false }
let entitlementReadinessCache = { checkedAt: 0, ready: false }
const PLAN_DEFINITIONS = Object.freeze({
  starter: { prefix: 'M', durationMonths: 1, label: '月度会员' },
  half_year: { prefix: 'H', durationMonths: 6, label: '半年会员' },
  annual: { prefix: 'Y', durationMonths: 12, label: '年度会员' }
})

export function isMembershipRedemptionEnabled() {
  const configured = String(process.env.MEMBERSHIP_REDEMPTION_ENABLED || '').trim().toLowerCase()
  return configured === 'true'
}

export function isMembershipRedemptionConfigured() {
  return Boolean(
    neonHelper.isConfigured
    && String(process.env.MEMBERSHIP_REDEMPTION_CODE_KEY || '').length >= 32
  )
}

export function isMembershipRedemptionAvailable() {
  return isMembershipRedemptionEnabled() && isMembershipRedemptionConfigured()
}

export async function isMembershipRedemptionReady({ force = false } = {}) {
  if (!isMembershipRedemptionAvailable()) return false
  const now = Date.now()
  if (!force && now - readinessCache.checkedAt < READINESS_CACHE_MS) return readinessCache.ready
  try {
    const rows = await neonHelper.query(
      `SELECT
         to_regclass('public.membership_code_batches') IS NOT NULL
         AND to_regclass('public.membership_redemption_codes') IS NOT NULL
         AND to_regclass('public.membership_entitlement_segments') IS NOT NULL
         AND to_regclass('public.membership_code_admin_audit') IS NOT NULL
         AND to_regclass('public.mini_rate_limits') IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'membership_redemption_codes'
                AND column_name = 'distributed_at'
         )
         AND EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'membership_redemption_codes'
                AND column_name = 'distributed_by'
         )
         AND to_regprocedure('public.redeem_membership_code(text,character varying)') IS NOT NULL
         AND to_regprocedure('public.reconcile_membership_entitlements(character varying)') IS NOT NULL
         AS ready`,
      []
    )
    readinessCache = { checkedAt: now, ready: rows?.[0]?.ready === true }
  } catch (_error) {
    readinessCache = { checkedAt: now, ready: false }
  }
  return readinessCache.ready
}

export async function isMembershipEntitlementScheduleReady({ force = false } = {}) {
  if (!neonHelper.isConfigured) return false
  const now = Date.now()
  if (!force && now - entitlementReadinessCache.checkedAt < READINESS_CACHE_MS) return entitlementReadinessCache.ready
  try {
    const rows = await neonHelper.query(
      `SELECT
         to_regclass('public.membership_entitlement_segments') IS NOT NULL
         AND to_regprocedure('public.reconcile_membership_entitlements(character varying)') IS NOT NULL
         AND to_regprocedure('public.rebase_pending_membership_entitlements(character varying,timestamp with time zone)') IS NOT NULL
         AS ready`,
      []
    )
    entitlementReadinessCache = { checkedAt: now, ready: rows?.[0]?.ready === true }
  } catch (_error) {
    entitlementReadinessCache = { checkedAt: now, ready: false }
  }
  return entitlementReadinessCache.ready
}

function getMasterKey() {
  const secret = String(process.env.MEMBERSHIP_REDEMPTION_CODE_KEY || '')
  if (secret.length < 32) {
    const error = new Error('Membership redemption code key is not configured')
    error.code = 'REDEMPTION_KEY_MISSING'
    throw error
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest()
}

function deriveKey(purpose) {
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    getMasterKey(),
    Buffer.from('haigoo-membership-redemption-v1'),
    Buffer.from(purpose),
    32
  ))
}

export function normalizeRedemptionCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '')
}

export function hashRedemptionCode(value) {
  const normalized = normalizeRedemptionCode(value)
  return crypto.createHmac('sha256', deriveKey('lookup')).update(normalized).digest('hex')
}

export function encryptRedemptionCode(value) {
  const normalized = normalizeRedemptionCode(value)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('encryption'), iv)
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptRedemptionCode(value) {
  const [version, ivValue, tagValue, cipherValue] = String(value || '').split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !cipherValue) {
    throw new Error('Unsupported membership redemption code ciphertext')
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey('encryption'),
    Buffer.from(ivValue, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(cipherValue, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}

function randomCodeCharacter() {
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let byte = crypto.randomBytes(1)[0]
  while (byte >= limit) byte = crypto.randomBytes(1)[0]
  return CODE_ALPHABET[byte % CODE_ALPHABET.length]
}

export function generateRedemptionCode(memberType) {
  const plan = PLAN_DEFINITIONS[memberType]
  if (!plan) throw new Error(`Unsupported membership type: ${memberType}`)
  const body = Array.from({ length: CODE_BODY_LENGTH }, randomCodeCharacter).join('')
  return `HG-${plan.prefix}-${body.match(/.{1,4}/g).join('-')}`
}

function slugifyBatchKey(value) {
  const compact = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return compact || `batch-${Date.now()}`
}

function codeStatusSql(alias = 'c') {
  return `CASE
    WHEN ${alias}.voided_at IS NOT NULL THEN 'voided'
    WHEN ${alias}.use_count >= ${alias}.usage_limit OR ${alias}.redeemed_at IS NOT NULL THEN 'used'
    WHEN ${alias}.expires_at <= NOW() THEN 'expired'
    ELSE 'unused'
  END`
}

function planFor(memberType) {
  const plan = PLAN_DEFINITIONS[memberType]
  if (!plan) {
    const error = new Error('请选择有效的会员类型')
    error.code = 'INVALID_MEMBER_TYPE'
    throw error
  }
  return plan
}

export async function createMembershipCodeBatch({
  name,
  channel,
  memberType,
  quantity,
  createdBy,
  batchKey = null
}) {
  if (!isMembershipRedemptionEnabled()) {
    const error = new Error('会员兑换码功能暂未启用')
    error.code = 'FEATURE_DISABLED'
    throw error
  }
  if (!neonHelper.isConfigured) {
    const error = new Error('数据库未配置')
    error.code = 'DATABASE_NOT_CONFIGURED'
    throw error
  }
  if (!(await isMembershipRedemptionReady())) {
    const error = new Error('兑换码数据库尚未初始化')
    error.code = 'SCHEMA_NOT_READY'
    throw error
  }

  const plan = planFor(memberType)
  const safeName = String(name || '').trim().slice(0, 160)
  const safeChannel = String(channel || '').trim().slice(0, 160)
  const safeQuantity = Number(quantity)
  if (!safeName || !safeChannel) {
    const error = new Error('批次名称和销售渠道不能为空')
    error.code = 'INVALID_BATCH'
    throw error
  }
  if (!Number.isInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > MAX_BATCH_SIZE) {
    const error = new Error(`单批次生成数量需为 1-${MAX_BATCH_SIZE}`)
    error.code = 'INVALID_QUANTITY'
    throw error
  }

  const generatedAt = new Date().toISOString()
  const codes = []
  const hashes = new Set()
  while (codes.length < safeQuantity) {
    const code = generateRedemptionCode(memberType)
    const codeHash = hashRedemptionCode(code)
    if (hashes.has(codeHash)) continue
    hashes.add(codeHash)
    const normalized = normalizeRedemptionCode(code)
    codes.push({
      code,
      codeHash,
      codeCiphertext: encryptRedemptionCode(code),
      codeLast4: normalized.slice(-4)
    })
  }

  const batchId = crypto.randomUUID()
  const resolvedBatchKey = String(batchKey || `${slugifyBatchKey(safeName)}-${batchId.slice(0, 8)}`).slice(0, 120)
  const payload = codes.map(item => ({
    code_hash: item.codeHash,
    code_ciphertext: item.codeCiphertext,
    code_last4: item.codeLast4
  }))

  try {
    await neonHelper.query(
      `WITH inserted_batch AS (
         INSERT INTO membership_code_batches (
           batch_id, batch_key, name, channel, member_type, duration_months,
           code_count, created_by, created_at, updated_at
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $9::timestamptz)
         RETURNING batch_id
       )
       , inserted_codes AS (
       INSERT INTO membership_redemption_codes (
         batch_id, code_hash, code_ciphertext, code_last4, member_type,
         duration_months, usage_limit, use_count, generated_at, expires_at,
         created_at, updated_at
       )
       SELECT b.batch_id, item.code_hash, item.code_ciphertext, item.code_last4,
              $5, $6, 1, 0, $9::timestamptz, $9::timestamptz + INTERVAL '1 year',
              $9::timestamptz, $9::timestamptz
         FROM inserted_batch b
         CROSS JOIN jsonb_to_recordset($10::jsonb) AS item(
           code_hash TEXT, code_ciphertext TEXT, code_last4 TEXT
         )
       RETURNING code_id
       )
       INSERT INTO membership_code_admin_audit (
         action, admin_user_id, batch_id, details
       )
       SELECT 'generate', $8, b.batch_id,
              jsonb_build_object(
                'memberType', $5::text,
                'channel', $4::text,
                'codeCount', (SELECT COUNT(*) FROM inserted_codes)
              )
         FROM inserted_batch b`,
      [
        batchId,
        resolvedBatchKey,
        safeName,
        safeChannel,
        memberType,
        plan.durationMonths,
        safeQuantity,
        String(createdBy || 'super-admin').slice(0, 255),
        generatedAt,
        JSON.stringify(payload)
      ]
    )
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      const conflict = new Error('批次名称或批次标识已存在')
      conflict.code = 'BATCH_EXISTS'
      throw conflict
    }
    throw error
  }

  return {
    batch: {
      batchId,
      batchKey: resolvedBatchKey,
      name: safeName,
      channel: safeChannel,
      memberType,
      durationMonths: plan.durationMonths,
      codeCount: safeQuantity,
      generatedAt
    },
    codes: codes.map(item => item.code)
  }
}

export async function redeemMembershipCode({ code, userId }) {
  if (!(await isMembershipRedemptionReady())) {
    return { success: false, code: 'FEATURE_DISABLED' }
  }
  const normalized = normalizeRedemptionCode(code)
  if (!/^HG[MHY][23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$/.test(normalized)) {
    return { success: false, code: 'INVALID_CODE' }
  }
  const rows = await neonHelper.query(
    'SELECT redeem_membership_code($1, $2) AS result',
    [hashRedemptionCode(normalized), userId]
  )
  return rows?.[0]?.result || { success: false, code: 'REDEMPTION_FAILED' }
}

export async function reconcileUserMembershipEntitlements(userId) {
  if (!userId || !(await isMembershipEntitlementScheduleReady())) {
    return { success: true, activated: false }
  }
  try {
    const rows = await neonHelper.query(
      'SELECT reconcile_membership_entitlements($1) AS result',
      [userId]
    )
    return rows?.[0]?.result || { success: true, activated: false }
  } catch (error) {
    if (/does not exist|undefined function|membership_entitlement_segments/i.test(String(error?.message || ''))) {
      return { success: true, activated: false }
    }
    throw error
  }
}

export async function reconcileDueMembershipEntitlements({ limit = 200 } = {}) {
  if (!(await isMembershipEntitlementScheduleReady())) {
    return { scanned: 0, activated: 0, activatedUserIds: [] }
  }
  let rows
  const parsedLimit = Number(limit)
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(2000, Math.max(1, Math.floor(parsedLimit)))
    : 200
  try {
    rows = await neonHelper.query(
      `SELECT DISTINCT user_id
         FROM membership_entitlement_segments
        WHERE starts_at <= NOW()
          AND activated_at IS NULL
          AND superseded_at IS NULL
        ORDER BY user_id
        LIMIT $1`,
      [safeLimit]
    )
  } catch (error) {
    if (/does not exist/i.test(String(error?.message || ''))) return { scanned: 0, activated: 0, activatedUserIds: [] }
    throw error
  }
  let activated = 0
  const activatedUserIds = []
  for (const row of rows || []) {
    const result = await reconcileUserMembershipEntitlements(row.user_id)
    if (result?.activated) {
      activated += 1
      activatedUserIds.push(row.user_id)
    }
  }
  return { scanned: rows?.length || 0, activated, activatedUserIds }
}

export async function rebasePendingMembershipEntitlements(userId, baseAt) {
  if (!userId || !baseAt || !(await isMembershipEntitlementScheduleReady())) return 0
  try {
    const rows = await neonHelper.query(
      'SELECT rebase_pending_membership_entitlements($1, $2::timestamptz) AS count',
      [userId, baseAt]
    )
    return Number(rows?.[0]?.count || 0)
  } catch (error) {
    if (/does not exist|undefined function/i.test(String(error?.message || ''))) return 0
    throw error
  }
}

export async function getUpcomingMembershipEntitlements(userId) {
  if (!userId || !(await isMembershipEntitlementScheduleReady())) return []
  try {
    const rows = await neonHelper.query(
      `SELECT segment_id, member_type, duration_months, COALESCE(duration_days, 0) AS duration_days, starts_at, ends_at
         FROM membership_entitlement_segments
        WHERE user_id = $1
          AND activated_at IS NULL
          AND superseded_at IS NULL
        ORDER BY starts_at ASC`,
      [userId]
    )
    return (rows || []).map(row => ({
      id: row.segment_id,
      memberType: row.member_type,
      durationMonths: Number(row.duration_months),
      durationDays: Number(row.duration_days || 0),
      startsAt: row.starts_at,
      expiresAt: row.ends_at,
      activationState: 'scheduled'
    }))
  } catch (error) {
    if (/does not exist/i.test(String(error?.message || ''))) return []
    throw error
  }
}

export async function listMembershipCodes({
  page = 1,
  pageSize = 25,
  search = '',
  status = 'all',
  memberType = 'all',
  channel = 'all',
  batchId = 'all',
  revealCodes = false
} = {}) {
  const parsedPage = Number(page)
  const parsedPageSize = Number(pageSize)
  const safePage = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1
  const safePageSize = Number.isFinite(parsedPageSize)
    ? Math.min(100, Math.max(10, Math.floor(parsedPageSize)))
    : 25
  const offset = (safePage - 1) * safePageSize
  const safeSearch = String(search || '').trim()
  const normalizedSearch = normalizeRedemptionCode(safeSearch)
  let exactHash = null
  if (/^HG[MHY][23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$/.test(normalizedSearch)) {
    try { exactHash = hashRedemptionCode(safeSearch) } catch (_error) { exactHash = null }
  }
  const searchLast4 = normalizedSearch.match(/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4})$/)?.[1]?.toLowerCase() || ''
  const statusExpr = codeStatusSql('c')
  const params = [
    safeSearch ? `%${safeSearch.toLowerCase()}%` : '',
    exactHash,
    searchLast4,
    status,
    memberType,
    channel,
    batchId
  ]
  const whereSql = `WHERE (
      $1 = '' OR LOWER(b.name) LIKE $1 OR LOWER(b.channel) LIKE $1
      OR LOWER(c.code_last4) LIKE $1 OR ($2::text IS NOT NULL AND c.code_hash = $2)
      OR ($3 <> '' AND LOWER(c.code_last4) = $3)
    )
    AND ($4 = 'all' OR ${statusExpr} = $4)
    AND ($5 = 'all' OR c.member_type = $5)
    AND ($6 = 'all' OR b.channel = $6)
    AND ($7 = 'all' OR b.batch_id::text = $7)`

  const [rows, countRows, summaryRows, batchRows, channelRows] = await Promise.all([
    neonHelper.query(
      `SELECT c.code_id,
              ${revealCodes ? 'c.code_ciphertext' : 'NULL::text AS code_ciphertext'},
              c.code_last4, c.member_type,
              c.duration_months, c.usage_limit, c.use_count, c.generated_at,
              c.expires_at, c.redeemed_at, c.redeemed_by_user_id,
              c.voided_at, c.void_reason, c.distributed_at, c.distributed_by,
              b.batch_id, b.name AS batch_name,
              b.channel, ${statusExpr} AS status,
              u.email AS redeemed_by_email, u.username AS redeemed_by_name
         FROM membership_redemption_codes c
         JOIN membership_code_batches b ON b.batch_id = c.batch_id
         LEFT JOIN users u ON u.user_id = c.redeemed_by_user_id
         ${whereSql}
        ORDER BY c.generated_at DESC, c.code_id DESC
        LIMIT $8 OFFSET $9`,
      [...params, safePageSize, offset]
    ),
    neonHelper.query(
      `SELECT COUNT(*)::int AS total
         FROM membership_redemption_codes c
         JOIN membership_code_batches b ON b.batch_id = c.batch_id
         ${whereSql}`,
      params
    ),
    neonHelper.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ${statusExpr} = 'unused')::int AS unused,
              COUNT(*) FILTER (WHERE ${statusExpr} = 'used')::int AS used,
              COUNT(*) FILTER (WHERE ${statusExpr} = 'expired')::int AS expired,
              COUNT(*) FILTER (WHERE ${statusExpr} = 'voided')::int AS voided,
              COUNT(*) FILTER (WHERE c.distributed_at IS NOT NULL)::int AS distributed,
              COUNT(*) FILTER (WHERE c.member_type = 'starter')::int AS starter,
              COUNT(*) FILTER (WHERE c.member_type = 'half_year')::int AS half_year,
              COUNT(*) FILTER (WHERE c.member_type = 'annual')::int AS annual
         FROM membership_redemption_codes c`
    ),
    neonHelper.query(
      `SELECT batch_id, batch_key, name, channel, member_type, duration_months,
              code_count, created_by, created_at
         FROM membership_code_batches
        ORDER BY created_at DESC`
    ),
    neonHelper.query(
      `SELECT DISTINCT channel FROM membership_code_batches ORDER BY channel`
    )
  ])

  let decryptionErrorCount = 0
  const codes = (rows || []).map(row => {
    let fullCode = null
    if (revealCodes) {
      try {
        fullCode = decryptRedemptionCode(row.code_ciphertext)
      } catch (_error) {
        fullCode = null
        decryptionErrorCount += 1
      }
    }
    const prefix = PLAN_DEFINITIONS[row.member_type]?.prefix || '*'
    return {
      id: row.code_id,
      code: fullCode || `HG-${prefix}-****-****-****-${row.code_last4}`,
      isMasked: !fullCode,
      last4: row.code_last4,
      memberType: row.member_type,
      durationMonths: Number(row.duration_months),
      usageLimit: Number(row.usage_limit),
      useCount: Number(row.use_count),
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
      status: row.status,
      batchId: row.batch_id,
      batchName: row.batch_name,
      channel: row.channel,
      redeemedAt: row.redeemed_at,
      redeemedByUserId: row.redeemed_by_user_id,
      redeemedByEmail: row.redeemed_by_email,
      redeemedByName: row.redeemed_by_name,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      distributed: Boolean(row.distributed_at),
      distributedAt: row.distributed_at,
      distributedBy: row.distributed_by
    }
  })

  return {
    codes,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: Number(countRows?.[0]?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRows?.[0]?.total || 0) / safePageSize))
    },
    summary: summaryRows?.[0] || { total: 0, unused: 0, used: 0, expired: 0, voided: 0, distributed: 0, starter: 0, half_year: 0, annual: 0 },
    decryptionErrorCount,
    batches: batchRows || [],
    channels: (channelRows || []).map(row => row.channel)
  }
}

export async function updateMembershipCodeDistribution({ codeId, distributed, updatedBy }) {
  if (!UUID_PATTERN.test(String(codeId || '')) || typeof distributed !== 'boolean') return null
  const actor = String(updatedBy || 'admin').slice(0, 255)
  const rows = await neonHelper.query(
    `WITH updated_code AS (
       UPDATE membership_redemption_codes
          SET distributed_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
              distributed_by = CASE WHEN $2::boolean THEN $3 ELSE NULL END,
              updated_at = NOW()
        WHERE code_id = $1::uuid
          AND use_count = 0
          AND redeemed_at IS NULL
          AND voided_at IS NULL
          AND expires_at > NOW()
          AND (($2::boolean AND distributed_at IS NULL)
               OR (NOT $2::boolean AND distributed_at IS NOT NULL))
        RETURNING code_id, batch_id, distributed_at, distributed_by
     ), recorded_audit AS (
       INSERT INTO membership_code_admin_audit (
         action, admin_user_id, batch_id, code_id, details
       )
       SELECT 'distribution', $3, batch_id, code_id,
              jsonb_build_object('distributed', $2::boolean)
         FROM updated_code
       RETURNING audit_id
     )
     SELECT code_id, distributed_at, distributed_by FROM updated_code`,
    [codeId, distributed, actor]
  )
  const row = rows?.[0]
  if (!row) return null
  return {
    codeId: row.code_id,
    distributed: Boolean(row.distributed_at),
    distributedAt: row.distributed_at,
    distributedBy: row.distributed_by
  }
}

export async function voidMembershipCode({ codeId, reason, voidedBy }) {
  if (!UUID_PATTERN.test(String(codeId || ''))) return false
  const actor = String(voidedBy || 'super-admin').slice(0, 255)
  const safeReason = String(reason || '').trim().slice(0, 500) || null
  const rows = await neonHelper.query(
    `WITH updated_code AS (
      UPDATE membership_redemption_codes
        SET voided_at = NOW(), voided_by = $2, void_reason = $3, updated_at = NOW()
      WHERE code_id = $1::uuid
        AND use_count = 0
        AND redeemed_at IS NULL
        AND voided_at IS NULL
        AND expires_at > NOW()
      RETURNING code_id, batch_id
     )
     INSERT INTO membership_code_admin_audit (
       action, admin_user_id, batch_id, code_id, details
     )
     SELECT 'void', $2, batch_id, code_id,
            jsonb_build_object('reason', $3::text)
       FROM updated_code
     RETURNING code_id`,
    [codeId, actor, safeReason]
  )
  return Boolean(rows?.[0])
}

export async function updateMembershipCodeBatch({ batchId, name, channel, updatedBy }) {
  if (!UUID_PATTERN.test(String(batchId || ''))) return null
  const safeName = String(name || '').trim().slice(0, 160)
  const safeChannel = String(channel || '').trim().slice(0, 160)
  if (!safeName || !safeChannel) {
    const error = new Error('批次名称和销售渠道不能为空')
    error.code = 'INVALID_BATCH'
    throw error
  }
  let rows
  try {
    rows = await neonHelper.query(
      `WITH updated_batch AS (
      UPDATE membership_code_batches
        SET name = $2, channel = $3, updated_at = NOW()
      WHERE batch_id = $1::uuid
      RETURNING batch_id, name, channel
     ), recorded_audit AS (
       INSERT INTO membership_code_admin_audit (
         action, admin_user_id, batch_id, details
       )
       SELECT 'update_batch', $4, batch_id,
              jsonb_build_object('name', name, 'channel', channel)
         FROM updated_batch
     )
       SELECT batch_id, name, channel FROM updated_batch`,
      [batchId, safeName, safeChannel, String(updatedBy || 'super-admin').slice(0, 255)]
    )
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      const conflict = new Error('批次名称已存在')
      conflict.code = 'BATCH_EXISTS'
      throw conflict
    }
    throw error
  }
  return rows?.[0] || null
}

export async function exportMembershipCodeBatch(batchId, { exportedBy } = {}) {
  if (!UUID_PATTERN.test(String(batchId || ''))) {
    const error = new Error('批次不存在')
    error.code = 'BATCH_NOT_FOUND'
    throw error
  }
  const rows = await neonHelper.query(
    `SELECT c.code_ciphertext, c.member_type, c.duration_months, c.generated_at,
            c.expires_at, c.redeemed_at, c.redeemed_by_user_id, c.voided_at,
            c.distributed_at, c.distributed_by,
            b.name AS batch_name, b.channel, ${codeStatusSql('c')} AS status
       FROM membership_redemption_codes c
       JOIN membership_code_batches b ON b.batch_id = c.batch_id
      WHERE b.batch_id = $1::uuid
      ORDER BY c.generated_at, c.code_id`,
    [batchId]
  )
  const auditRows = await neonHelper.query(
    `INSERT INTO membership_code_admin_audit (
       action, admin_user_id, batch_id, details
     )
     SELECT 'export', $2, batch_id,
            jsonb_build_object('codeCount', $3::int)
       FROM membership_code_batches
      WHERE batch_id = $1::uuid
     RETURNING audit_id`,
    [batchId, String(exportedBy || 'super-admin').slice(0, 255), rows?.length || 0]
  )
  if (!auditRows?.[0]) {
    const error = new Error('批次不存在')
    error.code = 'BATCH_NOT_FOUND'
    throw error
  }
  return (rows || []).map(row => ({
    code: decryptRedemptionCode(row.code_ciphertext),
    memberType: row.member_type,
    durationMonths: Number(row.duration_months),
    batchName: row.batch_name,
    channel: row.channel,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    status: row.status,
    distributed: Boolean(row.distributed_at),
    distributedAt: row.distributed_at,
    distributedBy: row.distributed_by,
    redeemedAt: row.redeemed_at,
    redeemedByUserId: row.redeemed_by_user_id
  }))
}

export const membershipCodePlanDefinitions = PLAN_DEFINITIONS
