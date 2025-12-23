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
  source_type VARCHAR(50) DEFAULT 'rss', -- 'official' (Trusted Company Crawler), 'trusted' (Curated Platforms), 'rss' (Third-party)
  is_trusted BOOLEAN DEFAULT false, -- true if linked to Trusted Company (Official), false if just Curated (Trusted Platform)
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
  status VARCHAR(50) DEFAULT 'pending',
  provider VARCHAR(50) DEFAULT 'stripe',
  provider_transaction_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-22 新增 trusted_companies 表缺失字段 (Fix Save Failure)
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS careers_page VARCHAR(2000);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS linkedin VARCHAR(2000);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS translations JSONB;
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS employee_count VARCHAR(100);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS founded_year VARCHAR(50);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]';
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS company_rating VARCHAR(50);
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS rating_source VARCHAR(100);

-- bug_reports - 存储用户Bug反馈
CREATE TABLE bug_reports (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  user_nickname VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  image_url TEXT,
  status VARCHAR(50) DEFAULT 'open',
  contact_info VARCHAR(255),
  admin_reply TEXT,
  replied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- club_applications - 存储会员申请信息 (Missing in previous DDL)
CREATE TABLE IF NOT EXISTS club_applications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  experience TEXT,
  career_ideal TEXT,
  portfolio TEXT,
  expectations TEXT,
  contribution TEXT,
  contact TEXT,
  contact_type VARCHAR(50) DEFAULT 'wechat',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2025-12-23 修复 club_applications 缺少 updated_at 字段的问题
ALTER TABLE club_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
