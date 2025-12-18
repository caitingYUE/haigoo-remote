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

-- 2024-05-23: 新增会员体系字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_since TIMESTAMP;
-- 兼容旧字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_level VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_start_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expire_at TIMESTAMP;

-- 2025-02-17: 新增会员编号字段 (需手动执行)
-- 创建序列，从 100001 开始
CREATE SEQUENCE IF NOT EXISTS member_id_seq START 100001;
-- 添加字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_display_id INTEGER;
-- 初始化现有会员的编号 (可选，如果想给老会员补号)
-- UPDATE users SET member_display_id = nextval('member_id_seq') WHERE member_status = 'active' AND member_display_id IS NULL;

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
