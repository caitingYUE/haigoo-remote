-- ============================================================
-- Copilot V1.3 数据库迁移脚本
-- 日期: 2026-02-23
-- 说明: 新增 3 张表 + 1 个字段，支持状态驱动型 Copilot
-- 环境: 请先在预发环境数据库执行
-- ============================================================

-- 1. 用户 Copilot 状态表（每用户一行，核心状态中心）
CREATE TABLE IF NOT EXISTS copilot_user_state (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,

    -- 简历结构化数据（M1/M2/M4共用）
    resume_structured JSONB,
    resume_version INT DEFAULT 0,

    -- 适配度评估结果（M1）
    readiness_data JSONB,
    readiness_generated_at TIMESTAMPTZ,

    -- 当前阶段（M3）
    current_phase VARCHAR(50) DEFAULT 'not_started',
    plan_data JSONB,

    -- 进度统计
    applied_count INT DEFAULT 0,
    interview_count INT DEFAULT 0,

    -- 时间追踪
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 任务跟踪表（M3 行动推进系统）
CREATE TABLE IF NOT EXISTS copilot_tasks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    priority VARCHAR(10) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_tasks_user ON copilot_tasks(user_id, status);

-- 3. 岗位匹配缓存表（M2 动态匹配结果）
CREATE TABLE IF NOT EXISTS copilot_job_matches (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
    job_id VARCHAR(255),
    match_score INT,
    match_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_job_matches_user ON copilot_job_matches(user_id, match_score DESC);

-- 4. 为现有 copilot_sessions 增加 module 字段（区分不同模块调用）
ALTER TABLE copilot_sessions ADD COLUMN IF NOT EXISTS module VARCHAR(30) DEFAULT 'generate';

-- ============================================================
-- 验证: 执行后可运行以下查询确认表已创建
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'copilot%';
-- ============================================================
