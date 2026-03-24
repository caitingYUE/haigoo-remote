ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_type VARCHAR(32) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS member_cycle_start_at TIMESTAMP NULL;

UPDATE users
SET member_type = CASE
  WHEN member_status IN ('active', 'expired', 'pro', 'lifetime') THEN 'quarter'
  ELSE 'none'
END
WHERE member_type IS NULL;

UPDATE users
SET member_type = 'quarter'
WHERE member_type = 'none'
  AND (member_status IN ('active', 'expired', 'pro', 'lifetime')
       OR membership_level IS NOT NULL
       OR member_expire_at IS NOT NULL
       OR membership_expire_at IS NOT NULL);

UPDATE users
SET member_cycle_start_at = COALESCE(member_since, created_at)
WHERE member_type <> 'none'
  AND member_cycle_start_at IS NULL;

INSERT INTO system_settings (key, value, description, updated_at)
VALUES (
  'membership_plan_config',
  '{
    "trial_week": {
      "id": "trial_week_lite",
      "enabled": true,
      "name": "海狗远程俱乐部体验会员（周）",
      "shortLabel": "体验会员",
      "liteLabel": "Lite",
      "price": 29.9,
      "currency": "CNY",
      "duration_days": 7,
      "wechat_qr": "/Wechatpay_mini.png",
      "alipay_qr": "/alipay_mini.jpg",
      "description": "适合先体验海狗核心岗位权益，快速验证匹配度与使用价值。",
      "discountLabel": "轻量试用 · 7天体验",
      "features": [
        "解锁全部高薪远程职位（含内推）",
        "解锁全部企业认证信息及联系方式",
        "AI 远程工作助手（无限次）",
        "AI 简历优化（无限次）",
        "岗位收藏、直接翻译等功能（无限次）",
        "加入精英远程工作者社区",
        "解锁精选企业名单"
      ]
    },
    "quarter": {
      "id": "club_go_quarterly",
      "enabled": true,
      "name": "海狗远程俱乐部会员（季度）",
      "shortLabel": "季度会员",
      "price": 199,
      "currency": "CNY",
      "duration_days": 90,
      "discountLabel": "灵活订阅 · 适合短期冲刺",
      "description": "适合短期冲刺的求职者，快速获得内推机会。",
      "features": [
        "解锁全部高薪远程职位（含内推）",
        "解锁全部企业认证信息及联系方式",
        "AI 远程工作助手（无限次）",
        "AI 简历优化（无限次）",
        "岗位收藏、直接翻译等功能（无限次）",
        "加入精英远程工作者社区",
        "解锁精选企业名单"
      ]
    },
    "year": {
      "id": "goo_plus_yearly",
      "enabled": true,
      "comingSoon": true,
      "name": "海狗远程俱乐部会员（年度）",
      "shortLabel": "年度会员",
      "price": 999,
      "currency": "CNY",
      "duration_days": 365,
      "description": "适合致力于长期职业发展的专业人士，建立个人品牌。",
      "features": [
        "包含季度会员所有权益",
        "1V1 远程求职咨询（1次，60分钟以内）",
        "专家简历精修 或 模拟面试（二选一）",
        "优先成为俱乐部城市主理人，共享收益",
        "合作企业优先定向直推"
      ]
    }
  }'::jsonb,
  'Membership plan config for trial, quarter and year plans',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
