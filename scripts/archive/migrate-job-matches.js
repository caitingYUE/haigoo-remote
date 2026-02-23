/**
 * 数据库迁移脚本：创建 user_job_matches 表
 * 运行方式: node scripts/migrate-job-matches.js
 */

import neonHelper from '../server-utils/dal/neon-helper.js';

async function createJobMatchesTable() {
    console.log('开始创建 user_job_matches 表...');

    try {
        // 创建表
        await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS user_job_matches (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        job_id VARCHAR(255) NOT NULL,
        match_score INTEGER NOT NULL,
        match_details JSONB,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        UNIQUE(user_id, job_id)
      )
    `);
        console.log('✅ 表创建成功');

        // 创建索引
        await neonHelper.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_user_score 
      ON user_job_matches(user_id, match_score DESC)
    `);
        console.log('✅ 索引创建成功');

        // 验证
        const result = await neonHelper.query(`
      SELECT COUNT(*) as count FROM user_job_matches
    `);
        const count = result?.[0]?.count ?? 0;
        console.log(`✅ 验证成功，当前记录数: ${count}`);

        console.log('迁移完成!');
        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    }
}

createJobMatchesTable();
