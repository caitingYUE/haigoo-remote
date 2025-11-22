#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 简化版：三张表的创建
 */


import neonHelper from './server-utils/dal/neon-helper.js';

async function initDatabase() {
    console.log('开始初始化数据库...');

    // 检查数据库配置
    if (!neonHelper.isConfigured) {
        console.error('错误: 数据库未配置');
        process.exit(1);
    }

    try {
        // 表1: users
        if (!(await neonHelper.tableExists('users'))) {
            console.log('创建users表...');
            await neonHelper.query(`
        CREATE TABLE users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255),
          passwordHash VARCHAR(255),
          verificationToken VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          roles JSONB DEFAULT '{}',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await neonHelper.query('CREATE INDEX idx_users_email ON users(email);');
            await neonHelper.query('CREATE INDEX idx_users_status ON users(status);');
            console.log('users表创建完成');
        } else {
            console.log('users表已存在，跳过');
        }

        // 表2: favorites
        if (!(await neonHelper.tableExists('favorites')) && await neonHelper.tableExists('users')) {
            console.log('创建favorites表...');
            await neonHelper.query(`
        CREATE TABLE favorites (
          id SERIAL PRIMARY KEY,
          userId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          jobId VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(userId, jobId)
        );
      `);
            await neonHelper.query('CREATE INDEX idx_favorites_user_job ON favorites(userId, jobId);');
            await neonHelper.query('CREATE INDEX idx_favorites_user ON favorites(userId);');
            console.log('favorites表创建完成');
        } else {
            console.log('favorites表已存在或users表不存在，跳过');
        }

        // 表3: resume_analysis
        if (!(await neonHelper.tableExists('resume_analysis')) && await neonHelper.tableExists('users')) {
            console.log('创建resume_analysis表...');
            await neonHelper.query(`
        CREATE TABLE resume_analysis (
          id SERIAL PRIMARY KEY,
          userId VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          resumeUrl VARCHAR(512) NOT NULL,
          resumeName VARCHAR(255) NOT NULL,
          content TEXT,
          skills TEXT[],
          experience TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            await neonHelper.query('CREATE INDEX idx_resume_user ON resume_analysis(userId);');
            console.log('resume_analysis表创建完成');
        } else {
            console.log('resume_analysis表已存在或users表不存在，跳过');
        }

        // 插入管理员账号
        if (await neonHelper.tableExists('users')) {
            console.log('初始化管理员账号...');
            await neonHelper.query(`
        INSERT INTO users (id, email, username, status, roles)
        VALUES ('admin-1', 'caitlinyct@gmail.com', '超级管理员', 'active', '{"admin": true}')
        ON CONFLICT (email) DO NOTHING;
      `);
            console.log('管理员账号初始化完成');
        }

        console.log('\n数据库初始化完成！');
        const userExists = await neonHelper.tableExists('users');
        console.log('- users表:', userExists ? '✅ 已创建' : '❌ 失败');
        const favoritesExists = await neonHelper.tableExists('favorites');
        console.log('- favorites表:', favoritesExists ? '✅ 已创建' : '❌ 失败');
        const resumeAnalysisExists = await neonHelper.tableExists('resume_analysis');
        console.log('- resume_analysis表:', resumeAnalysisExists ? '✅ 已创建' : '❌ 失败');

    } catch (error) {
        console.error('初始化失败:', error.message);
        process.exit(1);
    }
}

initDatabase();