-- Neon数据库DDL脚本
-- 此脚本包含项目所需的所有表结构定义

-- 表1: users - 存储用户信息
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

-- 初始化管理员账号
INSERT INTO users (user_id, email, username, status, roles)
VALUES ('admin-1', 'caitlinyct@gmail.com', '超级管理员', 'active', '{"admin": true}')
ON CONFLICT (email) DO NOTHING;

-- 表3: jobs - 存储岗位信息
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- jobs表索引（根据需要后续添加）

-- 表2: favorites - 存储用户收藏的工作
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  job_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id)
);

