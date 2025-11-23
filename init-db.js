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
        await neonHelper.query('DROP TABLE IF EXISTS users');
        await neonHelper.query('DROP TABLE IF EXISTS favorites');
        if (!(await neonHelper.tableExists('users'))) {
            console.log('创建users表...');
            await neonHelper.query(`
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
          user_id VARCHAR(255),
          job_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, job_id)
        );
      `);
            await neonHelper.query('CREATE INDEX idx_favorites_user_job ON favorites(user_id, job_id);');
            await neonHelper.query('CREATE INDEX idx_favorites_user ON favorites(user_id);');
            console.log('favorites表创建完成');
        } else {
            console.log('favorites表已存在或users表不存在，跳过');
        }

        // 插入管理员账号
        if (await neonHelper.tableExists('users')) {
            console.log('初始化管理员账号...');
            await neonHelper.query(`
        INSERT INTO users (user_id, email, username, status, roles)
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

    } catch (error) {
        console.error('初始化失败:', error.message);
        process.exit(1);
    }
}

initDatabase();