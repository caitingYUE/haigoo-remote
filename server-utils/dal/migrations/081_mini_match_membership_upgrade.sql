-- Mini-program Match and half-year service upgrade.
-- Additive and idempotent; website plan configuration remains unchanged.

ALTER TABLE career_watch_profiles
  ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS wechat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wechat_template_status VARCHAR(24) NOT NULL DEFAULT 'not_requested';

-- Keep the immutable free result separate from the refreshable member feed so
-- expiry can always fall back to the original five companies.
ALTER TABLE career_watch_feed_snapshots
  ADD COLUMN IF NOT EXISTS fixed_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_watch_wechat_template_status_check'
  ) THEN
    ALTER TABLE career_watch_profiles
      ADD CONSTRAINT career_watch_wechat_template_status_check
      CHECK (wechat_template_status IN ('not_requested', 'accepted', 'rejected', 'unavailable'));
  END IF;
END $$;

INSERT INTO member_service_entitlement_definitions
  (entitlement_key, name, description, default_status, default_total_quota, applicable_member_types, sort_order, enabled)
VALUES
  ('career_direction_diagnosis', '职业方向诊断指导', '半年会员包含 1 次职业方向诊断指导。', 'available', 1, ARRAY['half_year'], 11, TRUE),
  ('bilingual_resume_optimization', '中英文简历优化', '半年会员包含 1 次中英文简历优化。', 'available', 1, ARRAY['half_year'], 12, TRUE),
  ('custom_job_search_materials', '定制求职材料包', '半年会员包含 1 次定制求职材料包。', 'available', 1, ARRAY['half_year'], 13, TRUE)
ON CONFLICT (entitlement_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_status = EXCLUDED.default_status,
  default_total_quota = EXCLUDED.default_total_quota,
  applicable_member_types = EXCLUDED.applicable_member_types,
  sort_order = EXCLUDED.sort_order,
  enabled = TRUE,
  updated_at = NOW();

-- Link one exact existing CRM delivery record per user and service before
-- adding new ledger rows. Ambiguous or archived records are left untouched.
WITH candidates AS (
  SELECT records.id,
         CASE
           WHEN records.service_type IN (
             'career_direction_diagnosis',
             'bilingual_resume_optimization',
             'custom_job_search_materials'
           ) THEN records.service_type
           WHEN BTRIM(records.title) = '职业方向诊断指导' THEN 'career_direction_diagnosis'
           WHEN BTRIM(records.title) = '中英文简历优化' THEN 'bilingual_resume_optimization'
           WHEN BTRIM(records.title) = '定制求职材料包' THEN 'custom_job_search_materials'
           ELSE NULL
         END AS mapped_key,
         ROW_NUMBER() OVER (
           PARTITION BY records.user_id,
             CASE
               WHEN records.service_type IN (
                 'career_direction_diagnosis',
                 'bilingual_resume_optimization',
                 'custom_job_search_materials'
               ) THEN records.service_type
               WHEN BTRIM(records.title) = '职业方向诊断指导' THEN 'career_direction_diagnosis'
               WHEN BTRIM(records.title) = '中英文简历优化' THEN 'bilingual_resume_optimization'
               WHEN BTRIM(records.title) = '定制求职材料包' THEN 'custom_job_search_materials'
               ELSE NULL
             END
           ORDER BY records.updated_at DESC, records.created_at DESC, records.id DESC
         ) AS rank
    FROM member_crm_service_records records
   WHERE records.archived_at IS NULL
     AND records.entitlement_key IS NULL
), mapped AS (
  SELECT id, mapped_key FROM candidates WHERE mapped_key IS NOT NULL AND rank = 1
)
UPDATE member_crm_service_records records
   SET entitlement_key = mapped.mapped_key,
       updated_at = NOW()
  FROM mapped
 WHERE records.id = mapped.id
   AND NOT EXISTS (
     SELECT 1 FROM member_crm_service_records existing
      WHERE existing.user_id = records.user_id
        AND existing.entitlement_key = mapped.mapped_key
        AND existing.archived_at IS NULL
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_crm_service_active_entitlement
  ON member_crm_service_records(user_id, entitlement_key)
  WHERE archived_at IS NULL AND entitlement_key IS NOT NULL;

-- Existing active half-year members already own these services. This only
-- creates missing ledger rows so the mini-program can display the same rights.
INSERT INTO user_member_service_entitlements (
  user_id, entitlement_key, status, total_quota, used_quota, remaining_quota,
  expires_at, metadata, notes, created_at, updated_at
)
SELECT users.user_id, definitions.entitlement_key,
       CASE WHEN service.status = 'completed' THEN 'completed'
            WHEN service.id IS NOT NULL THEN 'requested'
            ELSE 'available' END,
       1,
       CASE WHEN service.status = 'completed' THEN 1 ELSE 0 END,
       CASE WHEN service.status = 'completed' THEN 0 ELSE 1 END,
       users.member_expire_at,
       '{"source":"mini_half_year_upgrade","existing_right":true}'::jsonb,
       '现有半年会员权益账本补齐', NOW(), NOW()
  FROM users
 CROSS JOIN member_service_entitlement_definitions definitions
 LEFT JOIN LATERAL (
   SELECT records.id, records.status
     FROM member_crm_service_records records
    WHERE records.user_id = users.user_id
      AND records.entitlement_key = definitions.entitlement_key
      AND records.archived_at IS NULL
    ORDER BY records.updated_at DESC
    LIMIT 1
 ) service ON TRUE
 WHERE users.member_status = 'active'
   AND users.member_type = 'half_year'
   AND (users.member_expire_at IS NULL OR users.member_expire_at > NOW())
   AND definitions.entitlement_key IN (
     'career_direction_diagnosis',
     'bilingual_resume_optimization',
     'custom_job_search_materials'
   )
ON CONFLICT (user_id, entitlement_key) DO NOTHING;
