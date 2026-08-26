import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'

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

export async function ensureHalfYearServiceEntitlements(userId, expiresAt = null) {
  await neonHelper.query(
    `INSERT INTO user_member_service_entitlements (
       user_id, entitlement_key, status, total_quota, used_quota, remaining_quota,
       expires_at, metadata, notes, created_at, updated_at
     )
     SELECT $1, definitions.entitlement_key, 'available', 1, 0, 1, $2,
            '{"source":"mini_half_year_upgrade","existing_right":true}'::jsonb,
            '半年会员既有服务权益', NOW(), NOW()
       FROM member_service_entitlement_definitions definitions
      WHERE definitions.enabled = TRUE
        AND definitions.entitlement_key = ANY($3::text[])
     ON CONFLICT (user_id, entitlement_key) DO UPDATE SET
       expires_at = CASE
         WHEN user_member_service_entitlements.status = 'completed' THEN user_member_service_entitlements.expires_at
         ELSE EXCLUDED.expires_at
       END,
       updated_at = NOW()`,
    [userId, expiresAt, MINI_HALF_YEAR_SERVICE_KEYS]
  )
}

function publicEntitlement(row) {
  const serviceStatus = String(row.service_status || '')
  const status = serviceStatus === 'in_progress'
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
  const isActiveHalfYear = membership.isActive && membership.memberType === 'half_year'
  if (isActiveHalfYear) await ensureHalfYearServiceEntitlements(user.user_id, user.member_expire_at || null)
  const rows = await neonHelper.query(
    `SELECT entitlements.*, definitions.name, definitions.description,
            service.status AS service_status, service.updated_at AS service_updated_at
       FROM user_member_service_entitlements entitlements
       JOIN member_service_entitlement_definitions definitions
         ON definitions.entitlement_key = entitlements.entitlement_key
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
      memberExpireAt: user.member_expire_at || null
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
  const rows = await neonHelper.query(
    `WITH before_state AS (
       SELECT * FROM user_member_service_entitlements
        WHERE user_id = $1 AND entitlement_key = $2
     ), updated AS (
       UPDATE user_member_service_entitlements
          SET status = CASE WHEN status = 'completed' THEN status ELSE 'requested' END,
              updated_at = NOW()
        WHERE user_id = $1 AND entitlement_key = $2
        RETURNING *
     ), service AS (
       INSERT INTO member_crm_service_records (
         user_id, entitlement_key, service_type, title, status, details, created_at, updated_at
       ) VALUES ($1, $2, 'member_service', $3, 'planned', '用户从小程序申请领取', NOW(), NOW())
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
  if (!rows?.[0]) throw new Error('服务申请没有完成，请稍后重试')
  return publicEntitlement(rows[0])
}
