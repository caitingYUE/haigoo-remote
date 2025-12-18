-- Neon数据库DDL脚本
-- 此脚本包含项目所需的所有表结构定义

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
  location VARCHAR(200),
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- feedbacks - 存储用户反馈
CREATE TABLE feedbacks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  contact VARCHAR(200),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- favorites - 存储用户收藏
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id)
);

-- trusted_companies - 存储信任的公司列表
CREATE TABLE trusted_companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  logo VARCHAR(500),
  website VARCHAR(500),
  description TEXT,
  tags JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- extracted_companies - 存储从岗位中提取的公司
CREATE TABLE extracted_companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  source_job_id VARCHAR(255),
  count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- processed_jobs - 存储处理后的岗位信息
CREATE TABLE processed_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  salary VARCHAR(200),
  job_type VARCHAR(50),
  experience_level VARCHAR(50),
  category VARCHAR(100),
  tags JSONB DEFAULT '[]',
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  link VARCHAR(2000),
  source VARCHAR(50),
  pub_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- system_stats - 存储系统统计信息
CREATE TABLE system_stats (
  id SERIAL PRIMARY KEY,
  total_jobs INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- data_retention_policies - 存储数据保留策略
CREATE TABLE data_retention_policies (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) UNIQUE NOT NULL,
  retention_days INTEGER NOT NULL,
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default policies
INSERT INTO data_retention_policies (table_name, retention_days, description)
VALUES 
  ('jobs', 30, 'Raw job data retention'),
  ('processed_jobs', 90, 'Processed job data retention'),
  ('resumes', 30, 'Resume file retention (if not user associated)'),
  ('feedbacks', 365, 'Feedback retention')
ON CONFLICT (table_name) DO NOTHING;

-- company_images - 存储公司图片缓存
CREATE TABLE company_images (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  logo_url VARCHAR(500),
  cover_url VARCHAR(500),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  storage_provider VARCHAR(50) DEFAULT 'neon',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- user_profile_stats - 存储用户画像统计
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
