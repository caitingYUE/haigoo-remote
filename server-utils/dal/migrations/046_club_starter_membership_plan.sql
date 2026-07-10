-- 2026-07-09: Add Club Starter monthly membership plan and refresh Club service copy.
-- Existing legacy plans are preserved; only the Club service plan keys below are merged.

INSERT INTO system_settings (key, value, description, updated_at)
VALUES (
  'membership_plan_config',
  '{
    "starter": {
      "id": "club_starter_monthly",
      "enabled": true,
      "name": "Club Starter",
      "shortLabel": "Starter",
      "price": 99,
      "currency": "CNY",
      "duration_days": 31,
      "duration_months": 1,
      "isPlus": false,
      "discountLabel": "工具服务",
      "description": "适合远程入门或目标明确、希望通过网站信息和工具高效推进投递的用户。",
      "features": [
        "全部精选岗位资源",
        "全部申请路径和联系人信息",
        "完整远程职业成长权益",
        "AI 简历优化、岗位订阅等工具",
        "纯网站工具服务，不含语音咨询"
      ]
    },
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
      "description": "适合正在认真探索远程工作，希望获得长期岗位资源、社群陪伴和求职支持的用户。",
      "features": [
        "全部精选岗位资源",
        "全部申请路径和联系人信息",
        "完整远程职业成长权益",
        "AI 简历优化、岗位订阅等工具",
        "30-60 分钟语音 1V1 咨询"
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
      "description": "适合希望长期探索远程职业机会，并沉淀个人职业资源或协作资源的用户。",
      "features": [
        "Club Member 全部权益",
        "1 次远程求职规划",
        "优先参与会员闭门交流",
        "可申请成为共建伙伴",
        "企业岗位发布与品牌传播支持额度（1季度1次）"
      ]
    }
  }'::jsonb,
  'Membership plan config including Club Starter, Club Member and Club Partner service plans',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = COALESCE(system_settings.value, '{}'::jsonb) || EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

UPDATE member_service_entitlement_definitions
SET description = '半年/年度会员包含 1 次 30-60 分钟语音咨询。',
    updated_at = NOW()
WHERE entitlement_key = 'voice_consultation_30m';

COMMENT ON COLUMN users.member_type IS 'Membership service type. Legacy values such as trial_week, quarter, quarter_pro and year are preserved; Club service values include starter, half_year and annual.';
