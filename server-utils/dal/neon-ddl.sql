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

-- 初始化管理员账号(密码123456)
INSERT INTO users (user_id, email, password_hash, username, status, roles)
VALUES ('admin-1', 'caitlinyct@gmail.com', '$2b$10$/MXqVv06y6pPb39e1NXRiuEmUC6dbFsIaMVBZNmx9iIjP8x6j40dG', '超级管理员', 'active', '{"admin": true}')
ON CONFLICT (email) DO NOTHING;
INSERT INTO users (user_id, email, password_hash, username, status, roles)
VALUES ('admin-2', 'mrzhangzy1996@gmail.com', '$2b$10$/MXqVv06y6pPb39e1NXRiuEmUC6dbFsIaMVBZNmx9iIjP8x6j40dG', '超级管理员', 'active', '{"admin": true}')
ON CONFLICT (email) DO NOTHING;

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

-- trusted_companies - 存储可信公司信息
CREATE TABLE trusted_companies (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  website VARCHAR(2000),
  careers_page VARCHAR(2000),
  linkedin VARCHAR(2000),
  description TEXT,
  logo VARCHAR(2000),
  tags JSONB DEFAULT '[]',
  is_trusted BOOLEAN DEFAULT true,
  can_refer BOOLEAN DEFAULT false,
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

