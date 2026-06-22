-- Member service entitlement management.
-- This keeps website membership status fields unchanged and adds an operator-managed
-- layer for service usage status, remaining quota, and expiration.

CREATE TABLE IF NOT EXISTS member_service_entitlement_definitions (
  entitlement_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_status TEXT NOT NULL DEFAULT 'available',
  default_total_quota INTEGER,
  applicable_member_types TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_member_service_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL REFERENCES member_service_entitlement_definitions(entitlement_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'available',
  total_quota INTEGER,
  used_quota INTEGER NOT NULL DEFAULT 0,
  remaining_quota INTEGER,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entitlement_key),
  CONSTRAINT user_member_service_entitlements_status_check CHECK (
    status IN (
      'available',
      'not_scheduled',
      'scheduled',
      'completed',
      'reviewing',
      'approved',
      'expired',
      'unavailable',
      'unused',
      'used',
      'registered',
      'attended',
      'not_applied',
      'rejected',
      'requested',
      'published'
    )
  ),
  CONSTRAINT user_member_service_entitlements_quota_check CHECK (
    total_quota IS NULL OR total_quota >= 0
  ),
  CONSTRAINT user_member_service_entitlements_used_check CHECK (used_quota >= 0),
  CONSTRAINT user_member_service_entitlements_remaining_check CHECK (
    remaining_quota IS NULL OR remaining_quota >= 0
  )
);

CREATE TABLE IF NOT EXISTS user_member_service_entitlement_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_member_service_entitlements_user
  ON user_member_service_entitlements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_member_service_entitlements_status
  ON user_member_service_entitlements(status);

INSERT INTO member_service_entitlement_definitions
  (entitlement_key, name, description, default_status, default_total_quota, applicable_member_types, sort_order)
VALUES
  ('voice_consultation_30m', '语音 1V1 远程咨询', '半年/年度会员包含 1 次 30 分钟语音咨询。', 'not_scheduled', 1, ARRAY['half_year','annual','quarter_pro','year'], 10),
  ('annual_career_planning', '年度远程求职规划', '年度会员专属，适合制定长期求职目标和行动计划。', 'not_scheduled', 1, ARRAY['annual','year'], 20),
  ('closed_member_event', '会员闭门交流', '记录会员闭门交流或活动参与次数。', 'available', 1, ARRAY['annual'], 30),
  ('co_builder_application', '共建伙伴权益', '年度会员入职远程企业后可申请，后台记录审核状态。', 'not_applied', 1, ARRAY['annual'], 40),
  ('employer_branding_credit', '岗位发布额度', '记录共建伙伴岗位发布与雇主品牌宣传额度。', 'unused', 1, ARRAY['annual'], 50)
ON CONFLICT (entitlement_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_status = EXCLUDED.default_status,
  default_total_quota = EXCLUDED.default_total_quota,
  applicable_member_types = EXCLUDED.applicable_member_types,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

UPDATE member_service_entitlement_definitions
SET enabled = FALSE, updated_at = NOW()
WHERE entitlement_key IN ('resume_ai_suggestion', 'corporate_english_tool');

CREATE TABLE IF NOT EXISTS member_service_plan_configs (
  member_type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO member_service_plan_configs
  (member_type, name, price_cents, billing_label, description, features, is_enabled, sort_order)
VALUES
  (
    'half_year',
    'Club Member',
    49900,
    '半年',
    '适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。',
    '["全部精选岗位资源","全部申请路径和联系人信息","全部外企英语/企业文化/CEO等材料","AI 简历优化等辅助建议","1 次 30 分钟语音 1V1 咨询"]'::jsonb,
    TRUE,
    10
  ),
  (
    'annual',
    'Club Partner',
    99800,
    '年',
    '适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。',
    '["Club Member 全部权益","1 次远程求职规划","优先参与会员闭门交流","可申请成为共建伙伴","企业岗位发布与品牌传播支持额度（1季度1次）"]'::jsonb,
    TRUE,
    20
  )
ON CONFLICT (member_type) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  billing_label = EXCLUDED.billing_label,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
