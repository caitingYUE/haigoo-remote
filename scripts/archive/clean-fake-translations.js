/**
 * 清理无效翻译数据的维护脚本
 * 
 * 作用：扫描数据库中的 is_translated = true 的岗位，检查其翻译质量。
 * 如果发现翻译不合格（如只有英文，或中文比例过低），则重置为未翻译状态。
 * 
 * 用法：node scripts/clean-fake-translations.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// 动态导入 helper (因为项目结构原因)
const loadHelpers = async () => {
    try {
        const neonHelper = (await import('../server-utils/dal/neon-helper.js')).default;
        return { neonHelper };
    } catch (e) {
        console.error('Failed to load helpers:', e);
        process.exit(1);
    }
};

const BATCH_SIZE = 100;

async function runCleanup() {
    const { neonHelper } = await loadHelpers();

    if (!neonHelper.isConfigured) {
        console.error('Database configuration missing.');
        process.exit(1);
    }

    console.log('🧹 Starting cleanup of fake translations...');

    let processedCount = 0;
    let fixedCount = 0;
    let lastSeenId = '';

    try {
        // 获取总数估算
        const countRes = await neonHelper.query(`
            SELECT COUNT(*) as count FROM jobs WHERE is_translated = true
        `);
        const totalEstimate = parseInt(countRes[0]?.count || '0');
        console.log(`📊 Found ~${totalEstimate} translated jobs to check.`);

        while (true) {
            // Keyset pagination
            let query = `
                SELECT job_id, translations
                FROM jobs
                WHERE is_translated = true
            `;

            if (lastSeenId) {
                query += ` AND job_id > '${lastSeenId}'`;
            }

            query += ` ORDER BY job_id ASC LIMIT ${BATCH_SIZE}`;

            const jobs = await neonHelper.query(query);

            if (!jobs || jobs.length === 0) {
                break;
            }

            lastSeenId = jobs[jobs.length - 1].job_id;
            processedCount += jobs.length;

            const toFix = [];

            for (const job of jobs) {
                if (!job.translations || !job.translations.description) {
                    toFix.push(job.job_id);
                    continue;
                }

                const desc = job.translations.description;

                // 校验逻辑 (与 translation-service.cjs 保持一致)
                // 1. 绝对数量检查
                const chineseCharCount = (desc.match(/[\u4e00-\u9fa5]/g) || []).length;

                // 2. 比例检查
                const totalLength = desc.replace(/\s/g, '').length;
                const chineseRatio = totalLength > 0 ? (chineseCharCount / totalLength) : 0;

                const isValid = chineseCharCount >= 20 && (totalLength < 100 || chineseRatio >= 0.1 || chineseCharCount >= 100);

                if (!isValid) {
                    // console.log(`Detected fake translation: ID ${job.job_id}, Count: ${chineseCharCount}, Ratio: ${chineseRatio.toFixed(2)}`);
                    toFix.push(job.job_id);
                }
            }

            if (toFix.length > 0) {
                const ids = toFix.map(id => `'${id}'`).join(',');
                await neonHelper.query(`
                    UPDATE jobs 
                    SET is_translated = false, translations = null 
                    WHERE job_id IN (${ids})
                `);
                fixedCount += toFix.length;
                process.stdout.write(`.`); // Visual progress
            }

            if (processedCount % 1000 === 0) {
                console.log(`\nProcessed ${processedCount} / ~${totalEstimate}...`);
            }
        }

        console.log(`\n\n✅ Cleanup finished!`);
        console.log(`   Scanned: ${processedCount}`);
        console.log(`   Fixed:   ${fixedCount}`);

    } catch (error) {
        console.error('\n❌ Cleanup failed:', error);
    }
}

runCleanup();
