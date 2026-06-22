-- 2026-06-21: Add Haigoo Remote Club half-year and annual membership service plans.
-- Existing legacy plans are intentionally preserved for historical users and backend compatibility.

INSERT INTO system_settings (key, value, description, updated_at)
VALUES (
  'membership_plan_config',
  '{
    "half_year": {
      "id": "club_half_year",
      "enabled": true,
      "name": "Club Member",
      "shortLabel": "Club Member",
      "price": 499,
      "currency": "CNY",
      "duration_days": 183,
      "duration_months": 6,
      "isPlus": true,
      "discountLabel": "长期陪伴",
      "description": "适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。",
      "features": [
        "全部精选岗位资源",
        "全部申请路径和联系人信息",
        "全部外企英语/企业文化/CEO等材料",
        "AI 简历优化等辅助建议",
        "1 次 30 分钟语音 1V1 咨询"
      ]
    },
    "annual": {
      "id": "club_annual",
      "enabled": true,
      "name": "Club Partner",
      "shortLabel": "Club Partner",
      "price": 998,
      "currency": "CNY",
      "duration_days": 365,
      "duration_months": 12,
      "isPlus": true,
      "discountLabel": "推荐｜适合 HR / 品牌 / 市场 / 运营",
      "description": "适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。",
      "features": [
        "Club Member 全部权益",
        "1 次远程求职规划",
        "优先参与会员闭门交流",
        "可申请成为共建伙伴",
        "企业岗位发布与品牌传播支持额度（1季度1次）"
      ]
    }
  }'::jsonb,
  'Membership plan config including legacy plans plus Haigoo Remote Club half-year and annual service plans',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = COALESCE(system_settings.value, '{}'::jsonb) || EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

COMMENT ON COLUMN users.member_type IS 'Membership service type. Legacy values such as trial_week, quarter, quarter_pro and year are preserved; new Club service values include half_year and annual.';
