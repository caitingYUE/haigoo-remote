-- Neon数据库DDL脚本
-- 此脚本包含项目所需的所有表结构定义
-- 只追加，不修改和删除已有的建表语句！！

-- users - 存储用户信息
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  avatar VARCHAR(255),
  auth_provider VARCHAR(50),
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  verification_token VARCHAR(255),
  verification_expires TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  roles JSONB DEFAULT '{}',
  last_login_at TIMESTAMP,
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化管理员账号(密码123456，仅预发环境通过此方式)
-- INSERT INTO users (user_id, email, password_hash, username, status, roles)
-- VALUES ('admin-1', 'caitlinyct@gmail.com', '$2b$10$/MXqVv06y6pPb39e1NXRiuEmUC6dbFsIaMVBZNmx9iIjP8x6j40dG', '超级管理员', 'active', '{"admin": true}')
-- ON CONFLICT (email) DO NOTHING;
-- INSERT INTO users (user_id, email, password_hash, username, status, roles)
-- VALUES ('admin-2', 'mrzhangzy1996@gmail.com', '$2b$10$/MXqVv06y6pPb39e1NXRiuEmUC6dbFsIaMVBZNmx9iIjP8x6j40dG', '超级管理员', 'active', '{"admin": true}')
-- ON CONFLICT (email) DO NOTHING;

-- jobs - 存储岗位信息
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(200) NOT NULL,
  location VARCHAR(200) DEFAULT 'Remote',
  description TEXT,
  url VARCHAR(2000),
  published_at TIMESTAMP NOT NULL,
  source VARCHAR(100) DEFAULT 'unknown',
  category VARCHAR(100) DEFAULT '其他',
  salary VARCHAR(200),
  job_type VARCHAR(50) DEFAULT 'full-time',
  experience_level VARCHAR(50) DEFAULT 'Mid',
  tags JSONB DEFAULT '[]',
  requirements JSONB DEFAULT '[]',
  benefits JSONB DEFAULT '[]',
  is_remote BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'active',
  region VARCHAR(50) DEFAULT 'overseas',
  translations JSONB,
  is_translated BOOLEAN DEFAULT false,
  translated_at TIMESTAMP,
  company_id VARCHAR(255),
  source_type VARCHAR(50) DEFAULT 'rss',
  is_trusted BOOLEAN DEFAULT false,
  can_refer BOOLEAN DEFAULT false,
  company_logo VARCHAR(2000),
  company_website VARCHAR(2000),
  company_description TEXT,
  industry VARCHAR(100),
  company_tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- favorites - 存储用户收藏的工作
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  job_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id)
);

-- raw_rss - 存储原始RSS数据
CREATE TABLE raw_rss (
  id SERIAL PRIMARY KEY,
  raw_id VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(100) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  url VARCHAR(2000),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  link VARCHAR(2000),
  pub_date TIMESTAMP NOT NULL,
  raw_content TEXT,
  fetched_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'raw',
  processing_error VARCHAR(2000) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- subscriptions - 存储用户订阅信息
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  channel VARCHAR(100) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  topic VARCHAR(500) NOT NULL,
  user_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, identifier)
);

-- resumes - 存储简历信息
CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  resume_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  file_name VARCHAR(500),
  file_size INTEGER,
  file_type VARCHAR(100),
  parse_status VARCHAR(50) DEFAULT 'pending',
  parse_result JSONB,
  parse_error TEXT,
  content_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- resume_stats - 存储简历统计信息
CREATE TABLE resume_stats (
  id SERIAL PRIMARY KEY,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  storage_provider VARCHAR(50) DEFAULT 'neon',
  estimated_size INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- trusted_companies - 存储可信企业信息
CREATE TABLE trusted_companies (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  website VARCHAR(2000),
  description TEXT,
  logo VARCHAR(2000),
  cover_image TEXT,
  industry VARCHAR(100) DEFAULT '其他',
  tags JSONB DEFAULT '[]',
  source VARCHAR(50) DEFAULT 'manual',
  job_count INTEGER DEFAULT 0,
  can_refer BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- extracted_companies - 存储从岗位数据提取的企业信息
CREATE TABLE extracted_companies (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  url VARCHAR(2000),
  description TEXT,
  logo VARCHAR(2000),
  cover_image TEXT,
  industry VARCHAR(100) DEFAULT '其他',
  tags JSONB DEFAULT '[]',
  source VARCHAR(50) DEFAULT 'extracted',
  job_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- company_stats - 存储企业统计信息
CREATE TABLE company_stats (
  id SERIAL PRIMARY KEY,
  total_companies INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  active_companies INTEGER DEFAULT 0,
  last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- tag_config - 存储标签配置信息
CREATE TABLE tag_config (
  id SERIAL PRIMARY KEY,
  config_type VARCHAR(50) NOT NULL,
  config_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(config_type)
);

-- feedbacks - 存储用户反馈信息
CREATE TABLE feedbacks (
  id SERIAL PRIMARY KEY,
  feedback_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  accuracy INTEGER DEFAULT 0,
  content TEXT,
  contact TEXT,
  source VARCHAR(100),
  source_url VARCHAR(2000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- recommendations - 存储用户推荐信息
CREATE TABLE recommendations (
  id SERIAL PRIMARY KEY,
  recommendation_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  content TEXT,
  contact TEXT,
  source VARCHAR(100),
  source_url VARCHAR(2000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- location_categories - 存储地址分类配置
CREATE TABLE location_categories (
  id SERIAL PRIMARY KEY,
  config_id VARCHAR(255) UNIQUE NOT NULL,
  categories JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- user_profile_stats - 存储用户资料统计信息
CREATE TABLE user_profile_stats (
  id SERIAL PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  total_favorites INTEGER DEFAULT 0,
  total_feedbacks INTEGER DEFAULT 0,
  total_recommendations INTEGER DEFAULT 0,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- payment_records - 存储支付记录
CREATE TABLE payment_records (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  plan_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-04: Add membership fields to users table
-- ALTER TABLE users ADD COLUMN membership_level VARCHAR(50) DEFAULT 'none';
-- ALTER TABLE users ADD COLUMN membership_start_at TIMESTAMP;
-- ALTER TABLE users ADD COLUMN membership_expire_at TIMESTAMP;

-- 2025-12-05: Add user_job_matches table for caching match results
CREATE TABLE user_job_matches (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  match_score INTEGER NOT NULL,  -- 0-100
  match_details JSONB,           -- 详细分数breakdown
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,          -- 缓存过期时间
  UNIQUE(user_id, job_id)
);
CREATE INDEX idx_matches_user_score ON user_job_matches(user_id, match_score DESC);


-- 2025-12-06: Add file_content column to resumes table for persistent preview
ALTER TABLE resumes ADD COLUMN file_content TEXT;

-- 2025-12-06: Add careers_page and linkedin columns to trusted_companies table
ALTER TABLE trusted_companies ADD COLUMN careers_page VARCHAR(2000);
ALTER TABLE trusted_companies ADD COLUMN linkedin VARCHAR(2000);

-- 2025-12-06: Remove culture fields as they are no longer needed
-- The following fields were added but then decided to be removed
-- ALTER TABLE trusted_companies ADD COLUMN culture TEXT;
-- ALTER TABLE trusted_companies ADD COLUMN founder_intro TEXT;
-- ALTER TABLE trusted_companies ADD COLUMN culture_image TEXT;
-- ALTER TABLE trusted_companies ADD COLUMN show_culture_on_home BOOLEAN DEFAULT false;

ALTER TABLE trusted_companies DROP COLUMN IF EXISTS culture;
ALTER TABLE trusted_companies DROP COLUMN IF EXISTS founder_intro;
ALTER TABLE trusted_companies DROP COLUMN IF EXISTS culture_image;
ALTER TABLE trusted_companies DROP COLUMN IF EXISTS show_culture_on_home;

-- 2025-12-11: Add translations column to trusted_companies table
ALTER TABLE trusted_companies ADD COLUMN translations JSONB;
ALTER TABLE extracted_companies ADD COLUMN translations JSONB;

-- 2025-12-14: Add AI analysis fields to resumes table
ALTER TABLE resumes ADD COLUMN ai_score INTEGER;
ALTER TABLE resumes ADD COLUMN ai_suggestions JSONB;
ALTER TABLE resumes ADD COLUMN last_analyzed_at TIMESTAMP;

-- 2025-12-14: Add club_applications table
CREATE TABLE club_applications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  experience TEXT,
  career_ideal TEXT,
  portfolio VARCHAR(2000),
  expectations TEXT,
  contribution TEXT,
  contact TEXT,
  contact_type VARCHAR(50) DEFAULT 'wechat',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-14: Add reply fields to feedbacks
ALTER TABLE feedbacks ADD COLUMN reply_content TEXT;
ALTER TABLE feedbacks ADD COLUMN replied_at TIMESTAMP;

-- 2025-12-14: Create notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'system', 'feedback_reply', 'application_update'
  title VARCHAR(200) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- 2025-12-15: Add subscription tracking fields
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS fail_count INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'daily';

-- 2025-12-16: Add nickname field for Feishu subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- 2025-12-17: Add last_crawled_at to trusted_companies
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMP;

-- 2025-12-17: Add is_manually_edited to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT false;

-- 2025-12-17: Add system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exist
INSERT INTO system_settings (key, value, description)
VALUES 
  ('ai_translation_enabled', 'false'::jsonb, 'Whether to enable paid AI translation services (DeepSeek/Bailian)'),
  ('ai_token_usage', '{"input": 0, "output": 0, "total": 0}'::jsonb, 'Token usage statistics for AI services')
ON CONFLICT (key) DO NOTHING;

-- 2025-12-17: Add Haigoo Member fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS risk_rating JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS haigoo_comment TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hidden_fields JSONB;

-- 2025-12-17: Add user_job_interactions table for tracking referrals and applications
CREATE TABLE IF NOT EXISTS user_job_interactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(50) NOT NULL, -- 'referral', 'view', 'apply'
  resume_id VARCHAR(255),
  notes TEXT,
  status VARCHAR(50), -- 'applied', 'viewed', 'interviewing', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, job_id, interaction_type)
);

-- 2025-12-18: Add nickname to club_applications
ALTER TABLE club_applications ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- 2025-12-18: Ensure membership fields in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_level VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_start_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expire_at TIMESTAMP;

-- 2025-12-18: Add new unified member system fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_since TIMESTAMP;

-- 2025-12-18: 新增会员体系字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_since TIMESTAMP;
-- 兼容旧字段
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_level VARCHAR(50) DEFAULT 'none';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_start_at TIMESTAMP;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expire_at TIMESTAMP;

-- 2025-12-19: 新增会员编号字段 (需手动执行)
-- 创建序列，从 100001 开始
-- CREATE SEQUENCE IF NOT EXISTS member_id_seq START 100001;
-- 添加字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_display_id INTEGER;
-- 初始化现有会员的编号 (可选，如果想给老会员补号)
-- UPDATE users SET member_display_id = nextval('member_id_seq') WHERE member_status = 'active' AND member_display_id IS NULL;

-- 2025-12-19: 新增企业认证信息字段 (LinkedIn Info)
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS address VARCHAR(500); -- 总部地址
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS employee_count VARCHAR(100); -- 员工人数
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS founded_year VARCHAR(50); -- 成立年份
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'; -- 领域/专长

-- 2025-12-20: Add missing rating fields
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS company_rating VARCHAR(50); -- 企业评分 (e.g. 4.5/5)
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS rating_source VARCHAR(100); -- 评分来源 (e.g. Glassdoor, Blind)

-- 2025-12-21: bug_reports - 存储Bug提报信息
CREATE TABLE bug_reports (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  user_nickname VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  image_url TEXT, -- Store Base64 data or URL
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-21: jobs表的company_id加索引，因为常用来跟 company 表关联查询
CREATE INDEX idx_jobs_company_id ON jobs (company_id);

-- 2025-12-22: Update bug_reports table
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS contact_info TEXT;

-- 2025-12-22: Add application_source to user_job_interactions
ALTER TABLE user_job_interactions ADD COLUMN IF NOT EXISTS application_source VARCHAR(50);

-- 2025-12-22: Ensure is_featured column exists in jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- 2025-12-22: Add index for trusted_companies name to optimize sync-jobs JOIN performance
-- Note: Using lower case index to support case-insensitive matching
CREATE INDEX IF NOT EXISTS idx_trusted_companies_name_lower ON trusted_companies (lower(name));
CREATE INDEX IF NOT EXISTS idx_jobs_company_lower ON jobs (lower(company));

-- 2025-12-23 修复 club_applications 缺少 updated_at 字段的问题
ALTER TABLE club_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- 2025-12-24 新增 rss_sources 表，用于动态管理 RSS 源
CREATE TABLE IF NOT EXISTS rss_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  category VARCHAR(100) DEFAULT '其他',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-24 新增 analytics_events 表，用于全链路数据埋点
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  anonymous_id VARCHAR(255),
  event_name VARCHAR(255) NOT NULL,
  properties JSONB,
  url TEXT,
  referrer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);