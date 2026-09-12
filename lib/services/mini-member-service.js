import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'
import { getContinuousMembershipExpireAt } from './membership-redemption-code-service.js'

export const MINI_HALF_YEAR_SERVICE_KEYS = [
  'career_direction_diagnosis',
  'bilingual_resume_optimization',
  'custom_job_search_materials'
]

const SERVICE_LABELS = {
  career_direction_diagnosis: '职业方向诊断指导',
  bilingual_resume_optimization: '中英文简历优化',
  custom_job_search_materials: '定制求职材料包'
}

function requireHalfYearMember(user) {
  const membership = deriveMembershipCapabilities(user)
  if (!membership.isActive || membership.memberType !== 'half_year') {
    throw Object.assign(new Error('该服务仅对有效半年会员开放'), {
      statusCode: 403,
      code: 'MEMBERSHIP_REQUIRED'
    })
  }
  return membership
}

export async function ensureHalfYearServiceEntitlements(userId) {
  await neonHelper.query('SELECT ensure_mini_half_year_services($1, $2::text[])', [userId, MINI_HALF_YEAR_SERVICE_KEYS])
}

function publicEntitlement(row) {
  const serviceStatus = String(row.service_status || '')
  const status = ['unavailable', 'expired'].includes(String(row.status)) || Number(row.refunded_amount_cents || 0) > 0 && ['available','unused','not_scheduled'].includes(row.status) || Number(row.remaining_quota ?? 1) <= 0 && !['completed','used'].includes(row.status)
    ? 'unavailable'
    : serviceStatus === 'in_progress'
    ? 'in_progress'
    : serviceStatus === 'completed'
      ? 'completed'
      : serviceStatus === 'scheduled'
        ? 'requested'
        : String(row.status || 'available') === 'requested'
          ? 'requested'
          : String(row.status || 'available') === 'completed'
            ? 'completed'
            : 'available'
  return {
    key: String(row.entitlement_key || ''),
    title: SERVICE_LABELS[row.entitlement_key] || String(row.name || ''),
    description: String(row.description || ''),
    status,
    totalQuota: Number(row.total_quota ?? 1),
    remainingQuota: Number(row.remaining_quota ?? 1),
    expiresAt: row.expires_at || null,
    updatedAt: row.service_updated_at || row.updated_at || null
  }
}

export async function getMiniMemberServices(user) {
  const membership = deriveMembershipCapabilities(user)
  const memberExpireAt = await getContinuousMembershipExpireAt(user)
  const isActiveHalfYear = membership.isActive && membership.memberType === 'half_year'
  if (isActiveHalfYear) await ensureHalfYearServiceEntitlements(user.user_id, user.member_expire_at || null)
  const rows = await neonHelper.query(
    `SELECT entitlements.*, definitions.name, definitions.description, p.refunded_amount_cents,
            service.status AS service_status, service.updated_at AS service_updated_at
       FROM user_member_service_entitlements entitlements
       JOIN member_service_entitlement_definitions definitions
         ON definitions.entitlement_key = entitlements.entitlement_key
       LEFT JOIN payment_records p ON p.payment_id = entitlements.metadata->>'sourcePaymentId'
       LEFT JOIN member_crm_service_records service
         ON service.user_id = entitlements.user_id
        AND service.entitlement_key = entitlements.entitlement_key
        AND service.archived_at IS NULL
      WHERE entitlements.user_id = $1
        AND entitlements.entitlement_key = ANY($2::text[])
      ORDER BY definitions.sort_order ASC`,
    [user.user_id, MINI_HALF_YEAR_SERVICE_KEYS]
  )
  return {
    membership: {
      isMember: membership.isActive,
      memberType: membership.memberType,
      memberExpireAt
    },
    // Keep already-issued service history visible after expiry. This query
    // never grants a new entitlement; claimMiniMemberService still requires
    // an active half-year membership.
    entitlements: (rows || []).map(publicEntitlement)
  }
}

export async function claimMiniMemberService(user, entitlementKey) {
  requireHalfYearMember(user)
  const key = String(entitlementKey || '').trim()
  if (!MINI_HALF_YEAR_SERVICE_KEYS.includes(key)) {
    throw Object.assign(new Error('服务权益参数无效'), { statusCode: 400 })
  }
  await ensureHalfYearServiceEntitlements(user.user_id, user.member_expire_at || null)
  const client = neonHelper.getClient()
  const results = await client.transaction([
    client.query("SELECT pg_advisory_xact_lock(hashtextextended('membership-redemption-user:' || $1, 0))", [user.user_id]),
    client.query('SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE', [user.user_id]),
    client.query(
    `WITH before_state AS (
       SELECT * FROM user_member_service_entitlements
        WHERE user_id = $1 AND entitlement_key = $2
     ), updated AS (
       UPDATE user_member_service_entitlements
          SET status = CASE WHEN status = 'completed' THEN status ELSE 'requested' END,
              updated_at = NOW()
        WHERE user_id = $1 AND entitlement_key = $2
          AND status IN ('available', 'unused', 'not_scheduled', 'requested')
          AND COALESCE(remaining_quota, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM payment_records p WHERE p.payment_id = user_member_service_entitlements.metadata->>'sourcePaymentId' AND p.refunded_amount_cents > 0)
          AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = $1 AND u.member_type = 'half_year'
            AND u.member_status IN ('active','pro') AND u.member_expire_at > NOW()
            AND (u.member_cycle_start_at IS NULL OR u.member_cycle_start_at <= NOW()))
        RETURNING *
     ), service AS (
       INSERT INTO member_crm_service_records (
         user_id, entitlement_key, service_type, title, status, details, created_at, updated_at
       ) SELECT $1, $2, 'member_service', $3, 'planned', '用户从小程序申请领取', NOW(), NOW() FROM updated
       ON CONFLICT (user_id, entitlement_key) WHERE archived_at IS NULL AND entitlement_key IS NOT NULL
       DO UPDATE SET updated_at = member_crm_service_records.updated_at
       RETURNING id, status, updated_at
     ), audit AS (
       INSERT INTO user_member_service_entitlement_audit (
         user_id, entitlement_key, before_snapshot, after_snapshot, reason, created_at
       )
       SELECT $1, $2, to_jsonb(before_state), to_jsonb(updated), 'mini_member_service_claim', NOW()
         FROM before_state, updated
       WHERE before_state.status IS DISTINCT FROM updated.status
       RETURNING id
     ), crm_audit AS (
       INSERT INTO member_crm_audit_log (
         target_user_id, admin_user_id, action, entity_type, entity_id,
         changed_fields, metadata, created_at
       )
       SELECT $1, NULL, 'mini_member_service_claim', 'service_record', service.id::text,
              '["status"]'::jsonb,
              jsonb_build_object('entitlementKey', $2, 'source', 'mini_program'),
              NOW()
         FROM before_state, updated, service
        WHERE before_state.status IS DISTINCT FROM updated.status
       RETURNING id
     )
     SELECT updated.*, service.id AS service_record_id,
            service.status AS service_status, service.updated_at AS service_updated_at
       FROM updated CROSS JOIN service`,
    [user.user_id, key, SERVICE_LABELS[key]]
    )
  ], { isolationLevel: 'ReadCommitted' })
  const rows = results[2]
  if (!rows?.[0]) throw new Error('服务申请没有完成，请稍后重试')
  return publicEntitlement(rows[0])
}
