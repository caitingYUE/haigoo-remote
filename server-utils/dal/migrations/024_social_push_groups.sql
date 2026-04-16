-- Description: Social push groups, versioned role sets, grouped runs, history and overrides

CREATE TABLE IF NOT EXISTS social_push_groups (
    id BIGSERIAL PRIMARY KEY,
    internal_name VARCHAR(120) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_push_groups_active_sort
    ON social_push_groups(is_active, sort_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS social_push_group_versions (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES social_push_groups(id) ON DELETE CASCADE,
    internal_name VARCHAR(120) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    selected_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_social_push_group_versions_effective
    ON social_push_group_versions(group_id, effective_date DESC);

ALTER TABLE social_push_group_versions
    ADD COLUMN IF NOT EXISTS internal_name VARCHAR(120);

ALTER TABLE social_push_group_versions
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;

ALTER TABLE social_push_group_versions
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE social_push_group_versions v
SET
    internal_name = COALESCE(NULLIF(v.internal_name, ''), g.internal_name, '默认分组'),
    sort_order = COALESCE(v.sort_order, g.sort_order, 100),
    is_active = COALESCE(v.is_active, g.is_active, true)
FROM social_push_groups g
WHERE g.id = v.group_id
  AND (
      v.internal_name IS NULL
      OR v.sort_order IS NULL
      OR v.is_active IS NULL
  );

CREATE TABLE IF NOT EXISTS social_push_runs (
    id BIGSERIAL PRIMARY KEY,
    batch_date DATE NOT NULL,
    group_id BIGINT NOT NULL REFERENCES social_push_groups(id) ON DELETE CASCADE,
    audience_key VARCHAR(20) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    target_count INTEGER NOT NULL DEFAULT 3,
    job_count INTEGER NOT NULL DEFAULT 0,
    subject VARCHAR(255),
    payload JSONB,
    error TEXT,
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, group_id, audience_key)
);

CREATE INDEX IF NOT EXISTS idx_social_push_runs_batch
    ON social_push_runs(batch_date DESC, group_id, audience_key);

CREATE TABLE IF NOT EXISTS social_push_history (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES social_push_runs(id) ON DELETE SET NULL,
    batch_date DATE NOT NULL,
    group_id BIGINT NOT NULL REFERENCES social_push_groups(id) ON DELETE CASCADE,
    audience_key VARCHAR(20) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, group_id, audience_key, job_id)
);

CREATE INDEX IF NOT EXISTS idx_social_push_history_recent
    ON social_push_history(group_id, audience_key, batch_date DESC);

CREATE TABLE IF NOT EXISTS social_push_overrides (
    id BIGSERIAL PRIMARY KEY,
    batch_date DATE NOT NULL,
    group_id BIGINT NOT NULL REFERENCES social_push_groups(id) ON DELETE CASCADE,
    audience_key VARCHAR(20) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL DEFAULT 'removed',
    replacement_job_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, group_id, audience_key, job_id, action)
);

CREATE INDEX IF NOT EXISTS idx_social_push_overrides_batch
    ON social_push_overrides(batch_date DESC, group_id, audience_key);

INSERT INTO social_push_groups (internal_name, sort_order, is_active)
SELECT '默认分组', 1, true
WHERE NOT EXISTS (
    SELECT 1 FROM social_push_groups WHERE internal_name = '默认分组'
);

INSERT INTO social_push_group_versions (group_id, internal_name, sort_order, is_active, selected_roles, effective_date)
SELECT
    g.id,
    g.internal_name,
    g.sort_order,
    g.is_active,
    '["后端开发","前端开发","全栈开发","移动开发","数据开发","服务器开发","算法工程师","测试/QA","运维/SRE","网络安全","操作系统/内核","技术支持","硬件开发","架构师","CTO/技术管理","产品经理","产品设计","UI/UX设计","视觉设计","平面设计","用户研究","市场营销","销售","客户经理","客户服务","运营","增长黑客","内容创作","人力资源","招聘","财务","法务","行政","管理","数据分析","商业分析","数据科学","教育培训","咨询","投资","其他"]'::jsonb,
    CURRENT_DATE
FROM social_push_groups g
WHERE g.internal_name = '默认分组'
  AND NOT EXISTS (
      SELECT 1
      FROM social_push_group_versions v
      WHERE v.group_id = g.id
  );
